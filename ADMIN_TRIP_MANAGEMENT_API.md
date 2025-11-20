# Admin Trip Management API Documentation

Complete documentation for all admin trip/booking management endpoints in the RESQ platform.

---

## Overview

Admins have full access to view, monitor, and manage all trips in the system including:
- ✅ View all trips (completed, ongoing, cancelled)
- ✅ Real-time active trip monitoring
- ✅ Trip statistics and analytics
- ✅ Revenue reports
- ✅ Individual trip details with timeline
- ✅ Driver rejection/cancellation statistics
- ✅ Cancel or update trip status

All admin endpoints require:
- **Authentication:** Bearer Token (JWT)
- **Role:** `admin`

---

## Table of Contents

1. [Get All Trips (with filters)](#1-get-all-trips)
2. [Get Active Trips](#2-get-active-trips)
3. [Get Trip by ID](#3-get-trip-by-id)
4. [Get Trip Statistics](#4-get-trip-statistics)
5. [Get Revenue Report](#5-get-revenue-report)
6. [Get Trip Timeline](#6-get-trip-timeline)
7. [Cancel Trip](#7-cancel-trip)
8. [Update Trip Status](#8-update-trip-status)
9. [Get Driver Rejection Stats](#9-get-driver-rejection-stats)

---

## 1. Get All Trips

### **Endpoint**
```
GET /api/v1/admin/trips
```

### **Description**
Retrieve all trips with pagination, search, and filtering capabilities. Supports filtering by status, date range, and booking number search.

### **Authentication**
- **Required:** Yes
- **Type:** Bearer Token (JWT)
- **Role:** `admin`

### **Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | Number | No | 1 | Page number for pagination |
| `limit` | Number | No | 10 | Number of trips per page |
| `status` | String | No | - | Filter by booking status |
| `startDate` | Date | No | - | Filter trips from this date (ISO 8601) |
| `endDate` | Date | No | - | Filter trips until this date (ISO 8601) |
| `search` | String | No | - | Search by booking number |
| `sortBy` | String | No | createdAt | Field to sort by |
| `sortOrder` | String | No | desc | Sort order (asc/desc) |

**Valid Status Values:**
- `requested`
- `accepted`
- `payment_completed`
- `driver_arrived`
- `in_progress`
- `completed`
- `cancelled_by_user`
- `cancelled_by_driver`

### **Request Example**

```bash
# Get all completed trips
curl -X GET "http://localhost:5000/api/v1/admin/trips?status=completed&page=1&limit=20" \
  -H "Authorization: Bearer <admin_token>"

# Get trips from last week
curl -X GET "http://localhost:5000/api/v1/admin/trips?startDate=2025-01-10&endDate=2025-01-17" \
  -H "Authorization: Bearer <admin_token>"

# Search by booking number
curl -X GET "http://localhost:5000/api/v1/admin/trips?search=RESQ2025" \
  -H "Authorization: Bearer <admin_token>"
```

### **Success Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "trips": [
      {
        "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
        "bookingNumber": "RESQ20250116001",
        "status": "completed",
        "vehicleType": "sedan",

        "userId": {
          "_id": "65a1b2c3d4e5f6g7h8i9j0k2",
          "phoneNumber": "+97412345678",
          "profile": {
            "firstName": "Ahmed",
            "lastName": "Ali"
          }
        },

        "driverId": {
          "_id": "65a1b2c3d4e5f6g7h8i9j0k3",
          "vehicleDetails": {
            "vehicleType": "sedan",
            "vehicleNumber": "QAT-12345",
            "vehicleMake": "Toyota",
            "vehicleModel": "Camry"
          },
          "userId": {
            "phoneNumber": "+97487654321",
            "profile": {
              "firstName": "Mohammed",
              "lastName": "Hassan"
            }
          }
        },

        "pickupLocation": {
          "type": "Point",
          "coordinates": [51.5074, 25.2854],
          "address": "Al Corniche Street, Doha, Qatar"
        },

        "dropoffLocation": {
          "type": "Point",
          "coordinates": [51.5174, 25.2954],
          "address": "West Bay, Doha, Qatar"
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
          "transactionId": "TXN-789012",
          "paidAmount": 112.5
        },

        "timeline": {
          "requestedAt": "2025-01-16T10:00:00.000Z",
          "acceptedAt": "2025-01-16T10:01:00.000Z",
          "paymentCompletedAt": "2025-01-16T10:03:00.000Z",
          "driverArrivedAt": "2025-01-16T10:15:00.000Z",
          "startedAt": "2025-01-16T10:20:00.000Z",
          "completedAt": "2025-01-16T10:45:00.000Z"
        },

        "driverEarnings": 90,
        "platformCommission": 22.5,

        "createdAt": "2025-01-16T10:00:00.000Z",
        "updatedAt": "2025-01-16T10:45:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "pages": 8
    }
  }
}
```

### **Implementation Example**

```javascript
async function getAllTrips(page = 1, status = null) {
  const params = new URLSearchParams({
    page: page,
    limit: 20
  });

  if (status) {
    params.append('status', status);
  }

  const response = await fetch(`http://localhost:5000/api/v1/admin/trips?${params}`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  });

  const result = await response.json();

  if (result.success) {
    return {
      trips: result.data.trips,
      pagination: result.data.pagination
    };
  }

  throw new Error('Failed to fetch trips');
}
```

---

## 2. Get Active Trips

### **Endpoint**
```
GET /api/v1/admin/trips/active
```

### **Description**
Get all currently active trips in real-time. Includes trips in states: `requested`, `accepted`, `payment_completed`, `driver_arrived`, `in_progress`.

### **Authentication**
- **Required:** Yes
- **Type:** Bearer Token (JWT)
- **Role:** `admin`

### **Query Parameters**
None

### **Success Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "activeTrips": [
      {
        "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
        "bookingNumber": "RESQ20250116002",
        "status": "in_progress",
        "userId": {
          "phoneNumber": "+97412345678",
          "profile": {
            "firstName": "Ahmed",
            "lastName": "Ali"
          }
        },
        "driverId": {
          "vehicleDetails": {
            "vehicleType": "sedan",
            "vehicleNumber": "QAT-12345"
          },
          "currentLocation": {
            "type": "Point",
            "coordinates": [51.5100, 25.2900]
          },
          "userId": {
            "phoneNumber": "+97487654321",
            "profile": {
              "firstName": "Mohammed",
              "lastName": "Hassan"
            }
          }
        },
        "pickupLocation": {
          "coordinates": [51.5074, 25.2854],
          "address": "Al Corniche Street, Doha"
        },
        "dropoffLocation": {
          "coordinates": [51.5174, 25.2954],
          "address": "West Bay, Doha"
        },
        "pricing": {
          "totalAmount": 112.5
        },
        "timeline": {
          "requestedAt": "2025-01-16T11:00:00.000Z",
          "acceptedAt": "2025-01-16T11:01:00.000Z",
          "startedAt": "2025-01-16T11:20:00.000Z"
        },
        "createdAt": "2025-01-16T11:00:00.000Z"
      }
    ],
    "count": 5
  }
}
```

### **Use Case**
- Real-time monitoring dashboard
- View all ongoing trips at a glance
- Quick access to active driver locations

---

## 3. Get Trip by ID

### **Endpoint**
```
GET /api/v1/admin/trips/:tripId
```

### **Description**
Get detailed information about a specific trip including user details, driver details, and payment transaction.

### **URL Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tripId` | String | Yes | MongoDB ObjectId of the trip |

### **Success Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "trip": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "bookingNumber": "RESQ20250116001",
      "status": "completed",
      "vehicleType": "sedan",

      "userId": {
        "_id": "65a1b2c3d4e5f6g7h8i9j0k2",
        "phoneNumber": "+97412345678",
        "profile": {
          "firstName": "Ahmed",
          "lastName": "Ali",
          "email": "ahmed@example.com"
        }
      },

      "driverId": {
        "_id": "65a1b2c3d4e5f6g7h8i9j0k3",
        "vehicleDetails": {
          "vehicleType": "sedan",
          "vehicleNumber": "QAT-12345",
          "vehicleMake": "Toyota",
          "vehicleModel": "Camry",
          "vehicleColor": "White"
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
        "address": "Actual final location"
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
        "paidAt": "2025-01-16T10:03:00.000Z"
      },

      "timeline": {
        "requestedAt": "2025-01-16T10:00:00.000Z",
        "acceptedAt": "2025-01-16T10:01:00.000Z",
        "paymentCompletedAt": "2025-01-16T10:03:00.000Z",
        "driverArrivedAt": "2025-01-16T10:15:00.000Z",
        "startedAt": "2025-01-16T10:20:00.000Z",
        "completedAt": "2025-01-16T10:45:00.000Z"
      },

      "driverEarnings": 90,
      "platformCommission": 22.5,

      "verificationCode": {
        "code": "1234",
        "isVerified": true,
        "verifiedAt": "2025-01-16T10:20:00.000Z"
      },

      "notes": "Please call when you arrive"
    },

    "transaction": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k5",
      "transactionId": "TXN-789012",
      "type": "booking_payment",
      "amount": 112.5,
      "status": "completed",
      "bookingId": "65a1b2c3d4e5f6g7h8i9j0k1",
      "userId": "65a1b2c3d4e5f6g7h8i9j0k2",
      "createdAt": "2025-01-16T10:03:00.000Z"
    }
  }
}
```

### **Error Response (404 Not Found)**

```json
{
  "success": false,
  "error": "Trip not found"
}
```

---

## 4. Get Trip Statistics

### **Endpoint**
```
GET /api/v1/admin/trips/statistics
```

### **Description**
Get comprehensive trip statistics including status breakdown, revenue data, vehicle type distribution, daily trends, and top users/drivers.

### **Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | Date | No | Filter from this date (ISO 8601) |
| `endDate` | Date | No | Filter until this date (ISO 8601) |

### **Success Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalTrips": 1250,
      "completedTrips": 980,
      "totalRevenue": 125000.50,
      "platformCommission": 25000.10,
      "driverEarnings": 100000.40,
      "avgTripValue": 127.55
    },

    "tripsByStatus": [
      {
        "_id": "completed",
        "count": 980
      },
      {
        "_id": "cancelled_by_user",
        "count": 120
      },
      {
        "_id": "cancelled_by_driver",
        "count": 85
      },
      {
        "_id": "in_progress",
        "count": 12
      },
      {
        "_id": "requested",
        "count": 8
      }
    ],

    "tripsByVehicleType": [
      {
        "_id": "sedan",
        "count": 650
      },
      {
        "_id": "suv",
        "count": 320
      },
      {
        "_id": "truck",
        "count": 180
      },
      {
        "_id": "small_car",
        "count": 100
      }
    ],

    "dailyTrips": [
      {
        "_id": "2025-01-10",
        "count": 45
      },
      {
        "_id": "2025-01-11",
        "count": 52
      },
      {
        "_id": "2025-01-12",
        "count": 48
      }
    ],

    "topUsers": [
      {
        "_id": {
          "phoneNumber": "+97412345678",
          "profile": {
            "firstName": "Ahmed",
            "lastName": "Ali"
          }
        },
        "tripCount": 45,
        "totalSpent": 5250.00
      }
    ],

    "topDrivers": [
      {
        "_id": {
          "vehicleDetails": {
            "vehicleNumber": "QAT-12345"
          },
          "userId": {
            "phoneNumber": "+97487654321",
            "profile": {
              "firstName": "Mohammed",
              "lastName": "Hassan"
            }
          }
        },
        "tripCount": 125,
        "totalEarnings": 15000.00
      }
    ]
  }
}
```

### **Use Cases**
- Dashboard analytics
- Business intelligence
- Performance monitoring
- Trend analysis

---

## 5. Get Revenue Report

### **Endpoint**
```
GET /api/v1/admin/trips/revenue-report
```

### **Description**
Generate revenue reports grouped by time period (hour, day, week, month, year). Shows total revenue, platform commission, and driver earnings.

### **Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startDate` | Date | No | - | Report start date (ISO 8601) |
| `endDate` | Date | No | - | Report end date (ISO 8601) |
| `groupBy` | String | No | day | Group by: hour, day, week, month, year |

### **Success Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "report": [
      {
        "_id": "2025-01-16",
        "totalTrips": 48,
        "totalRevenue": 5250.00,
        "platformCommission": 1050.00,
        "driverEarnings": 4200.00
      },
      {
        "_id": "2025-01-17",
        "totalTrips": 52,
        "totalRevenue": 5800.00,
        "platformCommission": 1160.00,
        "driverEarnings": 4640.00
      }
    ],

    "totals": {
      "totalTrips": 100,
      "totalRevenue": 11050.00,
      "platformCommission": 2210.00,
      "driverEarnings": 8840.00
    },

    "period": {
      "startDate": "2025-01-16",
      "endDate": "2025-01-17",
      "groupBy": "day"
    }
  }
}
```

### **Request Examples**

```bash
# Daily revenue report for last week
curl -X GET "http://localhost:5000/api/v1/admin/trips/revenue-report?startDate=2025-01-10&endDate=2025-01-17&groupBy=day" \
  -H "Authorization: Bearer <admin_token>"

