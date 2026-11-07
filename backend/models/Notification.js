
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient user is required']
    },

    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: 150
    },

    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: 1000
    },

    type: {
      type: String,
      enum: [
        'quiz',
        'material',
        'class',
        'payment',
        'result',
        'general'
      ],
      default: 'general'
    },

    isRead: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
