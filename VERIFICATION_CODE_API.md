# Verification Code API Documentation

## Overview

The Verification Code system ensures that drivers verify the actual user's identity before starting a trip. When a driver accepts a booking or arrives at the pickup location, a **4-digit verification code** is generated. The user shares this code verbally with the driver, and the driver must enter it to verify they've met the correct person.

## Flow Diagram

```
User Creates Booking
        ↓
Driver Accepts Booking
        ↓
[4-digit code generated]  ← Code shown to user
        ↓
Payment Completed (auto in dev)
        ↓
Driver Marks Arrival
        ↓
[Code re-used or new generated]
        ↓
User tells code to Driver
        ↓
Driver Enters Code  ← API ENDPOINT HERE
        ↓
[Verification Check]
        ↓
Code Valid? → YES → Mark as Verified → Driver can start trip
        ↓
         NO → Reject with error
```

## When is Verification Code Generated?

1. **On Booking Acceptance**: When driver accepts booking (line 955-961 in booking.controller.js)
2. **On Driver Arrival**: When driver marks arrival at pickup (line 1076-1088 in booking.controller.js)
   - Reuses existing code if already generated
   - Generates new code if not exists

## API Endpoint

### Verify Pickup Code

**Endpoint**: `POST /api/v1/trip/:bookingId/verify-code`

**Authentication**: Required (Driver role only)

**Headers**:
```
Authorization: Bearer <DRIVER_ACCESS_TOKEN>
Content-Type: application/json
```

**URL Parameters**:
- `bookingId` (string, required): The booking ID to verify

**Request Body**:
```json
{
  "verificationCode": "1234"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Verification successful! You can now start the trip.",
  "data": {
    "bookingId": "673a1234567890abcdef1234",
    "bookingNumber": "BK17318123451234",
    "verified": true,
    "verifiedAt": "2025-11-17T12:30:45.123Z"
  }
}
```

**Error Responses**:

1. **Missing Code (400)**:
```json
{
  "success": false,
  "error": "Verification code is required"
}
```

2. **Driver Not Found (404)**:
```json
{
  "success": false,
  "error": "Driver profile not found"
}
```

3. **Booking Not Found (404)**:
```json
{
  "success": false,
  "error": "Booking not found or not assigned to you"
}
```

4. **Driver Not Arrived (400)**:
```json
{
  "success": false,
  "error": "You must arrive at pickup location first"
}
```

5. **Already Verified (400)**:
```json
{
  "success": false,
  "error": "Verification code already used"
}
```

6. **Invalid Code (400)**:
```json
{
  "success": false,
  "message": "Invalid verification code"
}
```

## Complete Workflow Example

### Step 1: User Creates Booking

```bash
curl -X POST http://localhost:5000/api/v1/booking/create \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLocation": {
      "coordinates": [51.5074, 25.2760],
      "address": "Doha, Qatar"
    },
    "dropoffLocation": {
      "coordinates": [51.5200, 25.2900],
      "address": "West Bay, Doha"
    },
    "vehicleType": "sedan"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "673a1234567890abcdef1234",
      "bookingNumber": "BK17318123451234",
      "status": "requested"
    }
  }
}
```

### Step 2: Driver Accepts Booking

```bash
curl -X POST http://localhost:5000/api/v1/booking/673a1234567890abcdef1234/accept \
  -H "Authorization: Bearer <DRIVER_TOKEN>"
```

Response (with verification code):
```json
{
  "success": true,
  "message": "Booking accepted and payment auto-completed (development mode)",
  "data": {
    "booking": {
      "id": "673a1234567890abcdef1234",
      "status": "payment_completed",
      "verificationCode": {
        "code": "5847",
        "generatedAt": "2025-11-17T12:25:00.000Z",
        "isVerified": false
      }
    }
  }
}
```

**Note**: The user receives this code via notification and can see it in their app.

### Step 3: Driver Marks Arrival

```bash
curl -X POST http://localhost:5000/api/v1/trip/673a1234567890abcdef1234/mark-arrived \
  -H "Authorization: Bearer <DRIVER_TOKEN>"
```

Response:
```json
{
  "success": true,
  "message": "Arrival confirmed. Verification code generated.",
  "data": {
    "booking": {
      "status": "driver_arrived"
    },
    "verificationCode": "5847"
  }
}
```

### Step 4: User Views Verification Code

```bash
curl -X GET http://localhost:5000/api/v1/trip/673a1234567890abcdef1234/details \
  -H "Authorization: Bearer <USER_TOKEN>"
```

Response:
```json
{
  "success": true,
  "data": {
    "bookingId": "673a1234567890abcdef1234",
    "status": "driver_arrived",
    "verificationCode": {
      "code": "5847",
      "isVerified": false,
      "generatedAt": "2025-11-17T12:25:00.000Z"
    },
    "driver": {
      "name": "Ahmed Hassan",
      "phoneNumber": "+97450000001",
      "vehicleNumber": "ABC-1234"
    }
  }
}
```