# Monthly revenue report for 2025
curl -X GET "http://localhost:5000/api/v1/admin/trips/revenue-report?startDate=2025-01-01&endDate=2025-12-31&groupBy=month" \
  -H "Authorization: Bearer <admin_token>"

# Hourly revenue report for today
curl -X GET "http://localhost:5000/api/v1/admin/trips/revenue-report?startDate=2025-01-16T00:00:00Z&groupBy=hour" \
  -H "Authorization: Bearer <admin_token>"
```

---

## 6. Get Trip Timeline

### **Endpoint**
```
GET /api/v1/admin/trips/:tripId/timeline
```

### **Description**
Get detailed timeline of events for a specific trip from request to completion/cancellation.

### **URL Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tripId` | String | Yes | MongoDB ObjectId of the trip |

### **Success Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "bookingNumber": "RESQ20250116001",
    "currentStatus": "completed",
    "timeline": [
      {
        "event": "Trip Requested",
        "timestamp": "2025-01-16T10:00:00.000Z",
        "status": "requested"
      },
      {
        "event": "Driver Accepted",
        "timestamp": "2025-01-16T10:01:00.000Z",
        "status": "accepted"
      },
      {
        "event": "Payment Completed",
        "timestamp": "2025-01-16T10:03:00.000Z",
        "status": "payment_completed",
        "details": {
          "transactionId": "TXN-789012",
          "amount": 112.5
        }
      },
      {
        "event": "Driver Arrived at Pickup",
        "timestamp": "2025-01-16T10:15:00.000Z",
        "status": "driver_arrived",
        "details": {
          "verificationCode": "1234",
          "verifiedAt": "2025-01-16T10:20:00.000Z"
        }
      },
      {
        "event": "Trip Started",
        "timestamp": "2025-01-16T10:20:00.000Z",
        "status": "in_progress"
      },
      {
        "event": "Trip Completed",
        "timestamp": "2025-01-16T10:45:00.000Z",
        "status": "completed"
      }
    ]
  }
}
```

### **Use Cases**
- Trip investigation
- Customer support
- Audit trail
- Performance analysis

---

## 7. Cancel Trip

### **Endpoint**
```
PATCH /api/v1/admin/trips/:tripId/cancel
```

### **Description**
Admin can cancel any active trip. Automatically handles refunds if payment was completed.

### **URL Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tripId` | String | Yes | MongoDB ObjectId of the trip |

