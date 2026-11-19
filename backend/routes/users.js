const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_LANGUAGES = ['en', 'si'];

// GET /api/users/me/language - read the logged-in user's language
router.get('/me/language', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select('language');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ language: user.language || 'en' });
  } catch (error) {
    console.error('Get language error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

// PATCH /api/users/me/language - update the logged-in user's language
router.patch('/me/language', requireAuth, async (req, res) => {
  try {
    const { language } = req.body || {};

    if (typeof language !== 'string' || !ALLOWED_LANGUAGES.includes(language)) {
      return res.status(400).json({
        message: 'Language must be "en" or "si".'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.sub,
      { $set: { language } },
      { returnDocument: 'after', runValidators: true }
    ).select('language');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({
      message: 'Language updated.',
      language: user.language
    });
  } catch (error) {
    console.error('Update language error:', error.message);
    res.status(500).json({ message: 'Server error. Try again later.' });
  }
});

module.exports = router;