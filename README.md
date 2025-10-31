# RESQ Backend API

Complete production-ready backend API for RESQ - a tow car service platform connecting users with tow truck drivers in Qatar.

## 🚀 Technology Stack

- **Runtime:** Node.js (Latest LTS)
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT (Access + Refresh Token)
- **SMS Service:** Twilio (OTP verification)
- **Maps:** Google Maps API
- **Payment:** Al Fatoorah Payment Gateway
- **Security:** Helmet, Rate Limiting, Input Validation, CORS

## 📁 Project Structure

```
resq-backend/
├── src/
│   ├── config/          # Configuration files
│   ├── models/          # Mongoose models
│   ├── controllers/     # Route controllers
│   ├── routes/          # API routes
│   ├── middlewares/     # Custom middlewares
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── jobs/            # Background cron jobs
├── uploads/             # File uploads directory
├── scripts/             # Utility scripts
├── .env                 # Environment variables
└── package.json
```

## 🔧 Installation

1. **Clone the repository**
```bash
cd Desktop
cd resq-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Copy `.env.example` to `.env` and fill in your configuration:
```bash
cp .env.example .env
```

4. **Set up MongoDB**
- Install MongoDB locally or use MongoDB Atlas
- Update `MONGODB_URI` in `.env`

5. **Configure Third-Party Services**
- **Twilio:** Sign up at twilio.com and get credentials
- **Google Maps:** Get API key from Google Cloud Console
- **Al Fatoorah:** Get API credentials for Qatar payment gateway

## 🏃 Running the Application

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

**Create Admin User:**
```bash
npm run create-admin
```

**Seed Database:**
```bash
npm run seed
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api/v1
```

### Authentication

All protected routes require Bearer token:
```
Authorization: Bearer <access_token>
```

---

## 🔐 Authentication Endpoints

### User Authentication

#### 1. User Signup (Send OTP)
```http
POST /auth/user/signup
Content-Type: application/json

{
  "phoneNumber": "+97431234567"
}
```

#### 2. Verify OTP & Create Account
```http
POST /auth/user/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+97431234567",
  "otp": "123456",
  "username": "johndoe",
  "password": "Pass@1234",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}
```

#### 3. User Login
```http
POST /auth/user/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "Pass@1234"
}
```

#### 4. Forgot Password
```http
POST /auth/user/forgot-password
Content-Type: application/json

{
  "phoneNumber": "+97431234567"
}
```

#### 5. Reset Password
```http
POST /auth/user/reset-password
Content-Type: application/json

{
  "phoneNumber": "+97431234567",
  "otp": "123456",
  "newPassword": "NewPass@1234"
}
```

#### 6. Refresh Access Token
```http
POST /auth/user/refresh-token
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

### Driver Authentication

Same endpoints as user but with `/auth/driver/*` prefix.

Additional endpoint for document submission:
```http
POST /auth/driver/submit-documents
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "vehicleType": "sedan",
  "vehicleNumber": "ABC123",
  "vehicleMake": "Toyota",
  "vehicleModel": "Camry",
  "vehicleYear": 2022,
  "vehicleColor": "White",
  "drivingLicense": <file>,
  "vehicleRegistration": <file>,
  "insurance": <file>,
  "nationalId": <file>
}
```

### Admin Authentication

```http
POST /auth/admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "AdminPass@1234"
}
```

---

## 👤 User Endpoints

All user endpoints require authentication and user role.

### Profile Management

#### Get Profile
```http
GET /user/profile
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /user/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}
```

#### Upload Profile Picture
```http
PUT /user/profile/picture
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "profileImage": <file>
}
```

### Booking Management

#### Search Nearby Drivers
```http
POST /user/booking/search-drivers
Authorization: Bearer <token>
Content-Type: application/json

{
  "vehicleType": "sedan",
  "pickupLocation": {
    "latitude": 25.2854,
    "longitude": 51.5310
  },
  "searchRadius": 10
}
```

#### Create Booking Request
```http
POST /user/booking/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "vehicleType": "sedan",
  "pickupLocation": {
    "latitude": 25.2854,
    "longitude": 51.5310,
    "address": "The Pearl Qatar",
    "placeName": "The Pearl"
  },
  "dropoffLocation": {
    "latitude": 25.3548,
    "longitude": 51.1839,
    "address": "Lusail City",
    "placeName": "Lusail"
  },
  "notes": "Red Toyota Camry"
}
```

#### Get Booking Details
```http
GET /user/booking/:bookingId
Authorization: Bearer <token>
```

#### Cancel Booking
```http
PUT /user/booking/:bookingId/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Changed plans"
}
```

#### Track Driver Location
```http
GET /user/booking/:bookingId/track-driver
Authorization: Bearer <token>
```

#### Initiate Payment
```http
POST /user/booking/:bookingId/payment
Authorization: Bearer <token>
```

