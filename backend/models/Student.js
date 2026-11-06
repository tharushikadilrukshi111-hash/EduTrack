
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User account is required'],
      unique: true
    },

    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true,
      trim: true,
      uppercase: true
    },

    dateOfBirth: {
      type: Date,
      validate: {
        validator: function (value) {
          return !value || value <= new Date();
        },
        message: 'Date of birth cannot be in the future'
      }
    },

   phone: {
  type: String,
  trim: true,
  match: [/^\+?[0-9]{7,15}$/, 'Please provide a valid phone number']
},

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Student', studentSchema);
