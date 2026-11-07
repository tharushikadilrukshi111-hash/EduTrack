
const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    selectedAnswer: {
      type: String,
      trim: true
    },

    isCorrect: {
      type: Boolean,
      default: false
    },

    marksAwarded: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },

    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true
    },

    answers: {
      type: [answerSchema],
      default: []
    },

    score: {
  type: Number,
  required: true,
  min: 0,
  validate: {
    validator: function (value) {
      return value <= this.totalMarks;
    },
    message: 'Score cannot exceed total marks'
  }
},

totalMarks: {
  type: Number,
  required: true,
  min: 1
},

    submittedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

resultSchema.index({ studentId: 1, submittedAt: -1 });
resultSchema.index({ quizId: 1 });
resultSchema.index({ studentId: 1, quizId: 1, submittedAt: -1 });
module.exports = mongoose.model('Result', resultSchema);
