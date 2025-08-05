const mongoose = require('mongoose');

const workScheduleSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  position: {
    type: String,
    required: true,
  },
  hourlyRate: {
    type: Number,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  hoursWorked: {
    type: Number,
    required: true,
  },
  regularEarnings: {
    type: Number,
    required: true,
  },
  tips: {
    type: Number,
    default: 0,
  },
  totalEarnings: {
    type: Number,
    required: true,
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('WorkSchedule', workScheduleSchema);