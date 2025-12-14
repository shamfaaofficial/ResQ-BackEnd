const asyncHandler = require('express-async-handler');
const Driver = require('../models/Driver');
const DriverWithdrawal = require('../models/DriverWithdrawal');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { WITHDRAWAL_STATUS } = require('../config/constants');

/**
 * Request wallet withdrawal
 */
exports.requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, bankDetails } = req.body;

  console.log('\n========== DRIVER WITHDRAWAL REQUEST ==========');
  console.log('[WithdrawalRequest] Driver User ID:', req.userId);
  console.log('[WithdrawalRequest] Requested amount:', amount);

  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  console.log('[WithdrawalRequest] Driver ID:', driver._id);
  console.log('[WithdrawalRequest] Current wallet balance:', driver.wallet?.balance || 0);

  // Validate amount
  if (!amount || amount <= 0) {
    throw new ValidationError('Withdrawal amount must be greater than 0');
  }

  const minimumWithdrawal = 10; // 10 QAR minimum
  if (amount < minimumWithdrawal) {
    throw new ValidationError(`Minimum withdrawal amount is ${minimumWithdrawal} QAR`);
  }

  // SYNC: Check if wallet balance is out of sync with legacy availableBalance
  // (Fix for drivers who existed before wallet feature or have data inconsistencies)
  if (driver.earnings && driver.earnings.availableBalance > (driver.wallet?.balance || 0)) {
    console.log(`[WithdrawalRequest] Syncing wallet balance from earnings.availableBalance`);
    console.log(`[WithdrawalRequest] Wallet: ${driver.wallet?.balance}, Earnings.Available: ${driver.earnings.availableBalance}`);

    if (!driver.wallet) {
      driver.wallet = { balance: 0, pendingAmount: 0 };
    }
    driver.wallet.balance = driver.earnings.availableBalance;
    // We don't save yet, we'll save after deduction
  }

  // Check if driver has sufficient balance
  const currentBalance = driver.wallet?.balance || 0;
  if (amount > currentBalance) {
    throw new ValidationError(`Insufficient wallet balance. Available: ${currentBalance} QAR, Requested: ${amount} QAR`);
  }

  // Check for pending withdrawal requests
  const pendingWithdrawal = await DriverWithdrawal.findOne({
    driverId: driver._id,
    status: WITHDRAWAL_STATUS.PENDING
  });

  if (pendingWithdrawal) {
    throw new ValidationError('You already have a pending withdrawal request. Please wait for it to be processed.');
  }

  // Use provided bank details or driver's saved bank details
  const withdrawalBankDetails = bankDetails || driver.bankDetails;

  if (!withdrawalBankDetails?.accountNumber || !withdrawalBankDetails?.bankName) {
    throw new ValidationError('Bank details are required. Please provide account number and bank name.');
  }

  // Calculate 5% deduction
  const deductionPercentage = 5;
  const deductionAmount = (amount * deductionPercentage) / 100;
  const finalAmount = amount - deductionAmount;

  console.log(`[WithdrawalRequest] Requested: ${amount} QAR, Deduction (5%): ${deductionAmount.toFixed(2)} QAR, Final: ${finalAmount.toFixed(2)} QAR`);

  // Create withdrawal request
  const withdrawal = await DriverWithdrawal.create({
    driverId: driver._id,
    amount: amount,
    deductionAmount: Math.round(deductionAmount * 100) / 100,
    deductionPercentage: deductionPercentage,
    finalAmount: Math.round(finalAmount * 100) / 100,
    isAutomatic: false,
    status: WITHDRAWAL_STATUS.PENDING,
    bankDetails: {
      accountHolderName: withdrawalBankDetails.accountHolderName,
      bankName: withdrawalBankDetails.bankName,
      accountNumber: withdrawalBankDetails.accountNumber,
      iban: withdrawalBankDetails.iban
    },
    requestedAt: new Date()
  });

  // Move amount from balance to pending (reserve it)
  if (!driver.wallet) {
    driver.wallet = { balance: 0, pendingAmount: 0 };
  }
  driver.wallet.balance -= amount;
  driver.wallet.pendingAmount = (driver.wallet.pendingAmount || 0) + amount;

  // CRITICAL: Also decrement legacy availableBalance to keep it in sync and prevent double-spending
  if (driver.earnings) {
    driver.earnings.availableBalance = Math.max(0, (driver.earnings.availableBalance || 0) - amount);
  }

  await driver.save();

  console.log('[WithdrawalRequest] ✅ Withdrawal request created');
  console.log('[WithdrawalRequest] Withdrawal ID:', withdrawal._id);
  console.log('[WithdrawalRequest] New balance:', driver.wallet.balance);
  console.log('[WithdrawalRequest] Pending amount:', driver.wallet.pendingAmount);
  console.log('========== END WITHDRAWAL REQUEST ==========\n');

  res.status(201).json({
    success: true,
    message: `Withdrawal request submitted successfully. Amount after 5% deduction: ${finalAmount.toFixed(2)} QAR. Admin will process it soon.`,
    data: {
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        deductionAmount: withdrawal.deductionAmount,
        deductionPercentage: withdrawal.deductionPercentage,
        finalAmount: withdrawal.finalAmount,
        status: withdrawal.status,
        bankDetails: withdrawal.bankDetails,
        requestedAt: withdrawal.requestedAt
      },
      wallet: {
        balance: driver.wallet.balance,
        pendingAmount: driver.wallet.pendingAmount
      }
    }
  });
});

