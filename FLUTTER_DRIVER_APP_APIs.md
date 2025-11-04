# Flutter Driver App - API Integration Guide

This document lists all APIs required for the Flutter driver mobile application.

---

## Base URL
```
Production: https://your-domain.com/api/v1
Development: http://localhost:5000/api/v1
```

---

## 1. AUTHENTICATION APIs

### 1.1 Driver Signup - Send OTP
**Endpoint:** `POST /auth/driver/signup`

**Request Body:**
```json
{
  "phoneNumber": "+97412345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully to your phone number",
  "data": {
    "phoneNumber": "+97412345678",
    "expiresIn": "5 minutes"
  }
}
```

**Purpose:** Send OTP to driver's phone number to begin signup process.

---

### 1.2 Driver Verify OTP
**Endpoint:** `POST /auth/driver/verify-otp`

**Request Body:**
```json
{
  "phoneNumber": "+97412345678",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "phoneNumber": "+97412345678",
    "isVerified": true
  }
}
```

**Purpose:** Verify OTP before completing signup.

---

### 1.3 Complete Driver Signup
**Endpoint:** `POST /auth/driver/complete-signup`

**Request Body:**
```json
{
  "phoneNumber": "+97412345678",
  "username": "driver123",
  "password": "Driver@123",
  "firstName": "Ahmed",
  "lastName": "Ali",
  "email": "ahmed@example.com",
  "vehicleType": "sedan",
  "vehicleNumber": "ABC123",
  "vehicleMake": "Toyota",
  "vehicleModel": "Camry",
  "vehicleYear": 2020,
  "vehicleColor": "White"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Driver account created successfully. Awaiting admin approval.",
  "data": {
    "user": {
      "id": "user_id",
      "phoneNumber": "+97412345678",
      "username": "driver123",
      "role": "driver"
    },
    "driver": {
      "id": "driver_id",
      "approvalStatus": "pending",
      "vehicleDetails": { ... }
    }
  }
}
```

**Purpose:** Complete driver registration with profile and vehicle details.

**Note:** Driver needs admin approval before accepting bookings.

---

### 1.4 Driver Login
**Endpoint:** `POST /auth/driver/login`

**Request Body:**
```json
{
  "phoneNumber": "+97412345678",
  "password": "Driver@123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "phoneNumber": "+97412345678",
      "role": "driver",
      "profile": { ... }
    },
    "driver": {
      "id": "driver_id",
      "approvalStatus": "approved",
      "isOnline": false,
      "vehicleDetails": { ... }
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

**Purpose:** Authenticate driver and receive access tokens.

**Important:**
- Store `accessToken` for API requests (expires in 15 min)
- Store `refreshToken` to get new access token (expires in 7 days)
- Include `Authorization: Bearer <accessToken>` header in all protected routes

---

### 1.5 Refresh Access Token
**Endpoint:** `POST /auth/refresh-token`

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token"
  }
}
```

**Purpose:** Get new access token when current one expires.

---

### 1.6 Logout
**Endpoint:** `POST /auth/logout`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Purpose:** Logout driver and clear refresh tokens.

---

## 2. FCM TOKEN MANAGEMENT APIs

### 2.1 Register/Update FCM Token
**Endpoint:** `POST /api/v1/driver/fcm-token`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "fcmToken": "firebase_device_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "FCM token updated successfully"
}
```

**Purpose:** Register device FCM token to receive push notifications.

**When to Call:**
- After successful login
- When FCM token is refreshed by Firebase
- On app startup if logged in

---

### 2.2 Remove FCM Token
**Endpoint:** `DELETE /api/v1/driver/fcm-token`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "message": "FCM token removed successfully"
}
```

**Purpose:** Remove FCM token on logout.

---

## 3. DRIVER PROFILE APIs

### 3.1 Get Driver Profile
**Endpoint:** `GET /api/v1/driver/profile`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "driver": {
      "id": "driver_id",
      "userId": {
        "phoneNumber": "+97412345678",
        "profile": {
          "firstName": "Ahmed",
          "lastName": "Ali",
          "email": "ahmed@example.com"
        }
      },
      "vehicleDetails": {
        "vehicleType": "sedan",
        "vehicleNumber": "ABC123",
        "vehicleMake": "Toyota",
        "vehicleModel": "Camry",
        "vehicleYear": 2020,
        "vehicleColor": "White"
      },
      "approvalStatus": "approved",
      "isOnline": false,
      "currentLocation": {
        "coordinates": [51.5074, 25.2854],
        "address": "Doha, Qatar"
      },
      "rating": {
        "average": 4.5,
        "totalRatings": 120
      },
      "earnings": {
        "totalEarnings": 5000,
        "availableBalance": 3000,
        "pendingBalance": 500
      }
    }
  }
}
```

**Purpose:** Fetch driver's complete profile information.

---

### 3.2 Update Driver Location
**Endpoint:** `PATCH /api/v1/driver/location`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "latitude": 25.2854,
  "longitude": 51.5074,
  "address": "Doha, Qatar"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Location updated successfully",
  "data": {
    "currentLocation": {
      "coordinates": [51.5074, 25.2854],
      "address": "Doha, Qatar",
      "lastUpdated": "2025-11-04T12:00:00.000Z"
    }
  }
}
```

