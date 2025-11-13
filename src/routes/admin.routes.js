const express = require('express');
const router = express.Router();
const adminUserController = require('../controllers/admin.user.controller');
const adminDriverController = require('../controllers/admin.driver.controller');
const adminTripController = require('../controllers/admin.trip.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

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

// Get specific driver by ID
router.get('/drivers/:driverId', adminDriverController.getDriverById);

// Get driver earnings
router.get('/drivers/:driverId/earnings', adminDriverController.getDriverEarnings);

// Get driver documents
router.get('/drivers/:driverId/documents', adminDriverController.getDriverDocuments);

// Get driver rejection statistics
router.get('/drivers/:driverId/rejections', adminDriverController.getDriverRejectionStats);

// Update driver approval status
router.patch('/drivers/:driverId/approval', adminDriverController.updateDriverApproval);

// Update document status
router.patch('/drivers/:driverId/documents', adminDriverController.updateDocumentStatus);

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

module.exports = router;
