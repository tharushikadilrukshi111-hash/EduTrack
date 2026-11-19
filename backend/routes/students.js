const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const User = require('../models/User');
const Student = require('../models/Student');
const Counter = require('../models/Counter');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// All student management routes are teacher-only
router.use(requireAuth, requireRole('teacher'));

async function nextRegistrationNumber() {
  const year = new Date().getFullYear();

  const counter = await Counter.findOneAndUpdate(
    { _id: `student-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  return `EDU-${year}-${String(counter.seq).padStart(4, '0')}`;
}

function generatePassword() {
  return crypto.randomBytes(9).toString('base64url').slice(0, 10);
}

function validateStudentInput({ name, email, dateOfBirth, phone, password }) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
    return 'Name is required (maximum 100 characters).';
  }

  if (email !== undefined && email !== '') {
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return 'Please provide a valid email address.';
    }
  }

  if (dateOfBirth !== undefined && dateOfBirth !== '') {
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime()) || dob > new Date()) {
      return 'Date of birth must be a valid date that is not in the future.';
    }
  }

  if (phone !== undefined && phone !== '') {
    if (typeof phone !== 'string' || !/^\+?[0-9]{7,15}$/.test(phone.trim())) {
      return 'Please provide a valid phone number.';
    }
  }

  if (password !== undefined && password !== '') {
    if (typeof password !== 'string' || password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
  }

  return null;
}

function formatStudent(student, user) {
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

// POST /api/students - register a new student
router.post('/', async (req, res) => {
  let createdUser = null;

  try {
    const body = req.body || {};
    const problem = validateStudentInput(body);

    if (problem) {
      return res.status(400).json({ message: problem });
    }

    const email = body.email ? body.email.trim().toLowerCase() : undefined;

    if (email && (await User.exists({ email }))) {
      return res.status(409).json({
        message: 'A user with this email already exists.'
      });
    }

    const registrationNumber = await nextRegistrationNumber();

    const generated = !body.password;
    const plainPassword = generated ? generatePassword() : body.password;
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    createdUser = await User.create({
      name: body.name.trim(),
      role: 'student',
      identifier: registrationNumber,
      email,
      passwordHash
    });

    const student = await Student.create({
      userId: createdUser._id,
      registrationNumber,
      dateOfBirth: body.dateOfBirth || undefined,
      phone: body.phone ? body.phone.trim() : undefined
    });

    const response = {
      message: 'Student registered successfully.',
      student: formatStudent(student, createdUser)
    };

    // Shown only once, when the system generated the password
    if (generated) {
      response.temporaryPassword = plainPassword;
    }

    res.status(201).json(response);
  } catch (error) {
    // Roll back the login account if the student profile failed
    if (createdUser) {
      await User.deleteOne({ _id: createdUser._id }).catch(() => {});
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Duplicate registration number or email. Please try again.'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }

    console.error('Register student error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// GET /api/students - list students (optional ?search=)
router.get('/', async (req, res) => {
  try {
    const filter = {};

    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const safe = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.registrationNumber = { $regex: safe, $options: 'i' };
    }

    const students = await Student.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      count: students.length,
      students: students.map(s => ({
        id: s.id,
        userId: s.userId ? s.userId.id : null,
        name: s.userId ? s.userId.name : null,
        email: s.userId ? s.userId.email : null,
        registrationNumber: s.registrationNumber,
        dateOfBirth: s.dateOfBirth,
        phone: s.phone
      }))
    });
  } catch (error) {
    console.error('List students error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// GET /api/students/:id - one student
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid student id.' });
    }

    const student = await Student.findById(req.params.id)
      .populate('userId', 'name email');

    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    res.json({ student: formatStudent(student, student.userId) });
  } catch (error) {
    console.error('Get student error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

module.exports = router;