# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RESQ is a production-ready tow car service platform backend API connecting users with tow truck drivers in Qatar. Built with Node.js, Express.js, and MongoDB with Mongoose ODM. Uses JWT authentication (access + refresh tokens), Twilio for OTP verification, Google Maps API for geolocation, and Al Fatoorah payment gateway.

## Development Commands

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Create admin user (interactive prompt)
npm run create-admin

# Seed database with sample data
npm run seed

# Test API health
curl http://localhost:5000/health
```

## Architecture Overview

### Three-Tier Role System
- **Users**: Request tow services, make payments, track drivers
- **Drivers**: Accept requests, complete trips, manage earnings
- **Admins**: Approve drivers, manage platform, view analytics

### Authentication Flow
1. Phone-based signup with Twilio OTP (5 min expiry, 3 max attempts)
2. JWT dual-token system: Access token (15 min) + Refresh token (7 days)
3. Refresh tokens stored in User/Driver models
4. Driver accounts require admin approval before accessing protected routes

### Booking Lifecycle
1. `requested` - User creates request, expires in 60 seconds if not accepted
2. `accepted` - Driver accepts, payment must complete within 5 minutes
3. `payment_completed` - User pays via Al Fatoorah
4. `driver_arrived` - Driver marks arrival
5. `in_progress` - Trip started
6. `completed` - Trip finished, earnings distributed

Cancellation states: `cancelled_by_user`, `cancelled_by_driver`

### Payment Distribution
- Total = Base Price + (Distance × Per Km Rate) + Service Fee
- Platform Commission: Configurable % (default 20%)
- Driver Earnings: Total - Platform Commission
- All transactions logged in Transaction model

### Geospatial Architecture
MongoDB geospatial indexes on Driver `currentLocation.coordinates` and Booking `pickupLocation.coordinates`. Search drivers within radius using `$geoNear` or `$near` operators. Location format: GeoJSON Point with `[longitude, latitude]`.

### Background Jobs
- **Booking Expiry Job** (runs every minute via node-cron):
  - Expires `requested` bookings after 60 seconds
  - Cancels `accepted` bookings if payment incomplete after 5 minutes
  - Located in `src/jobs/booking.job.js`

## Code Structure

```
src/
├── app.js                 # Express app setup, middleware, route mounting
├── config/                # DB, Twilio, Google Maps, payment configs, constants
├── models/                # Mongoose schemas (User, Driver, Booking, etc.)
├── controllers/           # Route handlers (NOT YET IMPLEMENTED - see IMPLEMENTATION_GUIDE.md)
├── routes/                # Express route definitions (placeholders - need controllers)
├── middlewares/           # auth.js, errorHandler.js, rateLimiter.js, upload.js, validate.js
├── services/              # Business logic (maps, notifications, OTP, SMS)
├── utils/                 # helpers.js, validators.js, errors.js
└── jobs/                  # booking.job.js (cron jobs)

scripts/                   # createAdmin.js, seed.js
uploads/                   # Multer file upload destination
```

### Key Models
- **User**: phoneNumber (unique), username, password (hashed), role, refreshToken
- **Driver**: extends User model, adds vehicleDetails, documents, approvalStatus, bankDetails, currentLocation (GeoJSON), isOnline, wallet
- **Booking**: bookingNumber, userId, driverId, status, vehicleType, pickupLocation (GeoJSON), dropoffLocation (GeoJSON), pricing, payment, timeline
- **PricingConfig**: vehicleType, basePrice, perKmRate, minimumFare, serviceFeePercentage, driverCommissionPercentage
- **Transaction**: transactionId, userId/driverId, type, amount, status

### Middleware Chain
1. `helmet()` - Security headers
2. `cors()` - Configurable CORS (default: *)
3. `express.json()` - Body parser
4. `generalLimiter` - Rate limiting (100 req/15 min per IP)
5. `authMiddleware` - JWT verification, attaches user to req
6. `roleMiddleware(['role'])` - Authorization check
7. `validate(schema)` - Joi validation
8. `errorHandler` - Global error handler

### Services Layer
- **otp.service.js**: Generate, verify, and cleanup OTPs
- **sms.service.js**: Send SMS via Twilio
- **maps.service.js**: Geocoding, reverse geocoding, distance calculation using Google Maps API
- **notification.service.js**: Create and send notifications to users/drivers

### Constants (`src/config/constants.js`)
Defines all enums: ROLES, VEHICLE_TYPES (small_car, sedan, suv, truck, heavy_vehicle), BOOKING_STATUS, DOCUMENT_STATUS, APPROVAL_STATUS, PAYMENT_STATUS, OTP_PURPOSE, TRANSACTION_TYPE, WITHDRAWAL_STATUS, NOTIFICATION_TYPE

## Implementation Status

**COMPLETE:**
- Models (User, Driver, Booking, Transaction, OTP, Notification, PricingConfig, AdminSettings, DriverWithdrawal)
- Middleware (auth, errorHandler, rateLimiter, upload, validate)
- Services (OTP, SMS, Maps, Notifications)
- Utilities (helpers, validators, errors)
- Background jobs (booking expiry)
- Database config and seeding scripts

**INCOMPLETE (See IMPLEMENTATION_GUIDE.md):**
- All controllers (auth, user, driver, admin, utils)
- Full route implementations (currently placeholders)
- Driver document upload logic
- Payment gateway integration
- Real-time driver tracking
- Withdrawal processing

## Working with Files

### Adding New Controllers
Controllers must be created in `src/controllers/`. Reference IMPLEMENTATION_GUIDE.md for exact function signatures. Always use `express-async-handler` to wrap async functions. Use services layer for business logic.

Example structure:
```javascript
const asyncHandler = require('express-async-handler');
const Model = require('../models/Model');