**Purpose:** Update driver's real-time GPS location.

**Important:**
- Call this API every 10-30 seconds when driver is online
- Rate limited to prevent abuse
- Required for users to find nearby drivers

---

### 3.3 Toggle Online Status
**Endpoint:** `PATCH /api/v1/driver/status`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "isOnline": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Status updated to online",
  "data": {
    "isOnline": true
  }
}
```

**Purpose:** Set driver as online/offline to receive booking requests.

**UI:** Toggle switch in app (Online/Offline).

---

### 3.4 Update Vehicle Details
**Endpoint:** `PATCH /api/v1/driver/vehicle`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "vehicleType": "suv",
  "vehicleNumber": "XYZ789",
  "vehicleMake": "Toyota",
  "vehicleModel": "Land Cruiser",
  "vehicleYear": 2022,
  "vehicleColor": "Black"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Vehicle details updated successfully",
  "data": {
    "vehicleDetails": { ... }
  }
}
```

**Purpose:** Update vehicle information.

---

### 3.5 Get Driver Earnings
**Endpoint:** `GET /api/v1/driver/earnings`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEarnings": 5000,
    "availableBalance": 3000,
    "pendingBalance": 500,
    "recentTransactions": [
      {
        "id": "txn_id",
        "amount": 110,
        "type": "booking_earning",
        "status": "completed",
        "createdAt": "2025-11-04T12:00:00.000Z"
      }
    ]
  }
}
```

**Purpose:** View earnings and transaction history.

---

### 3.6 Update Bank Details
**Endpoint:** `PATCH /api/v1/driver/bank-details`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "accountHolderName": "Ahmed Ali",
  "bankName": "Qatar National Bank",
  "accountNumber": "1234567890",
  "iban": "QA58DOHB00001234567890ABCDEFG"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bank details updated successfully"
}
```

**Purpose:** Set bank account for withdrawals.

---

## 4. BOOKING APIs

### 4.1 Get Available Booking Requests
**Endpoint:** `GET /api/v1/booking/driver/available`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "booking_id",
        "bookingNumber": "BK1730707200123",
        "userId": {
          "phoneNumber": "+97412345678",
          "profile": {
            "firstName": "Mohammed",
            "lastName": "Hassan"
          }
        },
        "vehicleType": "sedan",
        "pickupLocation": {
          "coordinates": [51.5074, 25.2854],
          "address": "Doha, Qatar",
          "placeName": "City Center"
        },
        "dropoffLocation": {
          "coordinates": [51.5174, 25.2954],
          "address": "Al Wakrah, Qatar"
        },
        "pricing": {
          "totalAmount": 110,
          "currency": "USD"
        },
        "status": "requested",
        "requestExpiresAt": "2025-11-04T12:05:00.000Z",
        "createdAt": "2025-11-04T12:04:00.000Z"
      }
    ]
  }
}
```

**Purpose:** Get list of nearby booking requests for driver's vehicle type.

**Note:** Only shows bookings within 10km radius and matching vehicle type.

---

### 4.2 Accept Booking Request
**Endpoint:** `PATCH /api/v1/booking/driver/:bookingId/accept`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**URL Params:**
- `bookingId` - The booking ID to accept

**Response:**
```json
{
  "success": true,
  "message": "Booking accepted successfully",
  "data": {
    "booking": {
      "id": "booking_id",
      "bookingNumber": "BK1730707200123",
      "status": "accepted",
      "userId": { ... },
      "pickupLocation": { ... },
      "dropoffLocation": { ... },
      "pricing": { ... },
      "paymentExpiresAt": "2025-11-04T12:09:00.000Z"
    }
  }
}
```

**Purpose:** Accept a booking request.

**Important:**
- Must accept within 60 seconds of request
- User has 5 minutes to complete payment after acceptance
- Driver cannot accept other bookings until this is completed/cancelled

---

### 4.3 Get Driver's Active Booking
**Endpoint:** `GET /api/v1/booking/driver/active`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "booking_id",
      "bookingNumber": "BK1730707200123",
      "status": "accepted",
      "userId": {
        "phoneNumber": "+97412345678",
        "profile": { ... }
      },
      "vehicleType": "sedan",
      "pickupLocation": { ... },
      "dropoffLocation": { ... },
      "pricing": { ... },
      "timeline": {
        "requestedAt": "2025-11-04T12:00:00.000Z",
        "acceptedAt": "2025-11-04T12:01:00.000Z"
      }
    }
  }
}
```

