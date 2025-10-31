# RESQ Backend - Complete Implementation Guide

This document contains all the remaining controllers, routes, services, and scripts that need to be implemented to complete the RESQ backend system.

## Table of Contents
1. [Auth Controllers](#auth-controllers)
2. [User Controllers](#user-controllers)
3. [Driver Controllers](#driver-controllers)
4. [Admin Controllers](#admin-controllers)
5. [Utils Controllers](#utils-controllers)
6. [Route Files](#route-files)
7. [Background Jobs](#background-jobs)
8. [Scripts](#scripts)

---

## Implementation Instructions

### File Location Structure
All files should be created in their respective directories:
- Controllers: `src/controllers/`
- Routes: `src/routes/`
- Jobs: `src/jobs/`
- Scripts: `scripts/`

---

## AUTH CONTROLLERS

### File: `src/controllers/auth.controller.js`

This file should contain:

**User Authentication Methods:**
- `userSignup` - Send OTP for user registration
- `userVerifyOTP` - Verify OTP and create user account
- `userLogin` - Login with username and password
- `userForgotPassword` - Send OTP for password reset
- `userResetPassword` - Reset password with OTP verification
- `userRefreshToken` - Generate new access token from refresh token

**Driver Authentication Methods:**
- `driverSignup` - Send OTP for driver registration
- `driverVerifyOTP` - Verify OTP and create driver account
- `driverSubmitDocuments` - Upload and submit verification documents
- `driverLogin` - Login and check approval status
- `driverForgotPassword` - Password reset for drivers
- `driverResetPassword` - Reset driver password
- `driverRefreshToken` - Refresh driver access token

**Admin Authentication Methods:**
- `adminLogin` - Admin login with username/password
- `adminRefreshToken` - Refresh admin access token

**Logout Method:**
- `logout` - Invalidate refresh token

**Key Implementation Points:**
- Use `otpService` to generate and verify OTPs
- Use `smsService` to send OTPs via SMS
- Hash passwords with `hashPassword` helper
- Generate JWT tokens with `generateAccessToken` and `generateRefreshToken`
- Store refresh tokens in User model
- Validate input with validators from `utils/validators.js`
- For driver login, check if `approvalStatus === 'approved'`
- For driver document submission, use `uploadFields` middleware

---

## USER CONTROLLERS

### File: `src/controllers/user.controller.js`

**Profile Methods:**
- `getProfile` - Get user profile with populated data
- `updateProfile` - Update user profile (firstName, lastName, email)
- `uploadProfilePicture` - Upload and update profile image

**Booking Methods:**
- `searchDrivers` - Find nearby available drivers using geospatial query
- `createBooking` - Create new booking request
  - Calculate distance using `mapsService`
  - Get pricing from `PricingConfig` model
  - Calculate total price
  - Set `requestExpiresAt` (1 minute)
  - Generate unique `bookingNumber`
  - Notify nearby drivers
- `getBookingDetails` - Get specific booking with driver details
- `cancelBooking` - Cancel booking by user
- `trackDriver` - Get driver's real-time location
- `initiatePayment` - Create payment link with Al Fatoorah
- `paymentCallback` - Handle payment gateway callback
- `getBookingHistory` - Get user's completed bookings with pagination

**Notification Methods:**
- `getNotifications` - Get user notifications
- `markNotificationRead` - Mark notification as read

**Company Info Methods:**
- `getTerms` - Get terms and conditions
- `getContactInfo` - Get company contact information

**Key Implementation Points:**
- Use MongoDB geospatial queries for finding nearby drivers
- Implement proper distance calculation
- Handle booking state transitions
- Integrate with Al Fatoorah payment gateway
- Send notifications at each booking stage

---

## DRIVER CONTROLLERS

### File: `src/controllers/driver.controller.js`

**Profile Methods:**
- `getProfile` - Get driver profile with user details
- `updateProfile` - Update driver profile information
- `updateVehicle` - Update vehicle details
- `updateBankDetails` - Update bank account information
- `toggleStatus` - Toggle online/offline status
- `updateLocation` - Update current GPS location

**Booking Methods:**
- `getIncomingBookings` - Get pending booking requests within driver's area
- `acceptBooking` - Accept a booking request
  - Check if booking is not expired
  - Set `paymentExpiresAt` (5 minutes from acceptance)
  - Update status to `accepted`
  - Notify user
- `cancelBooking` - Cancel accepted booking (with penalty logic if needed)
- `markArrived` - Mark as arrived at pickup location
- `startTrip` - Start the trip (update actual dropoff if different)
- `completeTrip` - Complete trip and calculate final earnings
  - Calculate driver earnings
  - Update driver wallet
  - Create transaction records
  - Mark booking as completed

**Trip Methods:**
- `getActiveTrip` - Get current active trip
- `getTripHistory` - Get completed trips with pagination

**Earnings Methods:**
- `getEarnings` - Get earnings summary (total, available, pending)
- `getWallet` - Get current wallet balance
- `requestWithdrawal` - Request money withdrawal
- `getTransactions` - Get transaction history

**Notification Methods:**
- `getNotifications` - Get driver notifications
- `markNotificationRead` - Mark as read

**Key Implementation Points:**
- Only approved drivers can access booking methods
- Validate driver is online before accepting bookings
- Update location frequently (every 10-30 seconds from mobile app)
- Calculate earnings: `Total - (Total × PlatformCommission%)`
- Ensure withdrawal amount doesn't exceed available balance

---

## ADMIN CONTROLLERS

### File: `src/controllers/admin.controller.js`

**Dashboard Methods:**
- `getDashboardStats` - Get overview statistics
  - Total users, drivers, bookings
  - Revenue metrics
  - Active bookings count
- `getAnalytics` - Get analytics data for charts
  - Bookings by date
  - Revenue trends
  - Driver performance

**User Management:**
- `getAllUsers` - List users with pagination, search, filter
- `getUserDetails` - Get specific user details with bookings
- `updateUserStatus` - Activate/deactivate user
- `deleteUser` - Soft delete user

**Driver Management:**
- `getAllDrivers` - List drivers with filters (pending, approved, rejected)
- `getDriverDetails` - Get driver details with documents
- `approveDriver` - Approve driver application
- `rejectDriver` - Reject with reason
- `updateDriverStatus` - Activate/deactivate driver
- `getDriverDocuments` - View uploaded documents
- `updateDocumentStatus` - Approve/reject specific document

**Booking Management:**
- `getAllBookings` - List all bookings with filters
- `getBookingDetails` - Get detailed booking information
- `getLiveBookings` - Get active/ongoing bookings
- `cancelBooking` - Admin cancel booking

**Financial Management:**
- `getAllTransactions` - List all transactions
- `getRevenueReport` - Generate revenue reports
- `getWithdrawalRequests` - List withdrawal requests
- `approveWithdrawal` - Approve and process withdrawal
- `rejectWithdrawal` - Reject withdrawal request

**Pricing Management:**
- `getAllPricing` - Get all pricing configurations
- `createPricing` - Create new pricing config
- `updatePricing` - Update existing pricing
- `deletePricing` - Delete pricing configuration

**Settings Management:**
- `getSettings` - Get all admin settings
- `updateSettings` - Update system settings

**Notification Management:**
- `broadcastNotification` - Send to all users/drivers
- `sendNotification` - Send to specific user/driver

**Report Methods:**
- `getBookingReports` - Generate booking reports (CSV export)
- `getDriverPerformanceReport` - Driver performance metrics
- `getRevenueReport` - Detailed revenue reports

**Key Implementation Points:**
- Implement proper aggregation pipelines for statistics
- Add date range filters for reports
- Implement CSV export functionality
- Log all admin actions for audit trail
- Implement proper authorization checks

---

## UTILS CONTROLLERS

### File: `src/controllers/utils.controller.js`

**Methods:**
- `geocodeAddress` - Convert address to coordinates
- `reverseGeocode` - Convert coordinates to address
- `calculateDistance` - Calculate distance between two points
- `calculatePrice` - Calculate trip price based on distance and vehicle type
- `getVehicleTypes` - Return available vehicle types

**Key Implementation Points:**
- Use `mapsService` for geocoding operations
- Fetch pricing from `PricingConfig` model
- Use `calculateTripPrice` helper for price calculation

---

## BOOKING SERVICE

### File: `src/services/booking.service.js`

**Methods:**
- `findNearbyDrivers(location, vehicleType, radius)` - Find available drivers
- `createBooking(userId, bookingData)` - Create new booking
- `acceptBooking(driverId, bookingId)` - Driver accepts booking
- `cancelBooking(bookingId, cancelledBy, reason)` - Cancel booking
- `updateBookingStatus(bookingId, status)` - Update status
- `calculateFinalEarnings(booking)` - Calculate driver earnings
- `processPayment(bookingId, paymentData)` - Process payment
- `expireBookings()` - Expire old requests (called by cron job)

---

## PAYMENT SERVICE

### File: `src/services/payment.service.js`

Already created in `src/config/payment.js` but can be extended:

**Additional Methods:**
- `createPaymentLink(booking, user)` - Generate payment link
- `verifyPayment(paymentId)` - Verify payment status
- `processRefund(booking)` - Process refund for cancelled bookings

---

## ROUTE FILES

### File: `src/routes/auth.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const { authLimiter, otpLimiter } = require('../middlewares/rateLimiter');
const { uploadFields } = require('../middlewares/upload');
const {
  signupValidator,
  verifyOtpValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  refreshTokenValidator,
  driverDocumentsValidator
} = require('../utils/validators');

// User auth routes
router.post('/user/signup', otpLimiter, validate(signupValidator), authController.userSignup);
router.post('/user/verify-otp', validate(verifyOtpValidator), authController.userVerifyOTP);
router.post('/user/login', authLimiter, validate(loginValidator), authController.userLogin);
router.post('/user/forgot-password', otpLimiter, validate(forgotPasswordValidator), authController.userForgotPassword);
router.post('/user/reset-password', validate(resetPasswordValidator), authController.userResetPassword);
router.post('/user/refresh-token', validate(refreshTokenValidator), authController.userRefreshToken);

// Driver auth routes
router.post('/driver/signup', otpLimiter, validate(signupValidator), authController.driverSignup);
router.post('/driver/verify-otp', validate(verifyOtpValidator), authController.driverVerifyOTP);
router.post('/driver/submit-documents', authMiddleware, uploadFields([...]), authController.driverSubmitDocuments);
router.post('/driver/login', authLimiter, validate(loginValidator), authController.driverLogin);
router.post('/driver/forgot-password', otpLimiter, validate(forgotPasswordValidator), authController.driverForgotPassword);
router.post('/driver/reset-password', validate(resetPasswordValidator), authController.driverResetPassword);
router.post('/driver/refresh-token', validate(refreshTokenValidator), authController.driverRefreshToken);

// Admin auth routes
router.post('/admin/login', authLimiter, validate(loginValidator), authController.adminLogin);
router.post('/admin/refresh-token', validate(refreshTokenValidator), authController.adminRefreshToken);

// Logout
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
```

### File: `src/routes/user.routes.js`

Define all user routes with proper middleware and validation.

### File: `src/routes/driver.routes.js`

Define all driver routes with authentication and approval checks.

### File: `src/routes/admin.routes.js`

Define all admin routes with admin role verification.

### File: `src/routes/utils.routes.js`

Define utility routes (some can be public, some protected).

---

## BACKGROUND JOBS

### File: `src/jobs/booking.job.js`

```javascript
const cron = require('node-cron');
const Booking = require('../models/Booking');
const { BOOKING_STATUS } = require('../config/constants');
const notificationService = require('../services/notification.service');

// Run every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();

    // 1. Expire booking requests that haven't been accepted
    const expiredRequests = await Booking.find({
      status: BOOKING_STATUS.REQUESTED,
      requestExpiresAt: { $lte: now }
    });

    for (const booking of expiredRequests) {
      booking.status = BOOKING_STATUS.CANCELLED_BY_DRIVER;
      booking.cancellationDetails = {
        cancelledBy: 'system',
        reason: 'No driver accepted within 1 minute',
        cancelledAt: now
      };
      await booking.save();

      // Notify user
      await notificationService.notifyBookingCancelled(
        booking.userId,
        null,
        booking._id,
        'No driver available',
        'system'
      );
    }

    // 2. Cancel bookings where payment not completed within 5 minutes
    const expiredPayments = await Booking.find({
      status: BOOKING_STATUS.ACCEPTED,
      paymentExpiresAt: { $lte: now }
    });

    for (const booking of expiredPayments) {
      booking.status = BOOKING_STATUS.CANCELLED_BY_USER;
      booking.cancellationDetails = {
        cancelledBy: 'system',
        reason: 'Payment not completed within 5 minutes',
        cancelledAt: now
      };
      await booking.save();

      // Notify both user and driver
      await notificationService.notifyBookingCancelled(
        booking.userId,
        booking.driverId,
        booking._id,
        'Payment timeout',
        'system'
      );
    }

    console.log(`Booking job completed: ${expiredRequests.length} requests expired, ${expiredPayments.length} payment timeouts`);
  } catch (error) {
    console.error('Booking job error:', error);
  }
});

console.log('Booking expiry job scheduled');
```

### File: `src/jobs/cleanup.job.js`

```javascript
const cron = require('node-cron');
const OTP = require('../models/OTP');
const Notification = require('../models/Notification');

// Run daily at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    // Delete old verified OTPs (older than 1 day)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await OTP.deleteMany({
      isVerified: true,
      createdAt: { $lt: oneDayAgo }
    });

    // Delete old read notifications (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await Notification.deleteMany({
      isRead: true,
      createdAt: { $lt: thirtyDaysAgo }
    });

    console.log('Cleanup job completed successfully');
  } catch (error) {
    console.error('Cleanup job error:', error);
  }
});

