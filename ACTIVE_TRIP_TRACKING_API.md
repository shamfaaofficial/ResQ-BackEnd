# Active Trip Tracking API Documentation

This document provides detailed information about the APIs and WebSocket events used for real-time trip tracking in the RESQ platform.

---

## Overview

The active trip tracking system consists of:
1. **REST API** - Get active booking details
2. **REST API** - Get live status with ETA
3. **WebSocket** - Real-time driver location updates

---

## 1. Get User's Active Booking

### **Endpoint**
```
GET /api/v1/bookings/user/active
```

### **Description**
Retrieves the user's current active booking. Returns bookings in the following states:
- `requested` - Waiting for driver to accept
- `accepted` - Driver accepted, waiting for payment
- `payment_completed` - Payment completed, driver heading to pickup
- `driver_arrived` - Driver arrived at pickup location
- `in_progress` - Trip is actively in progress

### **Authentication**
- **Required:** Yes
- **Type:** Bearer Token (JWT)
- **Role:** `user`

### **Headers**
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### **Request Parameters**
None

### **Request Body**
None

### **Success Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "booking": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "bookingNumber": "RESQ20250116001",
      "status": "in_progress",
      "vehicleType": "sedan",

      "pickupLocation": {
        "type": "Point",
        "coordinates": [51.5074, 25.2854],
        "address": "Al Corniche Street, Doha, Qatar",
        "placeName": "Souq Waqif"
      },

      "dropoffLocation": {
        "type": "Point",
        "coordinates": [51.5174, 25.2954],
        "address": "West Bay, Doha, Qatar",
        "placeName": "Katara Cultural Village"
      },

      "actualDropoffLocation": {
        "type": "Point",
        "coordinates": [51.5180, 25.2960],
        "address": "Actual dropoff location (set after trip completion)"
      },

      "distance": {
        "estimated": 10.5,
        "actual": 11.2
      },

      "pricing": {
        "basePrice": 50,
        "perKmRate": 5,
        "totalDistance": 10.5,
        "distancePrice": 52.5,
        "serviceFee": 10,
        "totalAmount": 112.5,
        "currency": "QAR"
      },

      "payment": {
        "status": "completed",
        "method": "credit_card",
        "gateway": "MyFatoorah",
        "invoiceId": "INV-123456",
        "transactionId": "TXN-789012",
        "paidAmount": 112.5,
        "paidAt": "2025-01-16T10:03:00.000Z",
        "initiatedAt": "2025-01-16T10:02:30.000Z"
      },

      "timeline": {
        "requestedAt": "2025-01-16T10:00:00.000Z",
        "acceptedAt": "2025-01-16T10:01:00.000Z",
        "paymentCompletedAt": "2025-01-16T10:03:00.000Z",
        "driverArrivedAt": "2025-01-16T10:15:00.000Z",
        "startedAt": "2025-01-16T10:20:00.000Z",
        "completedAt": null,
        "cancelledAt": null
      },

      "userId": {
        "_id": "65a1b2c3d4e5f6g7h8i9j0k2",
        "phoneNumber": "+97412345678",
        "profile": {
          "firstName": "Ahmed",
          "lastName": "Ali",
          "profileImage": "https://example.com/image.jpg"
        }
      },

      "driverId": {
        "_id": "65a1b2c3d4e5f6g7h8i9j0k3",
        "vehicleDetails": {
          "vehicleType": "sedan",
          "vehicleNumber": "QAT-12345",
          "vehicleMake": "Toyota",
          "vehicleModel": "Camry",
          "vehicleYear": 2023,
          "vehicleColor": "White"
        },
        "currentLocation": {
          "type": "Point",
          "coordinates": [51.5100, 25.2900],
          "address": "Current driver location",
          "updatedAt": "2025-01-16T10:25:30.000Z"
        },
        "rating": {
          "average": 4.8,
          "totalRatings": 256
        },
        "userId": {
          "phoneNumber": "+97487654321",
          "profile": {
            "firstName": "Mohammed",
            "lastName": "Hassan"
          }
        }
      },

      "requestExpiresAt": "2025-01-16T10:01:00.000Z",
      "paymentExpiresAt": "2025-01-16T10:06:00.000Z",

      "driverEarnings": 90,
      "platformCommission": 22.5,

      "searchRadius": 10,
      "notes": "Please call when you arrive",

      "verificationCode": {
        "code": "1234",
        "generatedAt": "2025-01-16T10:15:00.000Z",
        "verifiedAt": null,
        "isVerified": false
      },

      "arrivalVerification": {
        "driverLocation": {
          "type": "Point",
          "coordinates": [51.5075, 25.2855]
        },
        "distanceFromPickup": 45,
        "verifiedAt": "2025-01-16T10:15:05.000Z",
        "isVerified": true
      },

      "createdAt": "2025-01-16T10:00:00.000Z",
      "updatedAt": "2025-01-16T10:25:30.000Z"
    }
  }
}
```

### **No Active Booking Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "booking": null
  }
}
```