**Purpose:** Get driver's current active booking (if any).

**Call:** On app startup, after accepting booking, periodically to check status.

---

### 4.4 Mark Driver Arrived at Pickup
**Endpoint:** `PATCH /api/v1/booking/driver/:bookingId/arrived`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**URL Params:**
- `bookingId` - The booking ID

**Response:**
```json
{
  "success": true,
  "message": "Arrival confirmed",
  "data": {
    "booking": {
      "status": "driver_arrived",
      "timeline": {
        "driverArrivedAt": "2025-11-04T12:15:00.000Z"
      }
    }
  }
}
```

**Purpose:** Mark arrival at pickup location.

**UI:** Button "I've Arrived" (only enabled when near pickup location).

---

### 4.5 Start Trip
**Endpoint:** `PATCH /api/v1/booking/driver/:bookingId/start`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**URL Params:**
- `bookingId` - The booking ID

**Response:**
```json
{
  "success": true,
  "message": "Trip started",
  "data": {
    "booking": {
      "status": "in_progress",
      "timeline": {
        "startedAt": "2025-11-04T12:20:00.000Z"
      }
    }
  }
}
```

**Purpose:** Start the towing trip.

**UI:** Button "Start Trip" (after marking arrival).

---

### 4.6 Complete Trip
**Endpoint:** `PATCH /api/v1/booking/driver/:bookingId/complete`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**URL Params:**
- `bookingId` - The booking ID

**Request Body (Optional):**
```json
{
  "actualDropoffLocation": {
    "coordinates": [51.5174, 25.2954],
    "address": "Al Wakrah, Qatar"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Trip completed successfully",
  "data": {
    "booking": {
      "status": "completed",
      "timeline": {
        "completedAt": "2025-11-04T12:45:00.000Z"
      }
    },
    "earnings": 88
  }
}
```

**Purpose:** Complete trip and receive earnings.

**UI:** Button "Complete Trip" (when reached dropoff location).

**Note:** Earnings = Total Amount - Platform Commission (default 20%)

---

### 4.7 Cancel Booking
**Endpoint:** `PATCH /api/v1/booking/driver/:bookingId/cancel`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**URL Params:**
- `bookingId` - The booking ID

**Request Body:**
```json
{
  "reason": "Vehicle breakdown"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "booking": {
      "status": "cancelled_by_driver"
    }
  }
}
```

**Purpose:** Cancel an accepted booking (before completion).

**UI:** Button "Cancel Booking" with reason input.

**Important:** Frequent cancellations may affect driver rating/approval.

---

### 4.8 Get Booking History
**Endpoint:** `GET /api/v1/booking/driver/history?page=1&limit=10&status=completed`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Params:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Results per page (default: 10, max: 100)
- `status` (optional) - Filter by status (completed, cancelled_by_driver, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "booking_id",
        "bookingNumber": "BK1730707200123",
        "status": "completed",
        "userId": { ... },
        "pickupLocation": { ... },
        "dropoffLocation": { ... },
        "pricing": { ... },
        "driverEarnings": 88,
        "timeline": { ... },
        "createdAt": "2025-11-04T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "pages": 5
    }
  }
}
```

**Purpose:** View past bookings and earnings.

---

## 5. FIREBASE PUSH NOTIFICATION HANDLING

### 5.1 Notification Data Structure

When driver receives a push notification, the data payload will contain:

```json
{
  "notificationId": "notification_db_id",
  "type": "booking_request",
  "bookingId": "booking_id",
  "pickupAddress": "Doha, Qatar",
  "eta": "5",
  "pricing": "110",
  "bookingNumber": "BK1730707200123",
  "timestamp": "2025-11-04T12:00:00.000Z"
}
```

**Notification Types:**
- `booking_request` - New booking request received
- `booking_cancelled` - User cancelled the booking
- `payment_completed` - User completed payment
- `admin_message` - Message from admin

### 5.2 Handle Push Notification in Flutter

```dart
// When notification received (foreground/background)
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  // Show local notification in app
  final data = message.data;

  if (data['type'] == 'booking_request') {
    // Show booking request dialog/bottom sheet
    showBookingRequestDialog(
      bookingId: data['bookingId'],
      pickup: data['pickupAddress'],
      eta: data['eta'],
      pricing: data['pricing']
    );
  }
});