#### Get Booking History
```http
GET /user/bookings/history?page=1&limit=10
Authorization: Bearer <token>
```

### Notifications

#### Get Notifications
```http
GET /user/notifications?page=1&limit=20
Authorization: Bearer <token>
```

#### Mark as Read
```http
PUT /user/notifications/:id/read
Authorization: Bearer <token>
```

---

## 🚗 Driver Endpoints

All driver endpoints require authentication and driver role.

### Profile & Status

#### Get Driver Profile
```http
GET /driver/profile
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /driver/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Ali",
  "lastName": "Hassan"
}
```

#### Update Vehicle Details
```http
PUT /driver/vehicle
Authorization: Bearer <token>
Content-Type: application/json

{
  "vehicleType": "suv",
  "vehicleNumber": "XYZ789",
  "vehicleColor": "Black"
}
```

#### Update Bank Details
```http
PUT /driver/bank-details
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountHolderName": "Ali Hassan",
  "bankName": "Qatar National Bank",
  "accountNumber": "1234567890",
  "iban": "QA12XXXX1234567890"
}
```

#### Toggle Online/Offline Status
```http
PUT /driver/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "isOnline": true
}
```

#### Update Current Location
```http
PUT /driver/location
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 25.2854,
  "longitude": 51.5310,
  "address": "Doha, Qatar"
}
```

### Booking Management

#### Get Incoming Booking Requests
```http
GET /driver/bookings/incoming
Authorization: Bearer <token>
```

#### Accept Booking
```http
PUT /driver/bookings/:bookingId/accept
Authorization: Bearer <token>
```

#### Cancel Booking
```http
PUT /driver/bookings/:bookingId/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Vehicle breakdown"
}
```

#### Mark Arrived at Pickup
```http
PUT /driver/bookings/:bookingId/arrived
Authorization: Bearer <token>
```

#### Start Trip
```http
PUT /driver/bookings/:bookingId/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "actualDropoffLocation": {
    "latitude": 25.3548,
    "longitude": 51.1839,
    "address": "Final destination"
  }
}
```

#### Complete Trip
```http
PUT /driver/bookings/:bookingId/complete
Authorization: Bearer <token>
```

#### Get Active Trip
```http
GET /driver/trips/active
Authorization: Bearer <token>
```

#### Get Trip History
```http
GET /driver/trips/history?page=1&limit=10
Authorization: Bearer <token>
```

### Earnings & Wallet

#### Get Earnings Summary
```http
GET /driver/earnings
Authorization: Bearer <token>
```

#### Get Wallet Balance
```http
GET /driver/wallet
Authorization: Bearer <token>
```

#### Request Withdrawal
```http
POST /driver/wallet/withdraw
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 500
}
```

#### Get Transaction History
```http
GET /driver/transactions?page=1&limit=10
Authorization: Bearer <token>
```

---

## 🛡️ Admin Endpoints

All admin endpoints require authentication and admin role.

### Dashboard

#### Get Dashboard Statistics
```http
GET /admin/dashboard/stats
Authorization: Bearer <token>
```

#### Get Analytics Data
```http
GET /admin/dashboard/analytics?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

### User Management

#### List All Users
```http
GET /admin/users?page=1&limit=10&search=john&role=user
Authorization: Bearer <token>
```

#### Get User Details
```http
GET /admin/users/:userId
Authorization: Bearer <token>
```

#### Update User Status
```http
PUT /admin/users/:userId/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "isActive": false
}
```

#### Delete User
```http
DELETE /admin/users/:userId
Authorization: Bearer <token>
```

### Driver Management

#### List All Drivers
```http
GET /admin/drivers?page=1&limit=10&approvalStatus=pending
Authorization: Bearer <token>
```

#### Get Driver Details
```http
GET /admin/drivers/:driverId
Authorization: Bearer <token>
```

#### Approve Driver
```http
PUT /admin/drivers/:driverId/approve
Authorization: Bearer <token>
```

#### Reject Driver
```http
PUT /admin/drivers/:driverId/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Incomplete documents"
}
```

#### View Driver Documents
```http
GET /admin/drivers/:driverId/documents
Authorization: Bearer <token>
```

#### Approve/Reject Specific Document
```http
PUT /admin/drivers/:driverId/documents/:docType/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "approved"
}
```

### Booking Management

#### List All Bookings
```http
GET /admin/bookings?page=1&limit=10&status=completed&startDate=2024-01-01
Authorization: Bearer <token>
```

#### Get Booking Details
```http
GET /admin/bookings/:bookingId
Authorization: Bearer <token>
```

#### Get Live Bookings
```http
GET /admin/bookings/live
Authorization: Bearer <token>
```

#### Cancel Booking (Admin)
```http
PUT /admin/bookings/:bookingId/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "System issue"
}
```

### Financial Management

#### Get All Transactions
```http
GET /admin/transactions?page=1&limit=10&type=booking_payment
Authorization: Bearer <token>
```

#### Get Revenue Reports
```http
GET /admin/revenue?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