/**
 * Get driver's withdrawal history
 */
exports.getWithdrawalHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const query = { driverId: driver._id };
  if (status) {
    query.status = status;
  }

  const withdrawals = await DriverWithdrawal.find(query)
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
 * Get driver's pending withdrawal requests
 */
exports.getPendingWithdrawals = asyncHandler(async (req, res) => {
  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const pendingWithdrawals = await DriverWithdrawal.find({
    driverId: driver._id,
    status: WITHDRAWAL_STATUS.PENDING
  }).sort({ requestedAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      withdrawals: pendingWithdrawals,
      total: pendingWithdrawals.length
    }
  });
});

/**
 * Get withdrawal request by ID
 */
exports.getWithdrawalById = asyncHandler(async (req, res) => {
  const { withdrawalId } = req.params;

  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const withdrawal = await DriverWithdrawal.findOne({
    _id: withdrawalId,
    driverId: driver._id
  });

  if (!withdrawal) {
    throw new NotFoundError('Withdrawal request not found');
  }

  res.status(200).json({
    success: true,
    data: { withdrawal }
  });
});

/**
 * Cancel pending withdrawal request
 */
exports.cancelWithdrawal = asyncHandler(async (req, res) => {
  const { withdrawalId } = req.params;

  console.log('\n========== CANCEL WITHDRAWAL REQUEST ==========');
  console.log('[CancelWithdrawal] Withdrawal ID:', withdrawalId);

  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const withdrawal = await DriverWithdrawal.findOne({
    _id: withdrawalId,
    driverId: driver._id
  });

  if (!withdrawal) {
    throw new NotFoundError('Withdrawal request not found');
  }

  // Only pending withdrawals can be cancelled
  if (withdrawal.status !== WITHDRAWAL_STATUS.PENDING) {
    throw new ValidationError(`Cannot cancel withdrawal with status: ${withdrawal.status}`);
  }

  // Return amount from pending back to balance
  const amount = withdrawal.amount;
  if (!driver.wallet) {
    driver.wallet = { balance: 0, pendingAmount: 0 };
  }
  driver.wallet.balance += amount;
  driver.wallet.pendingAmount = Math.max(0, (driver.wallet.pendingAmount || 0) - amount);
  await driver.save();

  // Update withdrawal status
  withdrawal.status = WITHDRAWAL_STATUS.REJECTED;
  withdrawal.rejectionReason = 'Cancelled by driver';
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  console.log('[CancelWithdrawal] ✅ Withdrawal cancelled');
  console.log('[CancelWithdrawal] Amount returned to balance:', amount);
  console.log('[CancelWithdrawal] New balance:', driver.wallet.balance);
  console.log('[CancelWithdrawal] Pending amount:', driver.wallet.pendingAmount);
  console.log('========== END CANCEL WITHDRAWAL ==========\n');

  res.status(200).json({
    success: true,
    message: 'Withdrawal request cancelled successfully',
    data: {
      withdrawal,
      wallet: {
        balance: driver.wallet.balance,
        pendingAmount: driver.wallet.pendingAmount
      }
    }
  });
});

/**
 * Get driver wallet balance
 */
exports.getWalletBalance = asyncHandler(async (req, res) => {
  // Get driver profile
  const driver = await Driver.findOne({ userId: req.userId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  res.status(200).json({
    success: true,
    data: {
      wallet: {
        balance: driver.wallet?.balance || 0,
        pendingAmount: driver.wallet?.pendingAmount || 0,
        totalEarnings: driver.earnings?.totalEarnings || 0
      }
    }
  });
});