### **Request Body**

```json
{
  "reason": "Customer requested cancellation via support"
}
```

### **Success Response (200 OK)**

```json
{
  "success": true,
  "message": "Trip cancelled successfully",
  "data": {
    "trip": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "bookingNumber": "RESQ20250116001",
      "status": "cancelled_by_user",
      "cancellationDetails": {
        "cancelledBy": "admin",
        "reason": "Customer requested cancellation via support",
        "cancelledAt": "2025-01-16T10:30:00.000Z"
      },
      "timeline": {
        "cancelledAt": "2025-01-16T10:30:00.000Z"
      }
    }
  }
}
```

### **Error Response (400 Bad Request)**

```json
{
  "success": false,
  "error": "Trip cannot be cancelled"
}
```

**Note:** Completed or already cancelled trips cannot be cancelled.

---

## 8. Update Trip Status

### **Endpoint**
```
PATCH /api/v1/admin/trips/:tripId/status
```

### **Description**
Force update trip status. Use with caution - bypasses normal workflow validation.

### **URL Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tripId` | String | Yes | MongoDB ObjectId of the trip |

### **Request Body**

```json
{
  "status": "completed",
  "reason": "Manual completion due to system error"
}
```

### **Valid Status Values**
All booking status values are allowed.

### **Success Response (200 OK)**

