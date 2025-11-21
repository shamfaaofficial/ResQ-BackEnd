const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driver.controller');
const authController = require('../controllers/auth.controller');
const driverDocumentController = require('../controllers/driver.document.controller');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');
const { locationUpdateLimiter } = require('../middlewares/rateLimiter');
const multer = require('multer');

// Configure multer for memory storage (files will be uploaded to S3)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs only
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  }
});

// All routes are protected and require driver role

// Get driver profile
router.get(
  '/profile',
  authMiddleware,
  roleMiddleware('driver'),
  driverController.getDriverProfile
);

// Update FCM token (protected - driver only)
router.post(
  '/fcm-token',
  authMiddleware,
  roleMiddleware('driver'),
  authController.updateFcmToken
);

// Remove FCM token (protected - driver only)
router.delete(
  '/fcm-token',
  authMiddleware,
  roleMiddleware('driver'),
  authController.removeFcmToken
);

// Update location
router.patch(
  '/location',
  authMiddleware,
  roleMiddleware('driver'),
  locationUpdateLimiter,
  driverController.updateLocation
);

// Toggle online status
router.patch(
  '/status',
  authMiddleware,
  roleMiddleware('driver'),
  driverController.toggleOnlineStatus
);

// Update vehicle details
router.patch(
  '/vehicle',
  authMiddleware,
  roleMiddleware('driver'),
  driverController.updateVehicleDetails
);

// Get earnings
router.get(
  '/earnings',
  authMiddleware,
  roleMiddleware('driver'),
  driverController.getEarnings
);

// Update bank details
router.patch(
  '/bank-details',
  authMiddleware,
  roleMiddleware('driver'),
  driverController.updateBankDetails
);

// Get active trip
router.get(
  '/bookings/active',
  authMiddleware,
  roleMiddleware('driver'),
  driverController.getActiveTrip
);

/**
 * DOCUMENT UPLOAD ROUTES
 */

// Get document requirements
router.get(
  '/documents/requirements',
  authMiddleware,
  roleMiddleware('driver'),
  driverDocumentController.getDocumentRequirements
);

// Get my documents
router.get(
  '/documents',
  authMiddleware,
  roleMiddleware('driver'),
  driverDocumentController.getMyDocuments
);

// Upload document to S3
router.post(
  '/documents/upload',
  authMiddleware,
  roleMiddleware('driver'),
  upload.single('document'), // 'document' is the form field name
  driverDocumentController.uploadDocument
);

// Delete document
router.delete(
  '/documents/:documentType',
  authMiddleware,
  roleMiddleware('driver'),
  driverDocumentController.deleteDocument
);

module.exports = router;
