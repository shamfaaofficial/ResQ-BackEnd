const asyncHandler = require('express-async-handler');
const Driver = require('../models/Driver');
const DriverWithdrawal = require('../models/DriverWithdrawal');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { WITHDRAWAL_STATUS } = require('../config/constants');

/**
 * Get all withdrawal requests with filters
 */
exports.getAllWithdrawals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, driverId, isAutomatic } = req.query;

  const query = {};
  if (status) query.status = status;
  if (driverId) query.driverId = driverId;
  if (isAutomatic !== undefined) query.isAutomatic = isAutomatic === 'true';

  const withdrawals = await DriverWithdrawal.find(query)
    .populate('driverId', 'userId vehicleDetails bankDetails wallet')
    .populate({
      path: 'driverId',
      populate: {
        path: 'userId',
        select: 'phoneNumber profile'
      }
    })
    .populate('processedBy', 'phoneNumber profile')
    .sort({ requestedAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  const total = await DriverWithdrawal.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      withdrawals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

/**
 * Get pending withdrawal requests
 */
exports.getPendingWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = await DriverWithdrawal.find({
    status: WITHDRAWAL_STATUS.PENDING
  })
    .populate('driverId', 'userId vehicleDetails bankDetails wallet')
    .populate({
      path: 'driverId',
      populate: {
        path: 'userId',
        select: 'phoneNumber profile'
      }
    })
    .sort({ requestedAt: 1 }); // Oldest first

  res.status(200).json({
    success: true,
    data: {
      withdrawals,
      total: withdrawals.length
    }
  });
});

/**
 * Approve withdrawal request
 * Status changes: pending → approved → processing
 */
exports.approveWithdrawal = asyncHandler(async (req, res) => {
  const { withdrawalId } = req.params;
  const { notes } = req.body;

  console.log('\n========== ADMIN: APPROVE WITHDRAWAL ==========');
  console.log('[ApproveWithdrawal] Withdrawal ID:', withdrawalId);
  console.log('[ApproveWithdrawal] Admin User ID:', req.userId);

  const withdrawal = await DriverWithdrawal.findById(withdrawalId);

  if (!withdrawal) {
    throw new NotFoundError('Withdrawal request not found');
  }

  if (withdrawal.status !== WITHDRAWAL_STATUS.PENDING) {
    throw new ValidationError(`Cannot approve withdrawal with status: ${withdrawal.status}`);
  }

  // Update withdrawal status to PROCESSING
  withdrawal.status = WITHDRAWAL_STATUS.PROCESSING;
  withdrawal.processedBy = req.userId;
  withdrawal.processedAt = new Date();
  if (notes) {
    withdrawal.notes = notes;
  }
  await withdrawal.save();

  console.log('[ApproveWithdrawal] ✅ Withdrawal approved and moved to PROCESSING');
  console.log('[ApproveWithdrawal] Amount:', withdrawal.amount, 'QAR');
  console.log('[ApproveWithdrawal] Final amount (after 5% deduction):', withdrawal.finalAmount, 'QAR');
  console.log('========== END APPROVE WITHDRAWAL ==========\n');

  // TODO: Send notification to driver

  res.status(200).json({
    success: true,
    message: 'Withdrawal approved and moved to processing. Will auto-complete in 2 days if not manually updated.',
    data: {
      withdrawal: await DriverWithdrawal.findById(withdrawalId)
        .populate('driverId', 'userId bankDetails')
        .populate({
          path: 'driverId',
          populate: {
            path: 'userId',
            select: 'phoneNumber profile'
          }
        })
    }
  });
});

/**
 * Reject withdrawal request
 */
