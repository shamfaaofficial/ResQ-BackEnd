const express = require('express');
const router = express.Router();
const adminUserController = require('../controllers/admin.user.controller');
const adminDriverController = require('../controllers/admin.driver.controller');
const adminTripController = require('../controllers/admin.trip.controller');
const adminDashboardController = require('../controllers/admin.dashboard.controller');
const adminDocumentController = require('../controllers/admin.document.controller');
const adminSettingsController = require('../controllers/admin.settings.controller');
const adminWithdrawalController = require('../controllers/admin.withdrawal.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

/**
 * DASHBOARD ROUTES
 */

// Get dashboard statistics
router.get('/dashboard/stats', adminDashboardController.getDashboardStats);

/**
 * USER MANAGEMENT ROUTES
 */

// Get all users with pagination and filters
router.get('/users', adminUserController.getAllUsers);

// Get user statistics
router.get('/users/statistics', adminUserController.getUserStatistics);

// Get specific user by ID
router.get('/users/:userId', adminUserController.getUserById);

// Create new user
router.post('/users', adminUserController.createUser);

// Update user
router.put('/users/:userId', adminUserController.updateUser);

// Delete user (soft delete by default, use ?hardDelete=true for permanent)
router.delete('/users/:userId', adminUserController.deleteUser);

/**
 * DRIVER MANAGEMENT ROUTES
 */

// Get all drivers with pagination and filters
router.get('/drivers', adminDriverController.getAllDrivers);

// Get driver statistics (MUST be before /:driverId to avoid route conflict)
router.get('/drivers/statistics', adminDriverController.getDriverStatistics);

/**
 * DRIVER DOCUMENT MANAGEMENT ROUTES
 * NOTE: These routes MUST come BEFORE parameterized routes like /drivers/:driverId
 * to avoid route matching conflicts (e.g., "documents" being interpreted as driverId)
 */

// Get all drivers with their documents (with filters)
router.get('/drivers/documents', adminDocumentController.getAllDriverDocuments);

// Get drivers with pending documents (needs review)
router.get('/drivers/documents/pending', adminDocumentController.getPendingDocuments);

// Bulk update multiple documents
router.patch('/drivers/documents/bulk-update', adminDocumentController.bulkUpdateDocuments);

// Get specific driver by ID
router.get('/drivers/:driverId', adminDriverController.getDriverById);

// Get driver earnings
router.get('/drivers/:driverId/earnings', adminDriverController.getDriverEarnings);

// Get specific driver's documents
router.get('/drivers/:driverId/documents', adminDocumentController.getDriverDocuments);

// Get driver rejection statistics
router.get('/drivers/:driverId/rejections', adminDriverController.getDriverRejectionStats);

// Update driver approval status
router.patch('/drivers/:driverId/approval', adminDriverController.updateDriverApproval);

// Approve/Reject a specific document
router.patch('/drivers/:driverId/documents/:documentId', adminDocumentController.updateDocumentStatus);

// Approve driver application (approve all documents and activate account)
router.post('/drivers/:driverId/approve', adminDocumentController.approveDriverApplication);

// Reject driver application and delete account
router.delete('/drivers/:driverId/reject', adminDocumentController.rejectDriverApplication);

// Update driver details
router.put('/drivers/:driverId', adminDriverController.updateDriver);

// Delete driver (soft delete by default, use ?hardDelete=true for permanent)
router.delete('/drivers/:driverId', adminDriverController.deleteDriver);

/**
 * TRIP MANAGEMENT ROUTES
 */

// Get all trips with pagination and filters
router.get('/trips', adminTripController.getAllTrips);

// Get trip statistics
router.get('/trips/statistics', adminTripController.getTripStatistics);

// Get active trips (real-time)
router.get('/trips/active', adminTripController.getActiveTrips);

// Get revenue report
router.get('/trips/revenue-report', adminTripController.getRevenueReport);

// Get specific trip by ID
router.get('/trips/:tripId', adminTripController.getTripById);

// Get trip timeline
router.get('/trips/:tripId/timeline', adminTripController.getTripTimeline);

// Cancel trip
router.patch('/trips/:tripId/cancel', adminTripController.cancelTrip);

// Update trip status (force update)
router.patch('/trips/:tripId/status', adminTripController.updateTripStatus);

/**
 * SETTINGS MANAGEMENT ROUTES
 */

// Get all settings
router.get('/settings', adminSettingsController.getAllSettings);

// Get driver commission percentage
router.get('/settings/commission', adminSettingsController.getDriverCommission);

// Update driver commission percentage
router.put('/settings/commission', adminSettingsController.updateDriverCommission);

// Get specific setting by key
router.get('/settings/:settingKey', adminSettingsController.getSettingByKey);

// Update or create a setting
router.put('/settings/:settingKey', adminSettingsController.updateSetting);

// Delete a setting
router.delete('/settings/:settingKey', adminSettingsController.deleteSetting);

/**
 * WITHDRAWAL MANAGEMENT ROUTES
 */

// Get all withdrawals
router.get('/withdrawals', adminWithdrawalController.getAllWithdrawals);

// Get pending withdrawals
router.get('/withdrawals/pending', adminWithdrawalController.getPendingWithdrawals);

// Get withdrawal statistics
router.get('/withdrawals/statistics', adminWithdrawalController.getWithdrawalStats);

// Get withdrawal by ID
router.get('/withdrawals/:withdrawalId', adminWithdrawalController.getWithdrawalById);

// Approve withdrawal (move to processing)
router.patch('/withdrawals/:withdrawalId/approve', adminWithdrawalController.approveWithdrawal);

// Reject withdrawal
router.patch('/withdrawals/:withdrawalId/reject', adminWithdrawalController.rejectWithdrawal);

// Mark withdrawal as completed
router.patch('/withdrawals/:withdrawalId/complete', adminWithdrawalController.completeWithdrawal);

module.exports = router;