console.log('Cleanup job scheduled');
```

---

## SCRIPTS

### File: `scripts/createAdmin.js`

```javascript
require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../src/models/User');
const { hashPassword } = require('../src/utils/helpers');
const { ROLES } = require('../src/config/constants');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdmin() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get admin details
    const username = await question('Enter admin username: ');
    const password = await question('Enter admin password: ');
    const firstName = await question('Enter first name: ');
    const lastName = await question('Enter last name: ');
    const phoneNumber = await question('Enter phone number (+974XXXXXXXX): ');
    const email = await question('Enter email: ');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ username });
    if (existingAdmin) {
      console.log('Admin with this username already exists!');
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create admin user
    const admin = await User.create({
      username,
      password: hashedPassword,
      phoneNumber,
      role: ROLES.ADMIN,
      isVerified: true,
      isActive: true,
      profile: {
        firstName,
        lastName,
        email
      }
    });

    console.log('\\n✅ Admin user created successfully!');
    console.log('Username:', admin.username);
    console.log('Role:', admin.role);

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

createAdmin();
```

### File: `scripts/seed.js`

```javascript
require('dotenv').config();
const mongoose = require('mongoose');
const PricingConfig = require('../src/models/PricingConfig');
const AdminSettings = require('../src/models/AdminSettings');
const { VEHICLE_TYPES } = require('../src/config/constants');

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Seed pricing configurations
    const pricingData = [
      {
        vehicleType: VEHICLE_TYPES.SMALL_CAR,
        basePrice: 40,
        perKmRate: 3,
        minimumFare: 40,
        serviceFeePercentage: 10,
        driverCommissionPercentage: 80
      },
      {
        vehicleType: VEHICLE_TYPES.SEDAN,
        basePrice: 50,
        perKmRate: 5,
        minimumFare: 50,
        serviceFeePercentage: 10,
        driverCommissionPercentage: 80
      },
      {
        vehicleType: VEHICLE_TYPES.SUV,
        basePrice: 70,
        perKmRate: 7,
        minimumFare: 70,
        serviceFeePercentage: 10,
        driverCommissionPercentage: 80
      },
      {
        vehicleType: VEHICLE_TYPES.TRUCK,
        basePrice: 100,
        perKmRate: 10,
        minimumFare: 100,
        serviceFeePercentage: 10,
        driverCommissionPercentage: 80
      },
      {
        vehicleType: VEHICLE_TYPES.HEAVY_VEHICLE,
        basePrice: 150,
        perKmRate: 15,
        minimumFare: 150,
        serviceFeePercentage: 10,
        driverCommissionPercentage: 80
      }
    ];

    for (const pricing of pricingData) {
      await PricingConfig.findOneAndUpdate(
        { vehicleType: pricing.vehicleType },
        pricing,
        { upsert: true, new: true }
      );
    }

    console.log('✅ Pricing configurations seeded');

    // Seed admin settings
    const settings = [
      { settingKey: 'DEFAULT_SEARCH_RADIUS', settingValue: 10, description: 'Default search radius in km' },
      { settingKey: 'BOOKING_REQUEST_TIMEOUT', settingValue: 60, description: 'Booking request timeout in seconds' },
      { settingKey: 'PAYMENT_TIMEOUT', settingValue: 300, description: 'Payment timeout in seconds' },
      { settingKey: 'PLATFORM_COMMISSION_PERCENTAGE', settingValue: 20, description: 'Platform commission percentage' },
      { settingKey: 'MINIMUM_WITHDRAWAL_AMOUNT', settingValue: 100, description: 'Minimum withdrawal amount in QAR' },
      { settingKey: 'COMPANY_NAME', settingValue: 'RESQ Towing Services', description: 'Company name' },
      { settingKey: 'COMPANY_EMAIL', settingValue: 'support@resq.qa', description: 'Company email' },
      { settingKey: 'COMPANY_PHONE', settingValue: '+974XXXXXXXX', description: 'Company phone' }
    ];

    for (const setting of settings) {
      await AdminSettings.findOneAndUpdate(
        { settingKey: setting.settingKey },
        setting,
        { upsert: true, new: true }
      );
    }

    console.log('✅ Admin settings seeded');

    console.log('\\n✅ Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
```

---

## NEXT STEPS

1. **Implement all controller files** following the structure outlined above
2. **Create all route files** with proper middleware chain
3. **Test each endpoint** using Postman
4. **Set up MongoDB** locally or on Atlas
5. **Configure third-party services** (Twilio, Google Maps, Al Fatoorah)
6. **Run database seed** script
7. **Create admin user**
8. **Start development server** and test

---

## Testing Checklist

- [ ] User signup and OTP verification
- [ ] User login and token refresh
- [ ] Driver registration and document upload
- [ ] Admin driver approval workflow
- [ ] Booking creation and driver search
- [ ] Driver accepts booking
- [ ] Payment integration
- [ ] Trip start and completion
- [ ] Earnings calculation
- [ ] Withdrawal requests
- [ ] Admin dashboard statistics
- [ ] Notifications system
- [ ] Background jobs execution

---

## Additional Enhancements (Future)

1. **Real-time Updates:** Implement Socket.io for live location tracking
2. **Push Notifications:** Integrate FCM for mobile push notifications
3. **Rating System:** Add rating and reviews for drivers
4. **Surge Pricing:** Implement dynamic pricing based on demand
5. **Promo Codes:** Add coupon and discount system
6. **Driver Verification:** Add additional verification layers
7. **Analytics Dashboard:** Advanced analytics with charts
8. **Mobile App Integration:** Build React Native apps
9. **Unit Tests:** Add comprehensive test coverage
10. **CI/CD Pipeline:** Automate deployment

---

**Implementation Status:** Base structure completed. Controllers, routes, and remaining business logic need to be implemented following this guide.
