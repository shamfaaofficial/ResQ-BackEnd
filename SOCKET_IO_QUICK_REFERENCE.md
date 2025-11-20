# Socket.IO Quick Reference Card

## 🔌 Connection

```dart
socket = IO.io('https://dev.resq-qa.com', {
  'transports': ['websocket', 'polling'],
  'auth': {'token': 'YOUR_JWT_TOKEN'},
  'path': '/socket.io/',
});
socket.connect();
```

---

## 🚗 Driver: Send Location (Every 5-10 seconds)

```dart
socket.emit('driver:location:update', {
  'bookingId': '6919a4daf79201df2c3e3b53',
  'latitude': 12.9235599,
  'longitude': 74.8413559,
});
```

---

## 📱 User: Receive Location

```dart
socket.on('driver:location', (data) {
  double lat = data['latitude'];
  double lng = data['longitude'];
  String bookingId = data['bookingId'];

  // Update map marker
  updateDriverMarker(lat, lng);
});
```

---

## 📊 Coordinate Format

**Backend sends:** `{latitude: 12.92, longitude: 74.84}`
- ✅ Already in `[lat, lng]` format for mobile apps
- No conversion needed!

---

## 🎯 When to Use Socket.IO

| Scenario | Use Socket.IO? |
|----------|----------------|
| Driver sending location updates | ✅ YES |
| User receiving driver location | ✅ YES |
| Booking status changes | ✅ YES (already implemented) |
| Getting booking details | ❌ NO (use REST API) |
| Creating booking | ❌ NO (use REST API) |

---

## ⚠️ Important Notes

1. **JWT Required**: Must pass `auth: {token: 'YOUR_JWT'}` when connecting
2. **Auto Room Join**: You're automatically joined to your user/driver room on connect
3. **Active Trips Only**: Location updates only work for bookings with status:
   - `accepted`
   - `payment_completed`
   - `driver_arrived`
   - `in_progress`
4. **Disconnect When Done**: Call `socket.disconnect()` when trip ends

---

## 🐛 Debug Connection Issues

```dart
socket.on('connect', (_) => print('✅ Connected: ${socket.id}'));
socket.on('connect_error', (e) => print('❌ Error: $e'));
socket.on('disconnect', (r) => print('🔌 Disconnected: $r'));
```

---

## 📞 Need Help?

- Full documentation: See `SOCKET_IO_INTEGRATION_GUIDE.md`
- Server URL: `wss://dev.resq-qa.com/socket.io/`
- Backend logs show all socket events for debugging
