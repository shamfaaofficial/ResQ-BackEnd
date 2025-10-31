const mongoose = require('mongoose');
const { WITHDRAWAL_STATUS } = require('../config/constants');

const driverWithdrawalSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 10
  },
  status: {
    type: String,
    enum: Object.values(WITHDRAWAL_STATUS),
    default: WITHDRAWAL_STATUS.PENDING
  },
  bankDetails: {
    accountHolderName: String,
    bankName: String,
    accountNumber: String,
    iban: String
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String
  },
  rejectionReason: {
    type: String
  }
}, {
  timestamps: true
});

driverWithdrawalSchema.index({ driverId: 1, status: 1 });
driverWithdrawalSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model('DriverWithdrawal', driverWithdrawalSchema);