```json
{
  "success": true,
  "message": "Trip status updated from in_progress to completed",
  "data": {
    "trip": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "status": "completed",
      "timeline": {
        "completedAt": "2025-01-16T10:50:00.000Z"
      }
    }
  }
}
```

### **Error Responses**

#### 400 Bad Request
```json
{
  "success": false,
  "error": "Status is required"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": "Trip not found"
}
```

---

## 9. Get Driver Rejection Stats

### **Endpoint**
```
GET /api/v1/admin/drivers/:driverId/rejections
```

### **Description**
Get detailed statistics about trips cancelled/rejected by a specific driver. Includes rejection rate, reasons, trends, and latest rejected bookings.

### **URL Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `driverId` | String | Yes | MongoDB ObjectId of the driver |

### **Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | Date | No | Filter from this date (ISO 8601) |
| `endDate` | Date | No | Filter until this date (ISO 8601) |

### **Success Response (200 OK)**

```json
{
  "success": true,
  "data": {
    "driver": {
      "id": "65a1b2c3d4e5f6g7h8i9j0k3",
      "name": "Mohammed Hassan",
      "phoneNumber": "+97487654321"
    },

    "rejectionStats": {
      "totalRejections": 15,
      "rejectionRate": 12.5,
      "totalAcceptedTrips": 120
    },

    "rejectionsByReason": [
      {
        "_id": "Vehicle breakdown",
        "count": 6
      },
      {
        "_id": "Too far",
        "count": 4
      },
      {
        "_id": "Emergency",
        "count": 3
      },
      {
        "_id": "Customer request",
        "count": 2
      }
    ],

    "rejectionTrend": [
      {
        "_id": "2025-01-10",
        "count": 1
      },
      {
        "_id": "2025-01-12",
        "count": 2
      },
      {
        "_id": "2025-01-15",
        "count": 1
      }
    ],

    "rejectedBookings": [
      {
        "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
        "bookingNumber": "RESQ20250116001",
        "status": "cancelled_by_driver",
        "pickupLocation": {
          "address": "Al Corniche Street, Doha"
        },
        "dropoffLocation": {
          "address": "West Bay, Doha"
        },
        "pricing": {
          "totalAmount": 112.5
        },
        "cancellationDetails": {
          "reason": "Vehicle breakdown",
          "cancelledAt": "2025-01-16T10:05:00.000Z"
        },
        "timeline": {
          "acceptedAt": "2025-01-16T10:01:00.000Z",
          "cancelledAt": "2025-01-16T10:05:00.000Z"
        }
      }
    ]
  }
}
```