exports.rejectWithdrawal = asyncHandler(async (req, res) => {
  const { withdrawalId } = req.params;
  const { rejectionReason } = req.body;

  if (!rejectionReason) {
    throw new ValidationError('Rejection reason is required');
  }

  console.log('\n========== ADMIN: REJECT WITHDRAWAL ==========');
  console.log('[RejectWithdrawal] Withdrawal ID:', withdrawalId);

  const withdrawal = await DriverWithdrawal.findById(withdrawalId);

  if (!withdrawal) {
    throw new NotFoundError('Withdrawal request not found');
  }

  if (![WITHDRAWAL_STATUS.PENDING, WITHDRAWAL_STATUS.APPROVED].includes(withdrawal.status)) {
    throw new ValidationError(`Cannot reject withdrawal with status: ${withdrawal.status}`);
  }

  // Return money from pending to balance
  const driver = await Driver.findById(withdrawal.driverId);
  if (driver) {
    driver.wallet.balance += withdrawal.amount;
    driver.wallet.pendingAmount = Math.max(0, (driver.wallet.pendingAmount || 0) - withdrawal.amount);
    await driver.save();
    console.log(`[RejectWithdrawal] Returned ${withdrawal.amount} QAR to driver balance`);
  }

  withdrawal.status = WITHDRAWAL_STATUS.REJECTED;
  withdrawal.rejectionReason = rejectionReason;
  withdrawal.processedBy = req.userId;
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  console.log('[RejectWithdrawal] ✅ Withdrawal rejected');
  console.log('========== END REJECT WITHDRAWAL ==========\n');

  // TODO: Send notification to driver

  res.status(200).json({
    success: true,
    message: 'Withdrawal request rejected. Amount returned to driver balance.',
    data: { withdrawal }
  });
});

/**
 * Mark withdrawal as completed
 * Admin confirms the money has been transferred
 */
exports.completeWithdrawal = asyncHandler(async (req, res) => {
  const { withdrawalId } = req.params;
  const { notes } = req.body;

  console.log('\n========== ADMIN: COMPLETE WITHDRAWAL ==========');
  console.log('[CompleteWithdrawal] Withdrawal ID:', withdrawalId);

  const withdrawal = await DriverWithdrawal.findById(withdrawalId);

  if (!withdrawal) {
    throw new NotFoundError('Withdrawal request not found');
  }

  if (withdrawal.status !== WITHDRAWAL_STATUS.PROCESSING) {
    throw new ValidationError(`Can only complete withdrawals in PROCESSING status. Current status: ${withdrawal.status}`);
  }

  // Update driver's pending amount
  const driver = await Driver.findById(withdrawal.driverId);
  if (driver) {
    driver.wallet.pendingAmount = Math.max(0, (driver.wallet.pendingAmount || 0) - withdrawal.amount);
    await driver.save();
    console.log(`[CompleteWithdrawal] Removed ${withdrawal.amount} QAR from driver pending amount`);
  }

  withdrawal.status = WITHDRAWAL_STATUS.COMPLETED;
  if (notes) {
    withdrawal.notes = (withdrawal.notes || '') + ' | ' + notes;
  }
  await withdrawal.save();

  console.log('[CompleteWithdrawal] ✅ Withdrawal marked as completed');
  console.log('========== END COMPLETE WITHDRAWAL ==========\n');

  // TODO: Send notification to driver

  res.status(200).json({
    success: true,
    message: 'Withdrawal marked as completed',
    data: { withdrawal }
  });
});

/**
 * Get withdrawal statistics
 */
exports.getWithdrawalStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const query = {};
  if (startDate || endDate) {
    query.requestedAt = {};
    if (startDate) query.requestedAt.$gte = new Date(startDate);
    if (endDate) query.requestedAt.$lte = new Date(endDate);
  }

  const stats = await DriverWithdrawal.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFinalAmount: { $sum: '$finalAmount' },
        totalDeduction: { $sum: '$deductionAmount' }
      }
    }
  ]);

  const total = await DriverWithdrawal.countDocuments(query);
  const totalAmountRequested = await DriverWithdrawal.aggregate([
    { $match: query },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      stats,
      summary: {
        total,
        totalAmountRequested: totalAmountRequested[0]?.total || 0
      }
    }
  });
});

/**
 * Get withdrawal by ID
 */
exports.getWithdrawalById = asyncHandler(async (req, res) => {
  const { withdrawalId } = req.params;

  const withdrawal = await DriverWithdrawal.findById(withdrawalId)
    .populate('driverId', 'userId vehicleDetails bankDetails wallet earnings')
    .populate({
      path: 'driverId',
      populate: {
        path: 'userId',
        select: 'phoneNumber profile'
      }
    })
    .populate('processedBy', 'phoneNumber profile');

  if (!withdrawal) {
    throw new NotFoundError('Withdrawal request not found');
  }

  res.status(200).json({
    success: true,
    data: { withdrawal }
  });
});
