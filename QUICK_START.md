# RESQ Backend - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites
- Node.js 18+ installed
- MongoDB installed locally or MongoDB Atlas account
- Code editor (VS Code recommended)

---

## Step 1: Install Dependencies

```bash
cd Desktop/resq-backend
npm install
```

---

## Step 2: Configure Environment

The `.env` file is already created with default values. Update the following:

1. **MongoDB Connection**
   ```
   MONGODB_URI=mongodb://localhost:27017/resq-platform
   ```
   Or use MongoDB Atlas connection string.

2. **JWT Secrets** (Change these in production!)
   ```
   JWT_ACCESS_SECRET=your_strong_secret_here
   JWT_REFRESH_SECRET=your_strong_refresh_secret_here
   ```

3. **Optional: Third-Party Services**
   - Twilio (for SMS OTP)
   - Google Maps API (for location services)
   - Al Fatoorah (for payments)

   You can leave these as placeholders for initial testing.

---

## Step 3: Seed Database

```bash
npm run seed
```

This will:
- Create pricing configurations for all vehicle types
- Set up admin settings
- Initialize system defaults

---

## Step 4: Create Admin User

```bash
npm run create-admin
```

Follow the prompts to create your admin account:
- Username: `admin`
- Password: `Admin@12345` (use strong password in production)
- Phone: `+97431234567`
- Name: Your name
- Email: Your email

---

## Step 5: Start the Server

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Server will start at: `http://localhost:5000`

---

## ✅ Verify Installation

### 1. Check Health Endpoint
```bash
curl http://localhost:5000/health
```

Should return:
```json
{
  "success": true,
  "message": "RESQ Backend API is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "development"
}
```

### 2. Check Route Status
```bash
curl http://localhost:5000/api/v1/auth/status
```

---

## 📁 Project Structure Overview

```
resq-backend/
├── src/
│   ├── config/          ✅ Database, Twilio, Maps, Payment configs
│   ├── models/          ✅ Mongoose schemas (User, Driver, Booking, etc.)
│   ├── controllers/     ⚠️  TO BE IMPLEMENTED (see IMPLEMENTATION_GUIDE.md)
│   ├── routes/          ✅ Route placeholders created
│   ├── middlewares/     ✅ Auth, validation, error handling, rate limiting
│   ├── services/        ✅ OTP, SMS, Maps, Notification services
│   ├── utils/           ✅ Helpers, validators, error classes
│   ├── jobs/            ✅ Background cron jobs
│   └── app.js           ✅ Main Express application
├── scripts/             ✅ Seed and admin creation scripts
├── uploads/             📁 File uploads directory
├── .env                 ✅ Environment configuration
├── .env.example         ✅ Environment template
└── package.json         ✅ Dependencies and scripts
```

---

## 🔧 Next Steps: Implement Controllers

The base infrastructure is complete. Now implement the business logic:

### Priority 1: Authentication Controllers
File: `src/controllers/auth.controller.js`

Implement:
- User signup/login
- Driver signup/login
- Admin login
- OTP verification
- Password reset

**Reference:** See `IMPLEMENTATION_GUIDE.md` for detailed specifications

---

### Priority 2: User Controllers
File: `src/controllers/user.controller.js`

Implement:
- Profile management
- Search drivers
- Create booking
- Payment integration
- Booking history

---

### Priority 3: Driver Controllers
File: `src/controllers/driver.controller.js`

Implement:
- Profile and status management
- Accept/reject bookings
- Trip management
- Earnings and withdrawals

---

### Priority 4: Admin Controllers
File: `src/controllers/admin.controller.js`

Implement:
- Dashboard statistics
- User/Driver management
- Booking management
- Financial reports
- System settings

---

## 🧪 Testing Workflow

### 1. Test User Registration
```bash
POST http://localhost:5000/api/v1/auth/user/signup
Content-Type: application/json

{
  "phoneNumber": "+97431234567"
}
```

### 2. Test Admin Login
```bash
POST http://localhost:5000/api/v1/auth/admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin@12345"
}
```

