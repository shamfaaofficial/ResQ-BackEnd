# Verification Code - Quick Reference

## API Endpoint

```
POST /api/v1/trip/:bookingId/verify-code
```

## Purpose
Driver verifies user's identity using 4-digit code before starting trip.

## Request

```bash
curl -X POST http://localhost:5000/api/v1/trip/<BOOKING_ID>/verify-code \
  -H "Authorization: Bearer <DRIVER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"verificationCode": "1234"}'
```

## Response (Success)

```json
{
  "success": true,
  "message": "Verification successful! You can now start the trip.",
  "data": {
    "bookingId": "...",
    "verified": true,
    "verifiedAt": "2025-11-17T12:30:45.123Z"
  }
}
```

## Response (Invalid Code)

```json
{
  "success": false,
  "message": "Invalid verification code"
}
```

## Workflow

1. **Driver accepts booking** → 4-digit code generated
2. **Driver marks arrival** → Code shown to driver and user
3. **User tells code to driver** (verbally)
4. **Driver enters code** → Call this API ✨
5. **Verification succeeds** → Driver can start trip

## Validation Rules

- ✅ Must be authenticated driver
- ✅ Booking must be assigned to this driver
- ✅ Driver must have marked arrival (`status = "driver_arrived"`)
- ✅ Code must match exactly
- ✅ Code can only be verified ONCE
- ✅ Verification required before trip can start

## Error Scenarios

| Error | Reason | Solution |
|-------|--------|----------|
| "Verification code is required" | Empty/missing code | Provide the code |
| "Booking not found or not assigned to you" | Wrong driver or invalid booking | Use correct booking |
| "You must arrive at pickup location first" | Status not `driver_arrived` | Mark arrival first |
| "Verification code already used" | Already verified | Cannot verify twice |
| "Invalid verification code" | Wrong code | Get correct code from user |

## Code Location

- **Controller**: `src/controllers/trip.controller.js:216`
- **Route**: `src/routes/trip.routes.js:38`
- **Generated at**: `src/controllers/booking.controller.js:955` (acceptance) & `1081` (arrival)

## Testing

```bash
# Get verification code (as user)
curl -X GET http://localhost:5000/api/v1/trip/<BOOKING_ID>/details \
  -H "Authorization: Bearer <USER_TOKEN>"

# Verify code (as driver)
curl -X POST http://localhost:5000/api/v1/trip/<BOOKING_ID>/verify-code \
  -H "Authorization: Bearer <DRIVER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"verificationCode": "1234"}'

# Start trip (as driver - requires verification)
curl -X POST http://localhost:5000/api/v1/booking/<BOOKING_ID>/start \
  -H "Authorization: Bearer <DRIVER_TOKEN>"
```