// When notification tapped (app in background/terminated)
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  // Navigate to booking details screen
  navigateToBookingDetails(message.data['bookingId']);
});
```

---

## 6. ERROR HANDLING

All API errors follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Validation Error (check request body)
- `401` - Authentication Error (token expired/invalid)
- `403` - Authorization Error (driver not approved, etc.)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Server Error

### Handle 401 Errors:
When you receive 401, call refresh token API. If refresh fails, logout user.

---

## 7. IMPORTANT FLUTTER IMPLEMENTATION NOTES

### 7.1 State Management
- Use **Riverpod/Bloc/GetX** for state management
- Store auth tokens in **secure storage** (flutter_secure_storage)
- Maintain driver online status in app state

### 7.2 Location Services
- Request location permissions on login
- Use **geolocator** package for GPS
- Update location every 10-30 seconds when online
- Stop location updates when offline

### 7.3 Connectivity
- Use **connectivity_plus** to detect network status
- Queue location updates when offline
- Show connectivity status in UI

### 7.4 Real-time Updates (Optional Enhancement)
Current implementation uses REST APIs + Push Notifications.
For real-time booking updates, integrate **Socket.io**:
```dart
// Connect to socket
socket = io('http://localhost:5000', <String, dynamic>{
  'transports': ['websocket'],
  'autoConnect': false,
  'extraHeaders': {'Authorization': 'Bearer $accessToken'}
});

// Listen for booking updates
socket.on('booking:updated', (data) {
  // Update UI
});
```

### 7.5 Maps Integration
- Use **google_maps_flutter** for map display
- Show driver location, pickup, and dropoff markers
- Draw route polyline using Google Directions API

### 7.6 Permissions Required
- Location (Always/While Using App)
- Notifications (Push)
- Internet
- Camera (for document upload - future feature)

---

## 8. TESTING CHECKLIST

### Before Production:
- [ ] Test with real Firebase device token
- [ ] Test location updates every 30 seconds
- [ ] Test accept booking flow end-to-end
- [ ] Test cancel booking scenarios
- [ ] Test network connectivity issues
- [ ] Test token refresh on 401 errors
- [ ] Test logout clears FCM token
- [ ] Test push notifications (foreground/background/terminated)
- [ ] Test booking expiry (60 seconds)
- [ ] Test payment timeout (5 minutes)

---

## 9. API RATE LIMITS

- **General APIs**: 100 requests per 15 minutes per IP
- **Location Update**: 120 requests per 15 minutes per driver
- **Login**: 5 requests per 15 minutes per phone number

**Exceeded Rate Limit Response:**
```json
{
  "success": false,
  "error": "Too many requests. Please try again later."
}
```

---

## 10. ENVIRONMENT VARIABLES (Flutter App)

Create `.env` file in Flutter project:

```env
API_BASE_URL=https://your-domain.com/api/v1
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
FIREBASE_PROJECT_ID=resq-7cd08
```

---

## SUMMARY OF KEY FLOWS

### 🔐 Login Flow:
1. Call `/auth/driver/login`
2. Store tokens securely
3. Call `/api/v1/driver/fcm-token` to register FCM token
4. Call `/api/v1/driver/profile` to get profile
5. If `approvalStatus == 'approved'`, enable online toggle

### 📍 Go Online Flow:
1. User toggles "Go Online"
2. Request location permissions
3. Call `/api/v1/driver/status` with `isOnline: true`
4. Start location tracking (update every 30 seconds)
5. Listen for push notifications

### 🚗 Accept Booking Flow:
1. Receive push notification for new booking
2. Show booking details dialog
3. Driver taps "Accept"
4. Call `/api/v1/booking/driver/:id/accept`
5. Navigate to active booking screen
6. Show map with route to pickup location

### ✅ Complete Trip Flow:
1. Driver marks arrival → Call `/arrived`
2. Driver starts trip → Call `/start`
3. Navigate to dropoff location
4. Driver completes trip → Call `/complete`
5. Show earnings summary
6. Driver goes back online for next booking

---

## Need Help?
- Check server logs for API errors
- Use Postman collection for testing
- Contact backend developer for issues

**API Documentation Complete!** 🚀
