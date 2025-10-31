const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');

// User Authentication Routes
router.post('/user/signup', authController.userSignup);
router.post('/user/verify-otp', authController.userVerifyOTP);
router.post('/user/complete-signup', authController.userCompleteSignup);
router.post('/user/login', authController.userLogin);
router.post('/user/forgot-password', authController.userForgotPassword);
router.post('/user/reset-password', authController.userResetPassword);
router.post('/user/refresh-token', authController.userRefreshToken);

// Driver Authentication Routes
router.post('/driver/signup', authController.driverSignup);
router.post('/driver/verify-otp', authController.driverVerifyOTP);
router.post('/driver/complete-signup', authController.driverCompleteSignup);
router.post('/driver/login', authController.driverLogin);
router.post('/driver/forgot-password', authController.driverForgotPassword);
router.post('/driver/reset-password', authController.driverResetPassword);
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

// Admin Authentication Routes (Placeholder)
router.post('/admin/login', authController.adminLogin);

// Logout (Protected)
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