### **Use Cases**
- Driver performance monitoring
- Identify problematic drivers
- Analyze cancellation patterns
- Make data-driven decisions for driver approval

---

## Common Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (not admin role) |
| 404 | Not Found (trip/driver not found) |
| 500 | Internal Server Error |

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

---

## Complete Implementation Example

```javascript
class AdminTripService {
  constructor(adminToken) {
    this.baseUrl = 'http://localhost:5000/api/v1/admin/trips';
    this.headers = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Get all trips with filters
  async getAllTrips(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${this.baseUrl}?${params}`, {
      headers: this.headers
    });
    return await response.json();
  }

  // Get active trips
  async getActiveTrips() {
    const response = await fetch(`${this.baseUrl}/active`, {
      headers: this.headers
    });
    return await response.json();
  }

  // Get completed trips
  async getCompletedTrips(page = 1) {
    return await this.getAllTrips({
      status: 'completed',
      page: page,
      limit: 20,
      sortBy: 'timeline.completedAt',
      sortOrder: 'desc'
    });
  }

  // Get cancelled trips by driver
  async getDriverCancelledTrips(page = 1) {
    return await this.getAllTrips({
      status: 'cancelled_by_driver',
      page: page,
      limit: 20
    });
  }

  // Get trip details
  async getTripDetails(tripId) {
    const response = await fetch(`${this.baseUrl}/${tripId}`, {
      headers: this.headers
    });
    return await response.json();
  }

  // Get trip statistics
  async getStatistics(startDate = null, endDate = null) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(`${this.baseUrl}/statistics?${params}`, {
      headers: this.headers
    });
    return await response.json();
  }

  // Get revenue report
  async getRevenueReport(startDate, endDate, groupBy = 'day') {
    const params = new URLSearchParams({
      startDate,
      endDate,
      groupBy
    });

    const response = await fetch(`${this.baseUrl}/revenue-report?${params}`, {
      headers: this.headers
    });
    return await response.json();
  }

  // Get trip timeline
  async getTripTimeline(tripId) {
    const response = await fetch(`${this.baseUrl}/${tripId}/timeline`, {
      headers: this.headers
    });
    return await response.json();
  }

  // Cancel trip
  async cancelTrip(tripId, reason) {
    const response = await fetch(`${this.baseUrl}/${tripId}/cancel`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify({ reason })
    });
    return await response.json();
  }

  // Update trip status
  async updateTripStatus(tripId, status, reason) {
    const response = await fetch(`${this.baseUrl}/${tripId}/status`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify({ status, reason })
    });
    return await response.json();
  }

  // Get driver rejection stats
  async getDriverRejectionStats(driverId, startDate = null, endDate = null) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(
      `http://localhost:5000/api/v1/admin/drivers/${driverId}/rejections?${params}`,
      { headers: this.headers }
    );
    return await response.json();
  }
}

