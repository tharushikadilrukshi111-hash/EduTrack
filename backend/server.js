require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./models/User');
const { requireAuth, requireRole } = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20kb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1
      ? 'connected'
      : 'disconnected'
  });
});

// Student and Teacher login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { role, identifier, password } = req.body || {};

    if (
      !['student', 'teacher'].includes(role) ||
      typeof identifier !== 'string' ||
      !identifier.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({
        message: 'Role, identifier and password are required.'
      });
    }

    const id = identifier.trim();

    const query = role === 'student'
      ? {
          role,
          $or: [
            { identifier: id.toUpperCase() },
            { email: id.toLowerCase() }
          ]
        }
      : {
          role,
          identifier: id.toLowerCase()
        };

    const user = await User.findOne(query);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        message: 'Invalid login details. Please check and try again.'
      });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        identifier: user.identifier
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);

    res.status(500).json({
      message: 'Server error. Try again later.'
    });
  }
});

// Verify saved JWT and return authenticated user
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const subject = req.user?.sub;

    if (
      typeof subject !== 'string' ||
      !/^[a-fA-F0-9]{24}$/.test(subject)
    ) {
      return res.status(401).json({
        message: 'Invalid session.'
      });
    }

    const user = await User.findById(subject)
      .select('name role identifier');

    if (!user || !['student', 'teacher'].includes(user.role)) {
      return res.status(401).json({
        message: 'Account unavailable. Please sign in again.'
      });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        identifier: user.identifier
      }
    });
  } catch (error) {
    console.error('Session verification error:', error.message);

    res.status(500).json({
      message: 'Server error. Try again later.'
    });
  }
});

// Protected Teacher Dashboard
app.get(
  '/api/teacher/dashboard',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.sub)
        .select('name role identifier');

      if (!user) {
        return res.status(404).json({
          message: 'Teacher account not found.'
        });
      }

      res.json({
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          identifier: user.identifier
        }
      });
    } catch (error) {
      console.error('Teacher dashboard error:', error.message);

      res.status(500).json({
        message: 'Server error. Try again later.'
      });
    }
  }
);

// Start backend server
async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters.');
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI missing.');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const port = Number(process.env.PORT || 5000);

  app.listen(port, '0.0.0.0', () => {
    console.log(`EduTrack backend running on port ${port}`);
  });
}

start().catch(error => {
  console.error(error.message);
  process.exit(1);
});