### **Error Responses**

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication token required"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": "Access denied. User role required."
}
```

### **Implementation Example**

#### **Frontend (User App)**

```javascript
// Fetch active booking on app load or screen focus
async function getActiveBooking() {
  try {
    const response = await fetch('http://localhost:5000/api/v1/bookings/user/active', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success && result.data.booking) {
      const booking = result.data.booking;

      // Extract key information
      const bookingId = booking._id;
      const status = booking.status;
      const driverLocation = {
        lat: booking.driverId.currentLocation.coordinates[1],
        lng: booking.driverId.currentLocation.coordinates[0]
      };
      const pickupLocation = {
        lat: booking.pickupLocation.coordinates[1],
        lng: booking.pickupLocation.coordinates[0]
      };
      const dropoffLocation = {
        lat: booking.dropoffLocation.coordinates[1],
        lng: booking.dropoffLocation.coordinates[0]
      };

      // Update UI
      displayTripStatus(status);
      displayDriverInfo(booking.driverId);
      displayPricing(booking.pricing);

      // Draw map
      initializeMap(driverLocation, pickupLocation, dropoffLocation);

      // Connect to WebSocket for live updates
      connectToWebSocket(bookingId);

      return booking;
    } else {
      // No active booking
      console.log('No active trip');
      return null;
    }
  } catch (error) {
    console.error('Error fetching active booking:', error);
    throw error;
  }
}
```

---

## 2. Get Live Booking Status with ETA

### **Endpoint**
```
GET /api/v1/bookings/user/:bookingId/live-status
```

### **Description**
Retrieves real-time booking status including driver's current location, ETA to pickup, and distance. This endpoint calculates live ETA based on current traffic conditions using Google Maps API.

**Use Case:** Poll this API every 30-60 seconds for ETA updates, or use as a fallback if WebSocket connection fails.

### **Authentication**
- **Required:** Yes
- **Type:** Bearer Token (JWT)
- **Role:** `user`

### **Headers**
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### **URL Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bookingId` | String | Yes | MongoDB ObjectId of the booking |

### **Request Body**
None

### **Success Response (200 OK) - Active Trip**

```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "bookingNumber": "RESQ20250116001",
      "status": "driver_arrived",

      "driverLocation": {
        "latitude": 25.2900,
        "longitude": 51.5100,
        "address": "Al Sadd Street, Doha, Qatar"
      },

      "eta": "5 min",
      "distanceToPickup": "1.2 km",

      "driver": {
        "id": "65a1b2c3d4e5f6g7h8i9j0k3",
        "name": "Mohammed Hassan",
        "phoneNumber": "+97487654321",
        "rating": 4.8,
        "totalRatings": 256,
        "vehicleDetails": {
          "vehicleType": "sedan",
          "vehicleNumber": "QAT-12345",
          "vehicleMake": "Toyota",
          "vehicleModel": "Camry",
          "vehicleColor": "White"
        }
      },

      "timeline": {
        "requestedAt": "2025-01-16T10:00:00.000Z",
        "acceptedAt": "2025-01-16T10:01:00.000Z",
        "paymentCompletedAt": "2025-01-16T10:03:00.000Z",
        "driverArrivedAt": "2025-01-16T10:15:00.000Z",
        "startedAt": null
      },

      "pickupLocation": {
        "latitude": 25.2854,
        "longitude": 51.5074,
        "address": "Al Corniche Street, Doha, Qatar"
      },

      "dropoffLocation": {
        "latitude": 25.2954,
        "longitude": 51.5174,
        "address": "West Bay, Doha, Qatar"
      }
    }
  }
}
```