exports.methodName = asyncHandler(async (req, res) => {
  // Implementation
  res.json({ success: true, data });
});
```

### Route Pattern
Routes in `src/routes/*.routes.js` follow REST conventions:
- POST /auth/{role}/signup
- POST /auth/{role}/login
- GET /user/profile (protected)
- PUT /driver/status (protected)
- GET /admin/dashboard/stats (protected, admin only)

Mount routes in `src/app.js` with `/api/v1` prefix.

### Database Queries
Use Mongoose methods. For geospatial queries on drivers:
```javascript
Driver.find({
  currentLocation: {
    $near: {
      $geometry: { type: 'Point', coordinates: [lng, lat] },
      $maxDistance: radiusInMeters
    }
  },
  isOnline: true,
  approvalStatus: 'approved'
});
```

### File Uploads
Use `upload` middleware from `src/middlewares/upload.js`. Configured with Multer, stores in `./uploads/`, 5MB max. Use `upload.single('field')` or `upload.fields([{name, maxCount}])`.

### Error Handling
Import custom errors from `src/utils/errors.js`:
- `ValidationError(message)` - 400
- `AuthenticationError(message)` - 401
- `AuthorizationError(message)` - 403
- `NotFoundError(message)` - 404

Throw errors; global errorHandler catches them.

## Environment Configuration

Required variables in `.env`:
- NODE_ENV, PORT
- MONGODB_URI
- JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- GOOGLE_MAPS_API_KEY
- AL_FATOORAH_API_KEY, AL_FATOORAH_BASE_URL
- DEFAULT_SEARCH_RADIUS, BOOKING_REQUEST_TIMEOUT, PAYMENT_TIMEOUT, PLATFORM_COMMISSION_PERCENTAGE

See `.env.example` for full list.

## Common Patterns

### Phone Number Format
Qatar country code: +974. Store with country code. Validate using `validators.phoneNumberValidator`.

### Password Requirements
Minimum 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special char. Validate with `validators.passwordValidator`.

### Pagination
Use constants: `PAGINATION.DEFAULT_PAGE = 1`, `PAGINATION.DEFAULT_LIMIT = 10`, `PAGINATION.MAX_LIMIT = 100`

### Response Format
Success:
```json
{ "success": true, "data": {}, "message": "" }
```

Error:
```json
{ "success": false, "error": "Error message" }
```

### Token Generation
Use helpers from `src/utils/helpers.js`:
- `generateAccessToken(userId, role)`
- `generateRefreshToken(userId, role)`
- `hashPassword(password)`
- `comparePassword(password, hash)`

## Testing

No automated tests yet. Use Postman collection (`POSTMAN_COLLECTION.json`) for manual API testing.

## Deployment Notes

- Set strong JWT secrets in production
- Use MongoDB Atlas for production database
- Configure production Twilio account with verified numbers
- Enable Google Maps API billing
- Switch Al Fatoorah to production URL
- Set NODE_ENV=production
- Enable HTTPS
- Restrict CORS_ORIGIN to specific domains
- Set up monitoring (logs, error tracking)
- Configure automated backups for MongoDB
