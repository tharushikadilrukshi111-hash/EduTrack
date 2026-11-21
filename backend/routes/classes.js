const express = require('express');
const mongoose = require('mongoose');

const Class = require('../models/Class');
const Student = require('../models/Student');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

const EDITABLE_FIELDS = ['name', 'subject', 'description', 'fee', 'schedule', 'isActive'];

function formatClass(cls, includeRoster) {
  const base = {
    id: cls.id,
    name: cls.name,
    subject: cls.subject,
    description: cls.description,
    teacherId: cls.teacherId,
    schedule: cls.schedule,
    fee: cls.fee,
    isActive: cls.isActive,
    studentCount: cls.studentIds.length,
    createdAt: cls.createdAt,
    updatedAt: cls.updatedAt
  };

  if (includeRoster) {
    base.students = cls.studentIds.map(s => ({
      id: s.id || s,
      registrationNumber: s.registrationNumber,
      name: s.userId && s.userId.name ? s.userId.name : undefined
    }));
  }

  return base;
}

function withRoster(query) {
  return query.populate({
    path: 'studentIds',
    select: 'registrationNumber userId',
    populate: { path: 'userId', select: 'name' }
  });
}

function checkId(req, res, value) {
  if (!mongoose.isValidObjectId(value)) {
    res.status(400).json({ message: 'Invalid id.' });
    return false;
  }
  return true;
}

// Mongoose validation messages -> readable text
function validationMessage(error) {
  return Object.values(error.errors || {})
    .map(e => e.message)
    .join(' ') || error.message;
}

// POST /api/classes - create a class (teacher)
router.post('/', requireRole('teacher'), async (req, res) => {
  try {
    const body = req.body || {};
    const data = {};

    for (const key of EDITABLE_FIELDS) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    if (typeof data.fee === 'string' && data.fee.trim() !== '') {
      data.fee = Number(data.fee);
    }

    const cls = await Class.create({
      ...data,
      teacherId: req.user.sub,
      studentIds: []
    });

    res.status(201).json({
      message: 'Class created.',
      class: formatClass(cls, true)
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: validationMessage(error) });
    }

    console.error('Create class error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// GET /api/classes - teacher: own classes, student: enrolled classes
router.get('/', async (req, res) => {
  try {
    const filter = {};

    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;

    if (req.user.role === 'teacher') {
      filter.teacherId = req.user.sub;

      const classes = await withRoster(Class.find(filter).sort({ createdAt: -1 }));

      return res.json({
        count: classes.length,
        classes: classes.map(c => formatClass(c, true))
      });
    }

    if (req.user.role === 'student') {
      const student = await Student.findOne({ userId: req.user.sub });

      if (!student) {
        return res.status(404).json({ message: 'Student profile not found.' });
      }

      filter.studentIds = student._id;
      filter.isActive = true;

      const classes = await Class.find(filter).sort({ createdAt: -1 });

      return res.json({
        count: classes.length,
        classes: classes.map(c => formatClass(c, false))
      });
    }

    res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    console.error('List classes error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// GET /api/classes/:id - owner teacher or enrolled student
router.get('/:id', async (req, res) => {
  try {
    if (!checkId(req, res, req.params.id)) return;

    const cls = await withRoster(Class.findById(req.params.id));

    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    if (req.user.role === 'teacher') {
      if (String(cls.teacherId) !== req.user.sub) {
        return res.status(403).json({ message: 'Access denied' });
      }
      return res.json({ class: formatClass(cls, true) });
    }

    if (req.user.role === 'student') {
      const student = await Student.findOne({ userId: req.user.sub });
      const enrolled = student &&
        cls.studentIds.some(s => String(s._id) === String(student._id));

      if (!enrolled || !cls.isActive) {
        return res.status(403).json({ message: 'Access denied' });
      }
      return res.json({ class: formatClass(cls, false) });
    }

    res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    console.error('Get class error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// PATCH /api/classes/:id - update a class (owner teacher)
router.patch('/:id', requireRole('teacher'), async (req, res) => {
  try {
    if (!checkId(req, res, req.params.id)) return;

    const cls = await Class.findById(req.params.id);

    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    if (String(cls.teacherId) !== req.user.sub) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const body = req.body || {};
    let changed = 0;

    for (const key of EDITABLE_FIELDS) {
      if (body[key] !== undefined) {
        cls[key] = key === 'fee' && typeof body[key] === 'string' && body[key].trim() !== ''
          ? Number(body[key])
          : body[key];
        changed += 1;
      }
    }

    if (!changed) {
      return res.status(400).json({ message: 'No valid fields to update.' });
    }

    await cls.save();

    const updated = await withRoster(Class.findById(cls._id));

    res.json({
      message: 'Class updated.',
      class: formatClass(updated, true)
    });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: validationMessage(error) });
    }

    console.error('Update class error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// DELETE /api/classes/:id - deactivate a class (owner teacher)
router.delete('/:id', requireRole('teacher'), async (req, res) => {
  try {
    if (!checkId(req, res, req.params.id)) return;

    const cls = await Class.findOneAndUpdate(
      { _id: req.params.id, teacherId: req.user.sub },
      { $set: { isActive: false } },
      { returnDocument: 'after' }
    );

    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    res.json({ message: 'Class deactivated.', id: cls.id, isActive: cls.isActive });
  } catch (error) {
    console.error('Delete class error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// POST /api/classes/:id/students - enrol a student (by studentId or registrationNumber)
router.post('/:id/students', requireRole('teacher'), async (req, res) => {
  try {
    if (!checkId(req, res, req.params.id)) return;

    const { studentId, registrationNumber } = req.body || {};

    let student = null;

    if (typeof studentId === 'string' && mongoose.isValidObjectId(studentId)) {
      student = await Student.findById(studentId);
    } else if (typeof registrationNumber === 'string' && registrationNumber.trim()) {
      student = await Student.findOne({
        registrationNumber: registrationNumber.trim().toUpperCase()
      });
    } else {
      return res.status(400).json({
        message: 'Provide a valid studentId or registrationNumber.'
      });
    }

    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const cls = await Class.findOneAndUpdate(
      { _id: req.params.id, teacherId: req.user.sub, isActive: true },
      { $addToSet: { studentIds: student._id } },
      { returnDocument: 'after' }
    );

    if (!cls) {
      return res.status(404).json({ message: 'Active class not found.' });
    }

    const full = await withRoster(Class.findById(cls._id));

    res.json({
      message: 'Student enrolled.',
      class: formatClass(full, true)
    });
  } catch (error) {
    console.error('Enrol student error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// DELETE /api/classes/:id/students/:studentId - remove a student from a class
router.delete('/:id/students/:studentId', requireRole('teacher'), async (req, res) => {
  try {
    if (!checkId(req, res, req.params.id) || !checkId(req, res, req.params.studentId)) {
      return;
    }

    const cls = await Class.findOneAndUpdate(
      { _id: req.params.id, teacherId: req.user.sub },
      { $pull: { studentIds: req.params.studentId } },
      { returnDocument: 'after' }
    );

    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    const full = await withRoster(Class.findById(cls._id));

    res.json({
      message: 'Student removed from class.',
      class: formatClass(full, true)
    });
  } catch (error) {
    console.error('Remove student error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

module.exports = router;