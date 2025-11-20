# Socket.IO Real-Time Driver Location Tracking - Frontend Integration Guide

## Overview

This backend provides real-time driver location updates via Socket.IO. Drivers send location updates, and users receive them instantly without polling.

---

## 🔌 Connection Setup

### 1. Socket.IO Client Connection

**Install Socket.IO Client:**
```dart
// For Flutter
socket_io_client: ^2.0.0
```

**Connection URL:**
```
wss://dev.resq-qa.com/socket.io/
```

**Authentication:**
```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

IO.Socket socket = IO.io('https://dev.resq-qa.com', <String, dynamic>{
  'transports': ['websocket', 'polling'],
  'autoConnect': false,
  'auth': {
    'token': 'YOUR_JWT_ACCESS_TOKEN_HERE'  // IMPORTANT: User's JWT token
  },
  'path': '/socket.io/',
});

socket.connect();
```

---

## 📱 User App Integration (Receiving Location Updates)

### Step 1: Connect to Socket.IO

```dart
void connectSocket(String userToken) {
  socket = IO.io('https://dev.resq-qa.com', {
    'transports': ['websocket', 'polling'],
    'autoConnect': false,
    'auth': {'token': userToken},
    'path': '/socket.io/',
  });

  socket.connect();

  // Listen for connection success
  socket.on('connect', (_) {
    print('✅ Socket connected: ${socket.id}');
  });

  // Listen for user room join confirmation
  socket.on('user:joined', (data) {
    print('✅ Joined user room: ${data['room']}');
  });

  // Listen for connection errors
  socket.on('connect_error', (error) {
    print('❌ Socket connection error: $error');
  });
}
```

### Step 2: Listen for Driver Location Updates

```dart
void listenForDriverLocation() {
  socket.on('driver:location', (data) {
    print('📍 Driver location update received:');
    print('Booking ID: ${data['bookingId']}');
    print('Latitude: ${data['latitude']}');
    print('Longitude: ${data['longitude']}');
    print('Timestamp: ${data['timestamp']}');

    // Update UI with new driver location
    updateDriverMarkerOnMap(
      latitude: data['latitude'],
      longitude: data['longitude'],
    );
  });
}
```

### Step 3: Listen for Booking Status Updates

```dart
void listenForBookingUpdates() {
  socket.on('booking:status:update', (data) {
    print('📢 Booking status update:');
    print('Booking ID: ${data['bookingId']}');
    print('New Status: ${data['status']}');
    print('Timeline: ${data['timeline']}');

    // Update booking status in UI
    updateBookingStatus(data);
  });
}
```

### Step 4: Disconnect When Done

```dart
void disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
    print('🔌 Socket disconnected');
  }
}
```

---

## 🚗 Driver App Integration (Sending Location Updates)

### Step 1: Connect to Socket.IO

```dart
void connectDriverSocket(String driverToken) {
  socket = IO.io('https://dev.resq-qa.com', {
    'transports': ['websocket', 'polling'],
    'autoConnect': false,
    'auth': {'token': driverToken},
    'path': '/socket.io/',
  });

  socket.connect();

  // Listen for driver room join confirmation
  socket.on('driver:joined', (data) {
    print('✅ Driver joined room: ${data['room']}');
  });
}
```

### Step 2: Send Location Updates to Backend

**Send updates every 5-10 seconds during active trip:**

```dart
void sendLocationUpdate({
  required String bookingId,
  required double latitude,
  required double longitude,
}) {
  if (socket.connected) {
    socket.emit('driver:location:update', {
      'bookingId': bookingId,
      'latitude': latitude,
      'longitude': longitude,
    });

    print('📍 Sent location update: [$latitude, $longitude]');
  } else {
    print('❌ Socket not connected, cannot send location');
  }
}
```

### Step 3: Send Updates from GPS Stream

```dart
import 'package:geolocator/geolocator.dart';

StreamSubscription<Position>? locationSubscription;

void startLocationTracking(String bookingId) {
  LocationSettings locationSettings = LocationSettings(
    accuracy: LocationAccuracy.high,
    distanceFilter: 10, // Update every 10 meters
  );

  locationSubscription = Geolocator.getPositionStream(
    locationSettings: locationSettings,
  ).listen((Position position) {
    // Send to backend via Socket.IO
    sendLocationUpdate(
      bookingId: bookingId,
      latitude: position.latitude,
      longitude: position.longitude,
    );
  });
}

void stopLocationTracking() {
  locationSubscription?.cancel();
}
```

---

## 🎯 Complete Flow Example

### User App Complete Flow:

