const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');

const Material = require('../models/Material');
const Class = require('../models/Class');
const Student = require('../models/Student');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED = {
  'application/pdf': { ext: '.pdf', type: 'pdf' },
  'application/msword': { ext: '.doc', type: 'document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', type: 'document' },
  'application/vnd.ms-powerpoint': { ext: '.ppt', type: 'document' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: '.pptx', type: 'document' },
  'text/plain': { ext: '.txt', type: 'document' },
  'image/jpeg': { ext: '.jpg', type: 'image' },
  'image/png': { ext: '.png', type: 'image' }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = ALLOWED[file.mimetype].ext;
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      const error = new Error('File type not allowed. Use PDF, Word, PowerPoint, TXT, JPG or PNG.');
      error.code = 'BAD_FILE_TYPE';
      return cb(error);
    }
    cb(null, true);
  }
});

function removeFile(filename) {
  if (!filename) return;
  fs.unlink(path.join(UPLOAD_DIR, path.basename(filename)), () => {});
}

function handleUpload(req, res, next) {
  upload.single('file')(req, res, error => {
    if (!error) return next();

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File is too large. Maximum size is 10 MB.' });
    }

    if (error.code === 'BAD_FILE_TYPE' || error instanceof multer.MulterError) {
      return res.status(400).json({ message: error.message });
    }

    console.error('Upload error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  });
}

async function canAccessClass(user, cls) {
  if (user.role === 'teacher') {
    return String(cls.teacherId) === user.sub;
  }

  if (user.role === 'student') {
    if (!cls.isActive) return false;
    const student = await Student.findOne({ userId: user.sub });
    return !!student && cls.studentIds.some(id => String(id) === String(student._id));
  }

  return false;
}

function formatMaterial(m) {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    classId: m.classId,
    fileType: m.fileType,
    originalName: m.originalName,
    mimeType: m.mimeType,
    size: m.size,
    downloadUrl: `/api/materials/${m.id}/download`,
    uploadedBy: m.uploadedBy,
    createdAt: m.createdAt
  };
}

router.use(requireAuth);

// POST /api/materials - upload (teacher). multipart/form-data: file, classId, title, description
router.post('/', requireRole('teacher'), handleUpload, async (req, res) => {
  const stored = req.file ? req.file.filename : null;

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'A file is required (form field "file").' });
    }

    const { classId, title, description } = req.body || {};

    if (typeof title !== 'string' || !title.trim() || title.trim().length > 150) {
      removeFile(stored);
      return res.status(400).json({ message: 'Title is required (maximum 150 characters).' });
    }

    if (description !== undefined && (typeof description !== 'string' || description.length > 500)) {
      removeFile(stored);
      return res.status(400).json({ message: 'Description must be at most 500 characters.' });
    }

    if (!mongoose.isValidObjectId(classId)) {
      removeFile(stored);
      return res.status(400).json({ message: 'A valid classId is required.' });
    }

    const cls = await Class.findOne({
      _id: classId,
      teacherId: req.user.sub,
      isActive: true
    });

    if (!cls) {
      removeFile(stored);
      return res.status(404).json({ message: 'Active class not found.' });
    }

    const _id = new mongoose.Types.ObjectId();
    const base = `${req.protocol}://${req.get('host')}`;

    const material = await Material.create({
      _id,
      title: title.trim(),
      description: description ? description.trim() : undefined,
      fileUrl: `${base}/api/materials/${_id}/download`,
      fileType: ALLOWED[req.file.mimetype].type,
      classId: cls._id,
      uploadedBy: req.user.sub,
      originalName: path.basename(req.file.originalname).slice(0, 255),
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size
    });

    res.status(201).json({
      message: 'Material uploaded.',
      material: formatMaterial(material)
    });
  } catch (error) {
    removeFile(stored);

    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }

    console.error('Upload material error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// GET /api/materials?classId=... - list materials of a class
router.get('/', async (req, res) => {
  try {
    const { classId } = req.query;

    if (!mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ message: 'A valid classId query parameter is required.' });
    }

    const cls = await Class.findById(classId);

    if (!cls || !(await canAccessClass(req.user, cls))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const materials = await Material.find({ classId }).sort({ createdAt: -1 });

    res.json({
      count: materials.length,
      materials: materials.map(formatMaterial)
    });
  } catch (error) {
    console.error('List materials error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// GET /api/materials/:id/download - download the file
router.get('/:id/download', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid material id.' });
    }

    const material = await Material.findById(req.params.id);

    if (!material || !material.storedName) {
      return res.status(404).json({ message: 'Material not found.' });
    }

    const cls = await Class.findById(material.classId);

    if (!cls || !(await canAccessClass(req.user, cls))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filePath = path.join(UPLOAD_DIR, path.basename(material.storedName));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File is no longer available.' });
    }

    res.download(filePath, material.originalName || material.storedName);
  } catch (error) {
    console.error('Download material error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// DELETE /api/materials/:id - delete (the teacher who uploaded it)
router.delete('/:id', requireRole('teacher'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid material id.' });
    }

    const material = await Material.findOneAndDelete({
      _id: req.params.id,
      uploadedBy: req.user.sub
    });

    if (!material) {
      return res.status(404).json({ message: 'Material not found.' });
    }

    removeFile(material.storedName);

    res.json({ message: 'Material deleted.', id: material.id });
  } catch (error) {
    console.error('Delete material error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

module.exports = router;