
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100
    },

    role: {
      type: String,
      enum: ['student', 'teacher', 'parent', 'admin'],
      required: [true, 'User role is required']
    },

    identifier: {
      type: String,
      required: [true, 'Login identifier is required'],
      unique: true,
      trim: true
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },

    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);