### 3. Use Postman or Thunder Client
Import the API endpoints from `README.md` into your API testing tool.

---

## 📊 Database Models Available

✅ **User Model** - Users with role-based access
✅ **Driver Model** - Driver profiles with location and earnings
✅ **Booking Model** - Booking requests and trips
✅ **OTP Model** - OTP verification with TTL
✅ **PricingConfig Model** - Dynamic pricing per vehicle type
✅ **Transaction Model** - Financial transactions
✅ **Notification Model** - Push notifications
✅ **DriverWithdrawal Model** - Withdrawal requests
✅ **AdminSettings Model** - System configuration

---

## 🔐 Security Features Implemented

✅ JWT Authentication (Access + Refresh tokens)
✅ Password hashing with bcrypt
✅ Rate limiting on all endpoints
✅ Input validation with Joi
✅ Helmet.js security headers
✅ CORS configuration
✅ MongoDB injection prevention
✅ File upload security
✅ Role-based access control

---

## 🛠️ Available Services

✅ **OTP Service** - Generate and verify OTPs
✅ **SMS Service** - Send SMS via Twilio
✅ **Maps Service** - Geocoding and distance calculation
✅ **Notification Service** - Create and manage notifications
✅ **Payment Service** - Al Fatoorah integration

---

## 📝 Development Tips

### 1. Hot Reload
When using `npm run dev`, nodemon will automatically restart on file changes.

### 2. MongoDB GUI
Use MongoDB Compass to visually inspect your database:
```
mongodb://localhost:27017/resq-platform
```

### 3. Environment Variables
Never commit `.env` to version control. Use `.env.example` as template.

### 4. Error Logs
Check console output for detailed error messages in development mode.

### 5. API Documentation
See `README.md` for complete API endpoint documentation.

---

## 🐛 Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running: `mongod` or check Atlas connection
- Verify `MONGODB_URI` in `.env`

### Port Already in Use
- Change `PORT` in `.env`
- Or kill process: `npx kill-port 5000`

### Module Not Found
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then `npm install`

### OTP Not Sending
- Check Twilio credentials in `.env`
- In development mode, OTP is printed to console

### File Upload Errors
- Ensure `uploads/` directory exists
- Check file size limits in `.env`

---

## 📖 Documentation Files

1. **README.md** - Complete API documentation with all endpoints
2. **IMPLEMENTATION_GUIDE.md** - Detailed controller implementation specs
3. **QUICK_START.md** - This file (getting started guide)

---

## 🎯 Implementation Checklist

### Phase 1: Core Features
- [ ] Implement auth controllers
- [ ] Implement user controllers (booking flow)
- [ ] Implement driver controllers (trip management)
- [ ] Test complete booking workflow

### Phase 2: Admin Panel
- [ ] Implement admin controllers
- [ ] Dashboard statistics
- [ ] User/Driver approval system
- [ ] Financial management

### Phase 3: Production Ready
- [ ] Add comprehensive error handling
- [ ] Write unit tests
- [ ] Set up logging system
- [ ] Deploy to production

---

## 🚀 Running in Production

### 1. Set Environment to Production
```bash
NODE_ENV=production
```

### 2. Use Strong Secrets
Generate strong JWT secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Enable HTTPS
Use nginx or similar reverse proxy.

### 4. Configure CORS
Set specific origin in `.env`:
```
CORS_ORIGIN=https://yourdomain.com
```

### 5. Set up Process Manager
```bash
npm install -g pm2
pm2 start src/app.js --name resq-backend
pm2 startup
pm2 save
```

---

## 📞 Support & Resources

- **Project Repository:** See your repository for updates
- **Documentation:** Check `README.md` and `IMPLEMENTATION_GUIDE.md`
- **Issues:** Track implementation progress and bugs

---

## 🎉 You're All Set!

The RESQ backend foundation is ready. Follow the `IMPLEMENTATION_GUIDE.md` to implement all controllers and complete the system.

**Happy Coding! 🚗💨**
