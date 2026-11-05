require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./models/User');

const app = express();
app.use(cors()); // For local evaluation only; configure permitted origins before web deployment.
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { role, identifier, password } = req.body || {};
    if (!['student', 'teacher'].includes(role) || typeof identifier !== 'string' ||
        !identifier.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Role, identifier and password are required.' });
    }

    const normalized = role === 'teacher' ? identifier.trim().toLowerCase() : identifier.trim().toUpperCase();
    const user = await User.findOne({ role, identifier: normalized });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid login details. Please check and try again.' });
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
    return res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, role: user.role, identifier: user.identifier },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try later.' });
  }
});

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set.');
  await mongoose.connect(process.env.MONGODB_URI);
  const port = Number(process.env.PORT || 5000);
  app.listen(port, '0.0.0.0', () => console.log(`EduTrack API listening on port ${port}`));
}
start().catch(err => { console.error('Startup failed:', err.message); process.exit(1); });
