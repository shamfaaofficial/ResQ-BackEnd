const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const multer = require('multer');

// Configure multer for memory storage (for S3 uploads)
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only for profile pictures
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG images are allowed for profile pictures.'));
    }
  }
});

// User Authentication Routes
router.post('/user/signup', authController.userSignup);
router.post('/user/verify-otp', authController.userVerifyOTP);
router.post('/user/complete-signup', authController.userCompleteSignup);
router.post('/user/login', authController.userLogin);
router.post('/user/refresh-token', authController.userRefreshToken);

// Driver Authentication Routes
router.post('/driver/signup', authController.driverSignup);
router.post('/driver/verify-otp', authController.driverVerifyOTP);
router.post(
  '/driver/complete-signup',
  uploadMemory.single('profilePicture'), // Optional profile picture
  authController.driverCompleteSignup
);
router.post('/driver/login', authController.driverLogin);
router.post('/driver/refresh-token', authController.driverRefreshToken);

// Driver Document Upload (Protected)
router.post(
  '/driver/submit-documents',
  authMiddleware,
  upload.fields([
    { name: 'drivingLicense', maxCount: 1 },
    { name: 'vehicleRegistration', maxCount: 1 },
    { name: 'insurance', maxCount: 1 },
    { name: 'nationalId', maxCount: 1 }
  ]),
  authController.driverSubmitDocuments
);

// Admin Authentication Routes (OTP-based only)
router.post('/admin/login', authController.adminLogin); // Send OTP
router.post('/admin/verify-otp', authController.adminVerifyOTP); // Verify OTP and login
router.post('/admin/refresh-token', authController.adminRefreshToken);

// Logout (Protected)
router.post('/logout', authMiddleware, authController.logout);

// Forgot Password Routes (Unified for both user and driver)
router.post('/forgot-password/request', authController.forgotPasswordRequest);
router.post('/forgot-password/verify-otp', authController.forgotPasswordVerifyOTP);
router.post('/forgot-password/reset', authController.forgotPasswordReset);

// FCM Token Management (Protected)
router.post('/fcm-token', authMiddleware, authController.updateFcmToken);
router.delete('/fcm-token', authMiddleware, authController.removeFcmToken);

module.exports = router;