**User tells driver**: "My code is **5847**"

### Step 5: Driver Verifies Code ⭐ (THIS IS THE KEY API)

```bash
curl -X POST http://localhost:5000/api/v1/trip/673a1234567890abcdef1234/verify-code \
  -H "Authorization: Bearer <DRIVER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"verificationCode": "5847"}'
```

Response (SUCCESS):
```json
{
  "success": true,
  "message": "Verification successful! You can now start the trip.",
  "data": {
    "bookingId": "673a1234567890abcdef1234",
    "bookingNumber": "BK17318123451234",
    "verified": true,
    "verifiedAt": "2025-11-17T12:30:45.123Z"
  }
}
```

### Step 6: Driver Starts Trip

```bash
curl -X POST http://localhost:5000/api/v1/booking/673a1234567890abcdef1234/start \
  -H "Authorization: Bearer <DRIVER_TOKEN>"
```

Response:
```json
{
  "success": true,
  "message": "Trip started - dropoff location now available",
  "data": {
    "booking": {
      "status": "in_progress",
      "dropoffLocation": {
        "coordinates": [51.5200, 25.2900],
        "address": "West Bay, Doha"
      }
    }
  }
}
```

## Validation Rules

### 1. **Authorization**
- Only authenticated drivers can verify codes
- Only the assigned driver can verify the code for their booking

### 2. **Booking Status**
- Verification ONLY allowed when `status = "driver_arrived"`
- Cannot verify before arrival
- Cannot verify after trip started

### 3. **Code Verification**
- Code must match exactly (case-insensitive, trimmed)
- Code is 4 digits (e.g., "1234", "5847")
- Each code can only be verified ONCE
- Once verified, `isVerified = true` and `verifiedAt` is set

### 4. **Trip Start Dependency**
- Driver CANNOT start trip without verification
- `startTrip` API checks `verificationCode.isVerified === true`

## Security Features

1. **Single Use**: Each code can only be verified once
2. **Expiry**: Code expires when booking is cancelled or completed
3. **Driver Authorization**: Only the assigned driver can verify
4. **Status Check**: Must be in correct booking state
5. **Trim & Case**: Code is trimmed to prevent whitespace issues

## Test Scenarios

### ✅ Test 1: Correct Code (Happy Path)
- Driver arrives → Code generated
- User shares code with driver
- Driver enters correct code
- Verification succeeds → Can start trip

### ❌ Test 2: Wrong Code
- Driver enters "9999" instead of "5847"
- API returns 400: "Invalid verification code"

### ❌ Test 3: Verify Before Arrival
- Driver tries to verify before marking arrival
- API returns 400: "You must arrive at pickup location first"

### ❌ Test 4: Verify Twice
- Driver verifies code successfully
- Driver tries to verify again
- API returns 400: "Verification code already used"

### ❌ Test 5: Wrong Driver
- Driver A accepts booking
- Driver B tries to verify code
- API returns 404: "Booking not found or not assigned to you"

### ❌ Test 6: Missing Code
- Driver sends empty verificationCode
- API returns 400: "Verification code is required"

## Database Schema

```javascript
// Booking Model - verificationCode field
verificationCode: {
  code: {
    type: String,
    length: 4
  },
  generatedAt: Date,
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: Date
}
```

## Related Endpoints

1. **Mark Driver Arrived**: `POST /api/v1/trip/:bookingId/mark-arrived`
   - Generates/reuses verification code
   - Returns code in response

2. **Get Trip Details (User)**: `GET /api/v1/trip/:bookingId/details`
   - Shows verification code to user
   - Shows verification status

3. **Start Trip**: `POST /api/v1/booking/:bookingId/start`
   - Requires verification to be completed
   - Fails if `isVerified = false`

## Implementation Location

- **Controller**: [src/controllers/trip.controller.js:216-273](src/controllers/trip.controller.js#L216-L273)
- **Route**: [src/routes/trip.routes.js:38-44](src/routes/trip.routes.js#L38-L44)
- **Model**: [src/models/Booking.js:176](src/models/Booking.js#L176)

## Error Handling

All errors follow the standard error response format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

HTTP Status Codes:
- `200`: Success
- `400`: Validation error (wrong code, already verified, etc.)
- `401`: Unauthorized (no token)
- `403`: Forbidden (not a driver)
- `404`: Not found (booking not found or not assigned)

## Testing

Run manual test:
```bash
node test-verify-code-manual.js <USER_TOKEN> <DRIVER_TOKEN> <BOOKING_ID>
```

Or use the comprehensive test suite (requires users in DB):
```bash
node test-verification-comprehensive.js
```

## Notes

- Verification code is generated at **booking acceptance** (for user to see early)
- Code persists through driver arrival (same code, not regenerated)
- Code is sent to user via notification service
- Code is visible in user's trip details API
- Driver must verify before starting trip (enforced in `startTrip` controller)
