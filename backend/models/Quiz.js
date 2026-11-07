
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: true,
      trim: true
    },

    options: {
  type: [String],
  required: true,
  validate: [
    {
      validator: options =>
        options.length >= 2 &&
        options.every(option => typeof option === 'string' && option.trim().length > 0),
      message: 'At least two non-empty options are required'
    },
    {
      validator: options =>
        new Set(options.map(option => option.trim().toLowerCase())).size === options.length,
      message: 'Duplicate options are not allowed'
    }
  ]
},

    correctAnswer: {
  type: String,
  required: true,
  trim: true,
  validate: {
    validator: function (value) {
      return this.options.includes(value);
    },
    message: 'Correct answer must match one of the available options'
  }
},

    marks: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Quiz title is required'],
      trim: true,
      maxlength: 150
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },

    questions: {
      type: [questionSchema],
      validate: {
        validator: questions => questions.length > 0,
        message: 'A quiz must contain at least one question'
      }
    },

    totalMarks: {
      type: Number,
      required: true,
      min: 1
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    dueDate: {
      type: Date,
      validate: {
        validator: value => !value || value > new Date(),
        message: 'Due date must be in the future'
      }
    },

    isPublished: {
  type: Boolean,
  default: false
},

maxAttempts: {
  type: Number,
  required: true,
  default: 1,
  min: [1, 'At least one attempt is required'],
  validate: {
    validator: Number.isInteger,
    message: 'Maximum attempts must be a whole number'
  }
}
  },
  {
    timestamps: true
  }
);

quizSchema.index({ classId: 1, isPublished: 1 });
quizSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('Quiz', quizSchema);
