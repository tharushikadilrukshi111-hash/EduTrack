
const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Material title is required'],
      trim: true,
      maxlength: 150
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500
    },

    fileUrl: {
  type: String,
  required: [true, 'File URL is required'],
  trim: true,
  validate: {
    validator: function (value) {
      try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol);
      } catch {
        return false;
      }
    },
    message: 'Please provide a valid HTTP or HTTPS URL'
  }
},

    fileType: {
      type: String,
      enum: ['pdf', 'document', 'video', 'image', 'other'],
      default: 'other'
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required']
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader is required']
    }
  },
  {
    timestamps: true
  }
);

materialSchema.index({ classId: 1, createdAt: -1 });
materialSchema.index({ uploadedBy: 1 });

module.exports = mongoose.model('Material', materialSchema);
