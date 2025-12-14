const cron = require('node-cron');
const Driver = require('../models/Driver');
const DriverWithdrawal = require('../models/DriverWithdrawal');
const { WITHDRAWAL_STATUS } = require('../config/constants');

/**
 * Automatically create withdrawal requests for all drivers every Sunday
 * Withdraws all available wallet balance if > 10 QAR
 */
async function createAutomaticWithdrawals() {
  try {
    console.log('\n========== AUTO WITHDRAWAL JOB STARTED ==========');
    console.log(`[AutoWithdrawal] Running at: ${new Date().toISOString()}`);

    // Find all drivers with wallet balance >= 10 QAR
    const drivers = await Driver.find({
      'wallet.balance': { $gte: 10 },
      'bankDetails.accountNumber': { $exists: true, $ne: null },
      'bankDetails.bankName': { $exists: true, $ne: null }
    }).populate('userId', 'phoneNumber');

    console.log(`[AutoWithdrawal] Found ${drivers.length} drivers eligible for automatic withdrawal`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const driver of drivers) {
      try {
        // Check if driver already has a pending withdrawal
        const pendingWithdrawal = await DriverWithdrawal.findOne({
          driverId: driver._id,
          status: { $in: [WITHDRAWAL_STATUS.PENDING, WITHDRAWAL_STATUS.APPROVED, WITHDRAWAL_STATUS.PROCESSING] }
        });

        if (pendingWithdrawal) {
          console.log(`[AutoWithdrawal] ⏭️  Driver ${driver._id} has pending withdrawal, skipping`);
          skipCount++;
          continue;
        }

        const amount = driver.wallet.balance;

        // NO DEDUCTION for automatic Sunday withdrawals
        const deductionPercentage = 0;
        const deductionAmount = 0;
        const finalAmount = amount; // Driver gets full amount

        // Create automatic withdrawal request
        const withdrawal = await DriverWithdrawal.create({
          driverId: driver._id,
          amount: amount,
          deductionAmount: 0,
          deductionPercentage: 0,
          finalAmount: Math.round(finalAmount * 100) / 100,
          isAutomatic: true,
          status: WITHDRAWAL_STATUS.PENDING,
          bankDetails: {
            accountHolderName: driver.bankDetails.accountHolderName,
            bankName: driver.bankDetails.bankName,
            accountNumber: driver.bankDetails.accountNumber,
            iban: driver.bankDetails.iban
          },
          requestedAt: new Date()
        });

        // Move amount from balance to pending
        driver.wallet.balance -= amount;
        driver.wallet.pendingAmount = (driver.wallet.pendingAmount || 0) + amount;
        await driver.save();

        console.log(`[AutoWithdrawal] ✅ Created withdrawal for driver ${driver._id}: ${amount} QAR (NO DEDUCTION - automatic withdrawal)`);
        successCount++;

        // TODO: Send notification to driver about automatic withdrawal request

      } catch (driverError) {
        console.error(`[AutoWithdrawal] ❌ Error processing driver ${driver._id}:`, driverError.message);
        errorCount++;
      }
    }

    console.log(`[AutoWithdrawal] Summary: ${successCount} created, ${skipCount} skipped, ${errorCount} errors`);
    console.log('========== AUTO WITHDRAWAL JOB COMPLETED ==========\n');

  } catch (error) {
    console.error('[AutoWithdrawal] ❌ Job failed:', error);
  }
}

/**
 * Auto-complete withdrawals that have been pending for more than 2 days
 * Handles both PENDING and PROCESSING status withdrawals
 * Excludes REJECTED withdrawals
 */
async function autoCompleteStaleWithdrawals() {
  try {
    console.log('\n========== AUTO-COMPLETE STALE WITHDRAWALS ==========');
    console.log(`[AutoComplete] Running at: ${new Date().toISOString()}`);

    // Find withdrawals in 'pending' or 'processing' status for more than 2 days
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const staleWithdrawals = await DriverWithdrawal.find({
      status: { $in: [WITHDRAWAL_STATUS.PENDING, WITHDRAWAL_STATUS.PROCESSING] },
      requestedAt: { $lte: twoDaysAgo }
    });

    console.log(`[AutoComplete] Found ${staleWithdrawals.length} stale withdrawals to auto-complete`);

    let completedCount = 0;
    let errorCount = 0;

    for (const withdrawal of staleWithdrawals) {
      try {
        const previousStatus = withdrawal.status;
        withdrawal.status = WITHDRAWAL_STATUS.COMPLETED;

        // Add appropriate note based on previous status
        if (previousStatus === WITHDRAWAL_STATUS.PENDING) {
          withdrawal.notes = (withdrawal.notes || '') + ' | Auto-completed after 2 days (no admin action required)';
        } else {
          withdrawal.notes = (withdrawal.notes || '') + ' | Auto-completed after 2 days in processing status';
        }

        await withdrawal.save();

        // Update driver's pending amount
        const driver = await Driver.findById(withdrawal.driverId);
        if (driver) {
          driver.wallet.pendingAmount = Math.max(0, (driver.wallet.pendingAmount || 0) - withdrawal.amount);
          await driver.save();
          console.log(`[AutoComplete] ✅ Auto-completed withdrawal ${withdrawal._id} for driver ${driver._id} (${previousStatus} → COMPLETED)`);
          completedCount++;
        }

        // TODO: Send notification to driver about completed withdrawal

      } catch (withdrawalError) {
        console.error(`[AutoComplete] ❌ Error auto-completing withdrawal ${withdrawal._id}:`, withdrawalError.message);
        errorCount++;
      }
    }

    console.log(`[AutoComplete] Summary: ${completedCount} completed, ${errorCount} errors`);
    console.log('========== AUTO-COMPLETE JOB COMPLETED ==========\n');

  } catch (error) {
    console.error('[AutoComplete] ❌ Job failed:', error);
  }
}

/**
 * Schedule automatic withdrawal job
 * Runs every Sunday at 12:00 AM (midnight)
 */
function scheduleAutomaticWithdrawals() {
  // Cron format: second minute hour day month day-of-week
  // '0 0 * * 0' = Every Sunday at midnight
  cron.schedule('0 0 * * 0', () => {
    console.log('[CRON] Triggered automatic withdrawal job (Sunday midnight)');
    createAutomaticWithdrawals();
  }, {
    timezone: 'Asia/Qatar'
  });

  console.log('✓ Automatic withdrawal job scheduled (every Sunday at 12:00 AM Qatar time)');
}

/**
 * Schedule auto-complete stale withdrawals job
 * Runs every 6 hours to check for stale withdrawals
 */
function scheduleAutoCompleteJob() {
  // Runs every 6 hours
  cron.schedule('0 */6 * * *', () => {
    console.log('[CRON] Triggered auto-complete stale withdrawals job');
    autoCompleteStaleWithdrawals();
  });

  console.log('✓ Auto-complete stale withdrawals job scheduled (every 6 hours)');
}

module.exports = {
  createAutomaticWithdrawals,
  autoCompleteStaleWithdrawals,
  scheduleAutomaticWithdrawals,
  scheduleAutoCompleteJob
};