### **Success Response (200 OK) - Trip In Progress**

```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "bookingNumber": "RESQ20250116001",
      "status": "in_progress",

      "driverLocation": {
        "latitude": 25.2920,
        "longitude": 51.5120,
        "address": "Current location on route"
      },

      "eta": null,
      "distanceToPickup": null,

      "driver": {
        "id": "65a1b2c3d4e5f6g7h8i9j0k3",
        "name": "Mohammed Hassan",
        "phoneNumber": "+97487654321",
        "rating": 4.8,
        "totalRatings": 256,
        "vehicleDetails": {
          "vehicleType": "sedan",
          "vehicleNumber": "QAT-12345",
          "vehicleMake": "Toyota",
          "vehicleModel": "Camry",
          "vehicleColor": "White"
        }
      },

      "timeline": {
        "requestedAt": "2025-01-16T10:00:00.000Z",
        "acceptedAt": "2025-01-16T10:01:00.000Z",
        "paymentCompletedAt": "2025-01-16T10:03:00.000Z",
        "driverArrivedAt": "2025-01-16T10:15:00.000Z",
        "startedAt": "2025-01-16T10:20:00.000Z"
      },

      "pickupLocation": {
        "latitude": 25.2854,
        "longitude": 51.5074,
        "address": "Al Corniche Street, Doha, Qatar"
      },

      "dropoffLocation": {
        "latitude": 25.2954,
        "longitude": 51.5174,
        "address": "West Bay, Doha, Qatar"
      }
    }
  }
}
```

### **Success Response (200 OK) - Inactive Booking**

```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "status": "completed",
      "message": "Booking is not in active state"
    }
  }
}
```

### **Error Responses**

#### 404 Not Found
```json
{
  "success": false,
  "error": "Booking not found"
}
```

#### 404 Driver Not Found
```json
{
  "success": false,
  "error": "Driver not found"
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication token required"
}
```

### **Implementation Example**

#### **Frontend (User App) - Polling**

```javascript
let pollingInterval = null;

// Start polling for live status
function startLiveStatusPolling(bookingId) {
  // Clear any existing interval
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  // Poll every 30 seconds
  pollingInterval = setInterval(async () => {
    await fetchLiveStatus(bookingId);
  }, 30000);

  // Fetch immediately
  fetchLiveStatus(bookingId);
}

async function fetchLiveStatus(bookingId) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/v1/bookings/user/${bookingId}/live-status`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const result = await response.json();

    if (result.success && result.data.booking) {
      const { booking } = result.data;

      // Update driver location on map
      if (booking.driverLocation) {
        updateDriverMarker(
          booking.driverLocation.latitude,
          booking.driverLocation.longitude
        );
      }

      // Update ETA display
      if (booking.eta && booking.distanceToPickup) {
        updateETADisplay(booking.eta, booking.distanceToPickup);
      }

      // Update status
      updateTripStatus(booking.status);

      // If trip completed, stop polling
      if (!['accepted', 'driver_arrived', 'in_progress', 'payment_completed'].includes(booking.status)) {
        stopLiveStatusPolling();
      }
    }
  } catch (error) {
    console.error('Error fetching live status:', error);
  }
}

function stopLiveStatusPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// Clean up on component unmount
function cleanup() {
  stopLiveStatusPolling();
}
```

---

## 3. Real-Time Driver Location (WebSocket)

### **WebSocket Connection**

#### **Endpoint**
```
ws://localhost:5000
```

Or with Socket.io client:
```
http://localhost:5000
```

### **Authentication**
WebSocket connections require JWT authentication via the `auth` object during connection.

### **Connection Example**

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: accessToken // JWT access token
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
```

---

### **Event: User Room Join (Automatic)**

When a user connects with role `user`, they are automatically joined to their personal room.

#### **Room Name**
```
user:{userId}
```

#### **Event Received: `user:joined`**

```json
{
  "success": true,
  "room": "user:65a1b2c3d4e5f6g7h8i9j0k2",
  "socketId": "abc123def456",
  "userId": "65a1b2c3d4e5f6g7h8i9j0k2",
  "timestamp": "2025-01-16T10:00:00.000Z"
}
```

