const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const QRCode = require('qrcode');

const Student = require('../models/Student');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const PREFIX = 'EDUTRACK';

// Signature stops people from forging a QR from a guessed registration number
function sign(registrationNumber) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(registrationNumber)
    .digest('hex')
    .slice(0, 16);
}

function buildPayload(registrationNumber) {
  return `${PREFIX}:${registrationNumber}:${sign(registrationNumber)}`;
}

// Returns the registration number if the payload is valid, otherwise null
function parsePayload(payload) {
  if (typeof payload !== 'string') return null;

  const parts = payload.trim().split(':');
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;

  const [, registrationNumber, signature] = parts;
  const expected = Buffer.from(sign(registrationNumber));
  const given = Buffer.from(signature);

  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return null;
  }

  return registrationNumber;
}

function formatStudent(student) {
  const user = student.userId && student.userId.name ? student.userId : null;

  return {
    id: student.id,
    userId: user ? user.id : student.userId,
    name: user ? user.name : undefined,
    email: user ? user.email : undefined,
    registrationNumber: student.registrationNumber,
    dateOfBirth: student.dateOfBirth,
    phone: student.phone
  };
}

async function sendQr(req, res, student) {
  const payload = buildPayload(student.registrationNumber);

  // ?format=png returns the image itself (open it in a browser or save it)
  if (req.query.format === 'png') {
    const png = await QRCode.toBuffer(payload, { width: 300, margin: 2 });
    return res.type('png').send(png);
  }

  const qrImage = await QRCode.toDataURL(payload, { width: 300, margin: 2 });

  res.json({
    student: formatStudent(student),
    payload,
    qrImage
  });
}

// GET /api/qr/me - a student gets their own QR code
router.get('/me', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.sub })
      .populate('userId', 'name email');

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    await sendQr(req, res, student);
  } catch (error) {
    console.error('Own QR error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// GET /api/qr/student/:id - a teacher gets a student's QR code
router.get('/student/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid student id.' });
    }

    const student = await Student.findById(req.params.id)
      .populate('userId', 'name email');

    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    await sendQr(req, res, student);
  } catch (error) {
    console.error('Student QR error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// POST /api/qr/identify - identify a student by QR payload or registration number
router.post('/identify', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const { qrPayload, registrationNumber } = req.body || {};

    let regNo = null;

    if (qrPayload !== undefined) {
      regNo = parsePayload(qrPayload);

      if (!regNo) {
        return res.status(400).json({ message: 'Invalid or tampered QR code.' });
      }
    } else if (typeof registrationNumber === 'string' && registrationNumber.trim()) {
      regNo = registrationNumber.trim().toUpperCase();
    } else {
      return res.status(400).json({
        message: 'Provide qrPayload or registrationNumber.'
      });
    }

    const student = await Student.findOne({ registrationNumber: regNo })
      .populate('userId', 'name email');

    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    res.json({ student: formatStudent(student) });
  } catch (error) {
    console.error('Identify student error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

module.exports = router;