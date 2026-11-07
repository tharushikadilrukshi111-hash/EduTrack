
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required']
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required']
    },

    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Payment amount must be greater than zero']
    },

    paymentDate: {
      type: Date,
      default: Date.now
    },

    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'card', 'online', 'other'],
      required: true
    },

    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },

    transactionReference: {
      type: String,
      trim: true,
      sparse: true,
      unique: true
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ studentId: 1, paymentDate: -1 });
paymentSchema.index({ status: 1, paymentDate: -1 });
paymentSchema.index({ classId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
