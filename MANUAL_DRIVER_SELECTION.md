# Manual Driver Selection Feature

## Overview
Users can now manually select a specific driver and request a tow service directly from them.

## API Endpoint

**POST** `/api/v1/booking/request-driver`

**Authentication:** Required (User role only)

## Request Body

```json
{
  "driverId": "673e30ad3efcc05cc07e4f90",
  "vehicleType": "sedan",
  "pickupLocation": {
    "coordinates": [51.5074, 25.2854],
    "address": "Doha, Qatar",
    "placeName": "Test Pickup Location"
  },
  "dropoffLocation": {
    "coordinates": [51.5174, 25.2954],
    "address": "Al Wakrah, Qatar",
    "placeName": "Test Dropoff Location"
  },
  "vehicleDetails": {
    "make": "Toyota",
    "model": "Camry",
    "year": 2020,
    "plateNumber": "ABC123",
    "color": "White"
  },
  "notes": "Please arrive quickly" // optional
}
```

## Response

```json
{
  "success": true,
  "message": "Booking request sent to driver successfully",
  "data": {
    "booking": {
      "id": "booking_id",
      "bookingNumber": "BK1730707200123",
      "status": "requested",
      "vehicleType": "sedan",
      "pickupLocation": { ... },
      "dropoffLocation": { ... },
      "pricing": {
        "basePrice": 110,
        "perKmRate": 0,
        "totalDistance": 15.5,
        "distancePrice": 0,
        "serviceFee": 0,
        "totalAmount": 110,
        "currency": "USD"
      },
      "driverInfo": {
        "id": "driver_id",
        "name": "John Doe",
        "phoneNumber": "+97412345678",
        "vehicleNumber": "XYZ789",
        "rating": 4.5
      },
      "estimatedDuration": {
        "driverArrival": "5 min (2.3 km)",
        "tripDuration": "20 min (15.5 km)"
      },
      "expiresAt": "2025-11-04T12:05:00.000Z",
      "createdAt": "2025-11-04T12:04:00.000Z"
    }
  }
}
```

## Flow

1. **User selects a driver** from the available drivers list
2. **API validates:**
   - Driver exists and is online
   - Driver is approved
   - Driver's vehicle type matches request
   - Driver has current location available
3. **Calculate distances using Google Maps:**
   - Driver's current location → Pickup location (Distance Matrix API)
   - Pickup location → Dropoff location (Directions API)
4. **Create booking** with:
   - Static pricing: $110
   - Status: `requested`
   - 60-second expiry (handled by existing cron job)
5. **Return booking details** with:
   - Driver info and rating
   - Estimated arrival time
   - Trip duration and distance
   - Pricing breakdown
6. **Driver receives notification** (Firebase - to be implemented)
7. **Driver can accept/reject** within 60 seconds

## Validations

- Driver must be **online**
- Driver must be **approved**
- Driver's vehicle type must **match** request
- Driver must have **current location** set
- All required fields must be provided

## Google Maps Integration

- **API Key:** Set in `.env` as `GOOGLE_MAPS_API_KEY`
- **Distance Matrix API:** Calculates driver-to-pickup distance and ETA
- **Directions API:** Calculates full trip route and duration

## Pricing

Currently uses **static pricing of $110** as requested. Can be replaced with custom client calculation logic later.

## Next Steps

1. **Firebase Admin SDK** integration for driver notifications
2. **Custom pricing** logic based on client requirements
3. **WebSocket/Socket.io** for real-time updates
4. **Driver location tracking** improvements

## Testing

Use the provided `test-request-driver.json` file:
1. Replace `DRIVER_ID_HERE` with actual driver ID
2. Get user access token via login
3. Call the API:

```bash
curl -X POST http://localhost:5000/api/v1/booking/request-driver \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d @test-request-driver.json
```

## Files Modified/Created

1. **src/config/googleMaps.js** - Added `getDirections()` method
2. **src/services/maps.service.js** - Added `calculateDriverToPickupDistance()` and `calculateTripRoute()` methods
3. **src/controllers/booking.controller.js** - Added `requestSpecificDriver()` controller
4. **src/routes/booking.routes.js** - Added `/request-driver` route
5. **.env** - Added Google Maps API key