---

### **Event: Driver Location Update (Receive)**

#### **Event Name**
```
driver:location
```

#### **Description**
Emitted to the user when the assigned driver sends a location update during an active trip. This happens automatically when the driver is navigating to the pickup location or during the trip.

#### **Trigger**
- Driver emits `driver:location:update` event
- Server validates the booking is active
- Server broadcasts to user's room: `user:{userId}`

#### **Payload**

```json
{
  "bookingId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "latitude": 25.2900,
  "longitude": 51.5100,
  "timestamp": "2025-01-16T10:25:30.000Z"
}
```

#### **Frequency**
- Driver app typically sends updates every 5-10 seconds while navigating
- Only during active booking states: `accepted`, `driver_arrived`, `in_progress`

---

### **Event: Booking Status Update (Receive)**

#### **Event Name**
```
booking:status:update
```

#### **Description**
Emitted when booking status changes (e.g., driver arrived, trip started, trip completed).

#### **Payload**

```json
{
  "bookingId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "status": "driver_arrived",
  "timeline": {
    "requestedAt": "2025-01-16T10:00:00.000Z",
    "acceptedAt": "2025-01-16T10:01:00.000Z",
    "paymentCompletedAt": "2025-01-16T10:03:00.000Z",
    "driverArrivedAt": "2025-01-16T10:15:00.000Z",
    "startedAt": null
  }
}
```

---

### **Complete WebSocket Implementation (User App)**