// Usage
const adminService = new AdminTripService(adminAccessToken);

// Get all completed trips
const completedTrips = await adminService.getCompletedTrips(1);

// Get active trips
const activeTrips = await adminService.getActiveTrips();

// Get statistics for last month
const stats = await adminService.getStatistics('2024-12-01', '2024-12-31');

// Get revenue report
const revenue = await adminService.getRevenueReport('2025-01-01', '2025-01-31', 'day');

// Cancel a trip
const result = await adminService.cancelTrip('65a1b2c3d4e5f6g7h8i9j0k1', 'Customer request');

// Get driver rejection stats
const driverStats = await adminService.getDriverRejectionStats('65a1b2c3d4e5f6g7h8i9j0k3');
```

---

## Testing the APIs

### **Using cURL**

```bash
# Login as admin first
curl -X POST http://localhost:5000/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919961052060", "password": "Admin@123"}'

# Verify OTP (use OTP from SMS/console)
curl -X POST http://localhost:5000/api/v1/auth/admin/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919961052060", "otp": "123456"}'

# Save the access token from response, then:

# Get all trips
curl -X GET http://localhost:5000/api/v1/admin/trips \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get active trips
curl -X GET http://localhost:5000/api/v1/admin/trips/active \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get trip statistics
curl -X GET http://localhost:5000/api/v1/admin/trips/statistics \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Summary

### **Available Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/trips` | Get all trips with filters |
| GET | `/admin/trips/active` | Get currently active trips |
| GET | `/admin/trips/statistics` | Get trip statistics |
| GET | `/admin/trips/revenue-report` | Get revenue report |
| GET | `/admin/trips/:tripId` | Get trip details |
| GET | `/admin/trips/:tripId/timeline` | Get trip timeline |
| PATCH | `/admin/trips/:tripId/cancel` | Cancel trip |
| PATCH | `/admin/trips/:tripId/status` | Update trip status |
| GET | `/admin/drivers/:driverId/rejections` | Get driver rejection stats |

### **Key Features**

✅ **Comprehensive Trip Viewing**
- All trips with pagination
- Filter by status, date range, booking number
- Real-time active trip monitoring

✅ **Analytics & Reports**
- Trip statistics by status and vehicle type
- Revenue reports with flexible time grouping
- Top users and drivers
- Daily/weekly/monthly trends

✅ **Driver Management**
- Track driver cancellations/rejections
- Calculate rejection rates
- Analyze cancellation reasons
- Monitor driver performance

✅ **Trip Management**
- Cancel trips manually
- Force update trip status
- View complete trip timeline
- Access payment transaction details

---

## Related Documentation

- [ACTIVE_TRIP_TRACKING_API.md](ACTIVE_TRIP_TRACKING_API.md) - User active trip tracking
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - Complete API implementation
- [CLAUDE.md](CLAUDE.md) - Project overview

---

**Last Updated:** January 16, 2025
**API Version:** v1
**Maintained by:** RESQ Backend Team
