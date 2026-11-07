
const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
      maxlength: 100
    },

    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500
    },

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher is required']
    },

    studentIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    }],

    schedule: [{
      day: {
        type: String,
        enum: [
          'Monday', 'Tuesday', 'Wednesday',
          'Thursday', 'Friday', 'Saturday', 'Sunday'
        ],
        required: true
      },
     startTime: {
  type: String,
  required: true,
  match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid start time. Use HH:mm format']
},

    endTime: {
  type: String,
  required: true,
  match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid end time. Use HH:mm format']
}
    }],

    fee: {
      type: Number,
      required: true,
      min: [0, 'Fee cannot be negative']
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

classSchema.pre('validate', function () {
  for (const session of this.schedule) {
    if (session.startTime && session.endTime &&
        session.startTime >= session.endTime) {
      session.invalidate(
        'endTime',
        'End time must be later than start time'
      );
    }
  }
});

classSchema.index({ teacherId: 1, isActive: 1 });
classSchema.index({ studentIds: 1 });

module.exports = mongoose.model('Class', classSchema);