```javascript
import io from 'socket.io-client';

class TripTrackingService {
  constructor(accessToken) {
    this.socket = null;
    this.accessToken = accessToken;
    this.currentBookingId = null;
  }

  // Initialize WebSocket connection
  connect() {
    this.socket = io('http://localhost:5000', {
      auth: {
        token: this.accessToken
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Connection successful
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
    });

    // Auto-joined user room
    this.socket.on('user:joined', (data) => {
      console.log('✅ Joined user room:', data.room);
      console.log('User ID:', data.userId);
    });

    // Listen for driver location updates
    this.socket.on('driver:location', (data) => {
      console.log('📍 Driver location update:', data);
      this.handleDriverLocationUpdate(data);
    });

    // Listen for booking status updates
    this.socket.on('booking:status:update', (data) => {
      console.log('📢 Booking status update:', data);
      this.handleBookingStatusUpdate(data);
    });

    // Connection errors
    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
    });

    // Disconnection
    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    // Error events
    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  }

  // Handle driver location updates
  handleDriverLocationUpdate(data) {
    const { bookingId, latitude, longitude, timestamp } = data;

    // Verify it's for current booking
    if (bookingId !== this.currentBookingId) {
      console.warn('Location update for different booking');
      return;
    }

    // Update driver marker on map
    this.updateDriverMarker(latitude, longitude);

    // Redraw polyline from driver to pickup/dropoff
    this.redrawPolyline(latitude, longitude);

    // Update timestamp
    this.updateLastLocationTimestamp(timestamp);
  }

  // Handle booking status updates
  handleBookingStatusUpdate(data) {
    const { bookingId, status, timeline } = data;

    // Update UI based on status
    switch (status) {
      case 'accepted':
        this.showDriverAccepted();
        break;
      case 'driver_arrived':
        this.showDriverArrived();
        this.showVerificationCode();
        break;
      case 'in_progress':
        this.showTripInProgress();
        break;
      case 'completed':
        this.showTripCompleted();
        this.disconnect();
        break;
      case 'cancelled_by_driver':
      case 'cancelled_by_user':
        this.showTripCancelled();
        this.disconnect();
        break;
    }

    // Update timeline
    this.updateTimeline(timeline);
  }

  // Map update functions
  updateDriverMarker(lat, lng) {
    if (window.driverMarker) {
      // Update existing marker
      window.driverMarker.setPosition({ lat, lng });
    } else {
      // Create new marker
      window.driverMarker = new google.maps.Marker({
        position: { lat, lng },
        map: window.map,
        icon: '/assets/driver-car-icon.png',
        title: 'Driver Location'
      });
    }
  }

  redrawPolyline(driverLat, driverLng) {
    // Get pickup or dropoff location based on trip status
    const destination = this.getTripDestination();

    // Clear existing polyline
    if (window.routePolyline) {
      window.routePolyline.setMap(null);
    }

    // Draw new polyline
    const path = [
      { lat: driverLat, lng: driverLng },
      { lat: destination.lat, lng: destination.lng }
    ];

    window.routePolyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: '#4285F4',
      strokeOpacity: 1.0,
      strokeWeight: 4,
      map: window.map
    });

    // Optionally, use Directions API for real route
    this.drawDirectionsRoute(driverLat, driverLng, destination);
  }

  async drawDirectionsRoute(driverLat, driverLng, destination) {
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map: window.map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#4285F4',
        strokeWeight: 4
      }
    });

    try {
      const result = await directionsService.route({
        origin: { lat: driverLat, lng: driverLng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: google.maps.TravelMode.DRIVING
      });

      directionsRenderer.setDirections(result);

      // Update ETA from directions result
      const route = result.routes[0];
      const leg = route.legs[0];
      this.updateETADisplay(leg.duration.text, leg.distance.text);
    } catch (error) {
      console.error('Error drawing directions:', error);
    }
  }

  getTripDestination() {
    // Return pickup or dropoff based on trip status
    // This should come from your booking state
    const status = this.getCurrentBookingStatus();

    if (status === 'in_progress') {
      return this.dropoffLocation;
    } else {
      return this.pickupLocation;
    }
  }

  // UI update functions
  showDriverAccepted() {
    // Update UI to show driver accepted
  }

  showDriverArrived() {
    // Update UI to show driver arrived
  }

  showVerificationCode() {
    // Display verification code to user
  }

  showTripInProgress() {
    // Update UI to show trip in progress
  }

  showTripCompleted() {
    // Update UI to show trip completed
  }

  showTripCancelled() {
    // Update UI to show trip cancelled
  }

  updateTimeline(timeline) {
    // Update timeline UI
  }

  updateETADisplay(duration, distance) {
    // Update ETA display in UI
  }

  updateLastLocationTimestamp(timestamp) {
    // Update last update timestamp
  }

  getCurrentBookingStatus() {
    // Return current booking status
  }

  // Set current booking
  setCurrentBooking(bookingId, pickupLocation, dropoffLocation) {
    this.currentBookingId = bookingId;
    this.pickupLocation = pickupLocation;
    this.dropoffLocation = dropoffLocation;
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Usage
const trackingService = new TripTrackingService(accessToken);
trackingService.connect();

// When active booking is fetched
const booking = await getActiveBooking();
if (booking) {
  trackingService.setCurrentBooking(
    booking._id,
    {
      lat: booking.pickupLocation.coordinates[1],
      lng: booking.pickupLocation.coordinates[0]
    },
    {
      lat: booking.dropoffLocation.coordinates[1],
      lng: booking.dropoffLocation.coordinates[0]
    }
  );
}
```

---

## Complete Integration Flow

### **Step-by-Step Implementation**

```javascript
// 1. On App Launch or Active Trip Screen
async function initializeActiveTripScreen() {
  // Step 1: Fetch active booking
  const booking = await getActiveBooking();

  if (!booking) {
    // No active trip
    navigateToHomeScreen();
    return;
  }

  // Step 2: Extract data
  const bookingId = booking._id;
  const driverLocation = {
    lat: booking.driverId.currentLocation.coordinates[1],
    lng: booking.driverId.currentLocation.coordinates[0]
  };
  const pickupLocation = {
    lat: booking.pickupLocation.coordinates[1],
    lng: booking.pickupLocation.coordinates[0]
  };
  const dropoffLocation = {
    lat: booking.dropoffLocation.coordinates[1],
    lng: booking.dropoffLocation.coordinates[0]
  };

  // Step 3: Initialize map
  initializeMap(driverLocation, pickupLocation, dropoffLocation);

  // Step 4: Connect to WebSocket
  const trackingService = new TripTrackingService(accessToken);
  trackingService.connect();
  trackingService.setCurrentBooking(bookingId, pickupLocation, dropoffLocation);

  // Step 5: (Optional) Start polling as fallback
  startLiveStatusPolling(bookingId);

  // Step 6: Display trip details
  displayTripDetails(booking);
}

// 2. Clean up on screen unmount
function cleanupActiveTripScreen() {
  // Disconnect WebSocket
  trackingService.disconnect();

  // Stop polling
  stopLiveStatusPolling();

  // Clear map
  clearMap();
}
```