#### Get Withdrawal Requests
```http
GET /admin/withdrawals?status=pending
Authorization: Bearer <token>
```

#### Approve Withdrawal
```http
PUT /admin/withdrawals/:id/approve
Authorization: Bearer <token>
```

#### Reject Withdrawal
```http
PUT /admin/withdrawals/:id/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Invalid bank details"
}
```

### Pricing Management

#### Get All Pricing Configs
```http
GET /admin/pricing
Authorization: Bearer <token>
```

#### Create Pricing Config
```http
POST /admin/pricing
Authorization: Bearer <token>
Content-Type: application/json

{
  "vehicleType": "sedan",
  "basePrice": 50,
  "perKmRate": 5,
  "minimumFare": 50,
  "serviceFeePercentage": 10,
  "driverCommissionPercentage": 80
}
```

#### Update Pricing
```http
PUT /admin/pricing/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "basePrice": 60,
  "perKmRate": 6
}
```

#### Delete Pricing Config
```http
DELETE /admin/pricing/:id
Authorization: Bearer <token>
```

### Settings

#### Get All Settings
```http
GET /admin/settings
Authorization: Bearer <token>
```

#### Update Settings
```http
PUT /admin/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "DEFAULT_SEARCH_RADIUS": 15,
  "PLATFORM_COMMISSION_PERCENTAGE": 25
}
```

### Notifications

#### Broadcast Notification
```http
POST /admin/notifications/broadcast
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetRole": "driver",
  "title": "System Maintenance",
  "message": "System will be down for maintenance on Sunday"
}
```

#### Send to Specific User/Driver
```http
POST /admin/notifications/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "user_id_here",
  "title": "Account Alert",
  "message": "Your account requires attention"
}
```

---

## 🛠️ Utility Endpoints

### Geocoding

#### Geocode Address
```http
POST /utils/geocode
Content-Type: application/json

{
  "address": "The Pearl, Doha, Qatar"
}
```

#### Reverse Geocode
```http
POST /utils/reverse-geocode
Content-Type: application/json

{
  "latitude": 25.2854,
  "longitude": 51.5310
}
```

### Distance & Pricing

#### Calculate Distance
```http
POST /utils/calculate-distance
Content-Type: application/json

{
  "origin": {
    "latitude": 25.2854,
    "longitude": 51.5310
  },
  "destination": {
    "latitude": 25.3548,
    "longitude": 51.1839
  }
}
```

#### Calculate Trip Price
```http
POST /utils/calculate-price
Content-Type: application/json

{
  "vehicleType": "sedan",
  "distance": 15.5
}
```

#### Get Vehicle Types
```http
GET /utils/vehicle-types
```

---

## 🔐 Security Features

1. **JWT Authentication:** Access token (15 min) + Refresh token (7 days)
2. **Rate Limiting:** Prevents brute force attacks
3. **Input Validation:** Joi validation on all inputs
4. **Password Hashing:** bcrypt with 10 salt rounds
5. **Helmet.js:** Security headers
6. **CORS:** Properly configured
7. **MongoDB Injection Prevention:** Query sanitization
8. **File Upload Security:** File type and size validation

## 📊 Business Logic

### Booking Flow

1. User searches for nearby drivers
2. User creates booking request (Status: `requested`)
3. Request expires in 1 minute if not accepted
4. Driver accepts request (Status: `accepted`)
5. User must complete payment within 5 minutes
6. After payment (Status: `payment_completed`)
7. Driver arrives (Status: `driver_arrived`)
8. Driver starts trip (Status: `in_progress`)
9. Driver completes trip (Status: `completed`)

### Payment Split

- Total Amount = Base Price + (Distance × Per Km Rate) + Service Fee
- Driver Earnings = Total Amount - Platform Commission
- Commission transferred to platform account

### Driver Approval

1. Driver signs up and submits documents
2. Status: `pending`
3. Admin reviews documents
4. Status: `approved` or `rejected`
5. Only approved drivers can go online and accept bookings

## 🤖 Background Jobs

### Booking Expiry Job (runs every minute)

- Expires booking requests after 1 minute if not accepted
- Cancels bookings if payment not completed within 5 minutes
- Cleans up old OTPs

## 📝 Environment Variables

See `.env.example` for all required environment variables.

## 🚀 Deployment

### Production Checklist

- [ ] Set strong JWT secrets
- [ ] Configure production MongoDB URI
- [ ] Set up production Twilio account
- [ ] Enable Google Maps API with billing
- [ ] Configure Al Fatoorah production credentials
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS
- [ ] Configure proper CORS origin
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy

## 📞 Support

For issues and questions, contact the development team.

## 📄 License

MIT License

---

**Built with ❤️ by RESQ Team**