```dart
class UserTripScreen extends StatefulWidget {
  @override
  _UserTripScreenState createState() => _UserTripScreenState();
}

class _UserTripScreenState extends State<UserTripScreen> {
  late IO.Socket socket;
  LatLng? driverLocation;
  Marker? driverMarker;

  @override
  void initState() {
    super.initState();
    connectAndListenForDriverLocation();
  }

  void connectAndListenForDriverLocation() {
    // Connect socket
    socket = IO.io('https://dev.resq-qa.com', {
      'transports': ['websocket', 'polling'],
      'autoConnect': false,
      'auth': {'token': getUserToken()}, // Get from your auth service
      'path': '/socket.io/',
    });

    socket.connect();

    // Listen for driver location
    socket.on('driver:location', (data) {
      setState(() {
        driverLocation = LatLng(
          data['latitude'],
          data['longitude'],
        );

        // Update driver marker on map
        driverMarker = Marker(
          markerId: MarkerId('driver'),
          position: driverLocation!,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
        );
      });
    });

    // Listen for booking status updates
    socket.on('booking:status:update', (data) {
      if (data['status'] == 'driver_arrived') {
        showDriverArrivedAlert();
      } else if (data['status'] == 'in_progress') {
        showTripStartedAlert();
      } else if (data['status'] == 'completed') {
        showTripCompletedAlert();
        socket.disconnect();
      }
    });
  }

  @override
  void dispose() {
    socket.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GoogleMap(
        initialCameraPosition: CameraPosition(
          target: LatLng(12.9235599, 74.8413559),
          zoom: 14,
        ),
        markers: driverMarker != null ? {driverMarker!} : {},
      ),
    );
  }
}
```

### Driver App Complete Flow:

```dart
class DriverActiveTrip extends StatefulWidget {
  final String bookingId;

  DriverActiveTrip({required this.bookingId});

  @override
  _DriverActiveTripState createState() => _DriverActiveTripState();
}

class _DriverActiveTripState extends State<DriverActiveTrip> {
  late IO.Socket socket;
  StreamSubscription<Position>? locationSubscription;

  @override
  void initState() {
    super.initState();
    connectSocketAndStartTracking();
  }

  void connectSocketAndStartTracking() {
    // Connect socket
    socket = IO.io('https://dev.resq-qa.com', {
      'transports': ['websocket', 'polling'],
      'autoConnect': false,
      'auth': {'token': getDriverToken()},
      'path': '/socket.io/',
    });

    socket.connect();

    socket.on('connect', (_) {
      print('✅ Driver socket connected');
      startLocationTracking();
    });
  }

  void startLocationTracking() {
    LocationSettings settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10,
    );

    locationSubscription = Geolocator.getPositionStream(
      locationSettings: settings,
    ).listen((Position position) {
      // Send location to backend
      socket.emit('driver:location:update', {
        'bookingId': widget.bookingId,
        'latitude': position.latitude,
        'longitude': position.longitude,
      });

      print('📍 Location sent: [${position.latitude}, ${position.longitude}]');
    });
  }

  @override
  void dispose() {
    locationSubscription?.cancel();
    socket.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Active Trip')),
      body: Center(child: Text('Driving to pickup location...')),
    );
  }
}
```

---

## 📋 Event Reference

### Events Driver Sends (emit):
| Event | Data | Description |
|-------|------|-------------|
| `driver:location:update` | `{bookingId, latitude, longitude}` | Driver sends real-time GPS coordinates |

### Events User Receives (on):
| Event | Data | Description |
|-------|------|-------------|
| `driver:location` | `{bookingId, latitude, longitude, timestamp}` | User receives driver's real-time location |
| `booking:status:update` | `{bookingId, status, timeline}` | Booking status changed (accepted, arrived, etc.) |
| `user:joined` | `{success, room, socketId, userId, timestamp}` | Confirmation of joining user room |

### Events Driver Receives (on):
| Event | Data | Description |
|-------|------|-------------|
| `driver:joined` | `{success, room, socketId, userId, timestamp}` | Confirmation of joining driver room |
| `booking:status:update` | `{bookingId, status, timeline}` | Booking status changed |
| `booking:new:request` | Full booking details | New booking request available |

### Error Events:
| Event | Description |
|-------|-------------|
| `connect_error` | Socket connection failed |
| `error` | General error (missing fields, unauthorized, etc.) |

---

## 🔐 Security Notes

1. **JWT Token Required**: All connections must include valid JWT access token
2. **Auto Room Joining**: Drivers/users are automatically joined to their respective rooms on connection
3. **Authorization Checks**: Backend verifies:
   - Driver is assigned to the booking
   - Booking is in active state (`accepted`, `driver_arrived`, `in_progress`)
   - User can only receive locations for their own bookings

---

## 🐛 Debugging

### Enable Socket.IO Logs (Flutter):

```dart
socket.io.options['log'] = true;
```

### Check Connection Status:

```dart
print('Socket connected: ${socket.connected}');
print('Socket ID: ${socket.id}');
```

### Listen for All Events (Debug Only):

```dart
socket.onAny((event, data) {
  print('📨 Event: $event | Data: $data');
});
```

---

## ⚡ Performance Recommendations

1. **Update Frequency**: Send location updates every **5-10 seconds** or **10+ meters** traveled
2. **Battery Optimization**: Use `distanceFilter` instead of time intervals
3. **Disconnect When Inactive**: Always disconnect socket when trip ends
4. **Error Handling**: Implement reconnection logic for network failures

---

## 📞 Support

**Backend Developer Contact:**
For integration issues, contact your backend team.

**Socket.IO Server:**
- Production: `wss://dev.resq-qa.com/socket.io/`
- Local Development: `ws://localhost:5000/socket.io/`

---

## ✅ Testing Checklist

- [ ] Socket connects successfully with JWT token
- [ ] User receives `user:joined` event
- [ ] Driver receives `driver:joined` event
- [ ] Driver can send location updates
- [ ] User receives driver location updates in real-time
- [ ] Socket disconnects properly on app close
- [ ] Reconnection works after network failure
- [ ] Location updates stop when trip ends

---

**Last Updated:** 2025-11-16
**API Version:** v1
**Socket.IO Version:** 4.x