---

## Key Points

### **When to Use Each API**

1. **`GET /user/active`**
   - ✅ On app launch
   - ✅ When user navigates to active trip screen
   - ✅ To get full booking details
   - ✅ To get initial driver location
   - ❌ Not for real-time updates

2. **`GET /user/:bookingId/live-status`**
   - ✅ As a fallback if WebSocket fails
   - ✅ To get calculated ETA with traffic
   - ✅ Polling every 30-60 seconds
   - ❌ Not recommended as primary tracking method (high API calls)

3. **WebSocket `driver:location` event**
   - ✅ Primary method for real-time tracking
   - ✅ Updates every 5-10 seconds
   - ✅ Low latency
   - ✅ Efficient (single connection)
   - ⚠️ Requires stable connection

### **Best Practice: Hybrid Approach**

```javascript
// Use REST API for initial load
const booking = await getActiveBooking();

// Use WebSocket for real-time updates
socket.on('driver:location', updateMap);

// Use polling as fallback if WebSocket disconnects
socket.on('disconnect', () => {
  startLiveStatusPolling(bookingId);
});

socket.on('connect', () => {
  stopLiveStatusPolling();
});
```

---

## Booking Status Flow

```
requested (60s timeout)
    ↓
accepted (driver assigns)
    ↓
payment_completed (user pays)
    ↓
driver_arrived (driver marks arrival)
    ↓
in_progress (trip starts)
    ↓
completed (trip ends)
```

### **Active States for Real-Time Tracking**
- `accepted` - Driver heading to pickup
- `payment_completed` - Payment done, driver heading to pickup
- `driver_arrived` - Driver at pickup, waiting for user
- `in_progress` - Trip in progress to dropoff

### **Inactive States (Stop Tracking)**
- `requested` - No driver assigned yet
- `completed` - Trip finished
- `cancelled_by_user` - User cancelled
- `cancelled_by_driver` - Driver cancelled

---

## Error Handling

```javascript
// Handle WebSocket errors gracefully
socket.on('connect_error', (error) => {
  console.error('WebSocket connection failed:', error);

  // Fallback to polling
  startLiveStatusPolling(bookingId);

  // Show user a warning
  showNotification('Using backup tracking mode', 'warning');
});

// Handle API errors
async function getActiveBooking() {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch active booking:', error);

    // Show error to user
    showErrorAlert('Unable to load trip details');

    // Retry after delay
    setTimeout(() => getActiveBooking(), 3000);
  }
}
```

---

## Security Considerations

1. **JWT Authentication Required**
   - All endpoints require valid JWT access token
   - WebSocket requires token in `auth.token` field

2. **Role-Based Access**
   - Only users can access their own bookings
   - Users cannot access other users' trips

3. **Booking Validation**
   - Server verifies user owns the booking
   - Driver location only shared for active bookings

4. **Rate Limiting**
   - REST APIs are rate-limited (100 req/15 min)
   - WebSocket events are validated per booking

---

## Testing

### **Test Active Booking API**

```bash
curl -X GET http://localhost:5000/api/v1/bookings/user/active \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

### **Test Live Status API**

```bash
curl -X GET http://localhost:5000/api/v1/bookings/user/BOOKING_ID/live-status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

### **Test WebSocket Connection**

```javascript
// In browser console or Node.js
const io = require('socket.io-client');

const socket = io('http://localhost:5000', {
  auth: { token: 'YOUR_ACCESS_TOKEN' }
});

socket.on('connect', () => console.log('Connected'));
socket.on('user:joined', (data) => console.log('Joined room:', data));
socket.on('driver:location', (data) => console.log('Driver location:', data));
```

---

## Related Documentation

- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - Complete API implementation guide
- [CLAUDE.md](CLAUDE.md) - Project overview and architecture
- Socket.io Configuration: [src/config/socket.js](src/config/socket.js)
- Booking Controller: [src/controllers/booking.controller.js](src/controllers/booking.controller.js)

---

**Last Updated:** January 16, 2025
**API Version:** v1
**Maintained by:** RESQ Backend Team
