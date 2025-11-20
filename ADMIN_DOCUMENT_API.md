# Admin Document Management API Documentation

## Overview
Admin APIs for viewing, approving, and rejecting driver uploaded documents. All endpoints require admin authentication.

---

## Authentication
All endpoints require:
```http
Authorization: Bearer {admin_access_token}
```

---

## API Endpoints

### 1. Get All Drivers with Documents
Retrieve all drivers and their uploaded documents with filters.

```http
GET /api/v1/admin/drivers/documents
```

**Query Parameters:**
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | number | Page number (default: 1) | `page=1` |
| `limit` | number | Results per page (default: 10) | `limit=20` |
| `documentStatus` | string | Filter by document status | `pending`, `approved`, `rejected` |
| `approvalStatus` | string | Filter by driver approval status | `pending`, `approved`, `rejected` |
| `search` | string | Search by phone number or name | `+974123456` |

**Example Request:**
```bash
GET /api/v1/admin/drivers/documents?documentStatus=pending&page=1&limit=10
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "drivers": [
      {
        "_id": "673abc123def456",
        "driver": {
          "phoneNumber": "+97412345678",
          "name": "Ahmed Ali"
        },
        "documents": [
          {
            "_id": "673doc123",
            "type": "license",
            "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/123/license_1234567890.jpg?X-Amz-...",
            "status": "pending",
            "uploadedAt": "2025-11-15T10:30:00.000Z",
            "fileName": "license.jpg",
            "fileSize": 245678,
            "mimeType": "image/jpeg"
          },
          {
            "_id": "673doc124",
            "type": "registration",
            "url": "https://readytogo-dev-bucket.s3...",
            "status": "approved",
            "uploadedAt": "2025-11-15T10:35:00.000Z",
            "verifiedAt": "2025-11-15T11:00:00.000Z",
            "fileName": "registration.pdf",
            "fileSize": 512345,
            "mimeType": "application/pdf"
          }
        ],
        "approvalStatus": "pending",
        "vehicleType": "sedan",
        "totalDocuments": 2,
        "pendingDocuments": 1,
        "approvedDocuments": 1,
        "rejectedDocuments": 0,
        "createdAt": "2025-11-14T08:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalDrivers": 50,
      "perPage": 10
    }
  }
}
```

---

### 2. Get Specific Driver's Documents
Get all documents uploaded by a specific driver.

```http
GET /api/v1/admin/drivers/:driverId/documents
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `driverId` | string | Yes | MongoDB ObjectId of the driver |

**Example Request:**
```bash
GET /api/v1/admin/drivers/673abc123def456/documents
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "driverId": "673abc123def456",
    "driver": {
      "phoneNumber": "+97412345678",
      "email": "ahmed@example.com",
      "name": "Ahmed Ali",
      "username": "ahmed_driver"
    },
    "approvalStatus": "pending",
    "vehicleDetails": {
      "vehicleType": "sedan",
      "vehicleNumber": "ABC123",
      "vehicleMake": "Toyota",
      "vehicleModel": "Camry"
    },
    "documents": [
      {
        "_id": "673doc123",
        "type": "license",
        "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/...",
        "status": "pending",
        "uploadedAt": "2025-11-15T10:30:00.000Z",
        "fileName": "license.jpg",
        "fileSize": 245678,
        "mimeType": "image/jpeg"
      },
      {
        "_id": "673doc124",
        "type": "registration",
        "url": "https://readytogo-dev-bucket.s3...",
        "status": "approved",
        "uploadedAt": "2025-11-15T10:35:00.000Z",
        "verifiedAt": "2025-11-15T11:00:00.000Z",
        "fileName": "registration.pdf",
        "fileSize": 512345,
        "mimeType": "application/pdf"
      },
      {
        "_id": "673doc125",
        "type": "insurance",
        "url": "https://readytogo-dev-bucket.s3...",
        "status": "rejected",
        "uploadedAt": "2025-11-15T10:40:00.000Z",
        "rejectionReason": "Document expired. Please upload current insurance certificate.",
        "fileName": "insurance.jpg",
        "fileSize": 387654,
        "mimeType": "image/jpeg"
      }
    ],
    "documentsSummary": {
      "total": 3,
      "pending": 1,
      "approved": 1,
      "rejected": 1
    },
    "createdAt": "2025-11-14T08:00:00.000Z",
    "updatedAt": "2025-11-15T10:40:00.000Z"
  }
}
```

---

### 3. Get Pending Documents (Needs Review)
Get all drivers who have pending documents awaiting admin approval.

```http
GET /api/v1/admin/drivers/documents/pending
```

**Query Parameters:**
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `page` | number | Page number | 1 |
| `limit` | number | Results per page | 10 |

**Example Request:**
```bash
GET /api/v1/admin/drivers/documents/pending?page=1&limit=20
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "drivers": [
      {
        "_id": "673abc123def456",
        "driver": {
          "phoneNumber": "+97412345678",
          "name": "Ahmed Ali"
        },
        "pendingDocuments": [
          {
            "_id": "673doc123",
            "type": "license",
            "url": "https://readytogo-dev-bucket.s3...",
            "status": "pending",
            "uploadedAt": "2025-11-15T10:30:00.000Z",
            "fileName": "license.jpg",
            "fileSize": 245678,
            "mimeType": "image/jpeg"
          }
        ],
        "totalPendingDocuments": 1,
        "approvalStatus": "pending",
        "vehicleType": "sedan",
        "createdAt": "2025-11-14T08:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalDrivers": 25,
      "perPage": 10
    }
  }
}
```

---

### 4. Approve/Reject Document
Update the status of a specific document (approve or reject).

```http
PATCH /api/v1/admin/drivers/:driverId/documents/:documentId
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `driverId` | string | Yes | MongoDB ObjectId of the driver |
| `documentId` | string | Yes | MongoDB ObjectId of the document |

**Request Body:**
```json
{
  "status": "approved",  // or "rejected"
  "rejectionReason": "Document is expired" // Required if status is "rejected"
}
```

**Example - Approve Document:**
```bash
PATCH /api/v1/admin/drivers/673abc123def456/documents/673doc123
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "status": "approved"
}
```

**Example - Reject Document:**
```bash
PATCH /api/v1/admin/drivers/673abc123def456/documents/673doc123
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "status": "rejected",
  "rejectionReason": "Document is expired. Please upload a current version."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Document approved successfully",
  "data": {
    "documentId": "673doc123",
    "documentType": "license",
    "status": "approved",
    "verifiedAt": "2025-11-15T12:00:00.000Z",
    "driverApprovalStatus": "approved"
  }
}
```

**Note:** If all required documents (license, registration, insurance) are approved, the driver's `approvalStatus` will automatically be set to `approved`.

---

### 5. Bulk Approve/Reject Documents
Update multiple documents in a single request.

```http
PATCH /api/v1/admin/drivers/documents/bulk-update
```

**Request Body:**
```json
{
  "updates": [
    {
      "driverId": "673abc123def456",
      "documentId": "673doc123",
      "status": "approved"
    },
    {
      "driverId": "673abc123def456",
      "documentId": "673doc124",
      "status": "rejected",
      "rejectionReason": "Poor image quality"
    },
    {
      "driverId": "673abc789def789",
      "documentId": "673doc125",
      "status": "approved"
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Bulk update completed: 2 succeeded, 1 failed",
  "data": {
    "results": [
      {
        "driverId": "673abc123def456",
        "documentId": "673doc123",
        "documentType": "license",
        "success": true,
        "status": "approved"
      },
      {
        "driverId": "673abc123def456",
        "documentId": "673doc124",
        "documentType": "registration",
        "success": true,
        "status": "rejected"
      },
      {
        "driverId": "673abc789def789",
        "documentId": "673doc125",
        "success": false,
        "error": "Document not found"
      }
    ],
    "summary": {
      "total": 3,
      "succeeded": 2,
      "failed": 1
    }
  }
}
```

---

## Document Status Values

| Status | Description |
|--------|-------------|
| `pending` | Document uploaded, awaiting admin review |
| `approved` | Document verified and approved by admin |
| `rejected` | Document rejected by admin (see `rejectionReason`) |

---

## Document Types

| Type | Description | Required |
|------|-------------|----------|
| `license` | Driver's License | ✅ Yes |
| `registration` | Vehicle Registration | ✅ Yes |
| `insurance` | Insurance Certificate | ✅ Yes |
| `vehicle_photo` | Vehicle Photo | ⚠️ Recommended |
| `profile_photo` | Driver Profile Photo | ⚠️ Recommended |
| `national_id` | National ID | ❌ Optional |
| `other` | Other documents | ❌ Optional |

---

## Auto-Approval Logic

When admin approves the **last required document** (license, registration, insurance):
1. Document status changes to `approved`
2. `verifiedAt` timestamp is set
3. **Driver's `approvalStatus`** automatically changes to `approved`
4. Driver can now accept booking requests

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request (missing fields, invalid status) |
| 401 | Unauthorized (missing or invalid admin token) |
| 403 | Forbidden (not an admin) |
| 404 | Not Found (driver or document not found) |
| 500 | Internal Server Error |

---

## Common Error Responses

**Document Not Found (404):**
```json
{
  "success": false,
  "error": "Document not found"
}
```

**Invalid Status (400):**
```json
{
  "success": false,
  "error": "Invalid status. Must be one of: pending, approved, rejected"
}
```

**Missing Rejection Reason (400):**
```json
{
  "success": false,
  "error": "Rejection reason is required when rejecting a document"
}
```

---

## Admin Workflow

### Typical Document Review Process:

1. **Get Pending Documents:**
   ```
   GET /api/v1/admin/drivers/documents/pending
   ```

2. **View Driver Details:**
   ```
   GET /api/v1/admin/drivers/{driverId}/documents
   ```

3. **Review Each Document:**
   - Click on signed URL to view/download
   - Verify document is valid, clear, and current

4. **Approve or Reject:**
   ```
   PATCH /api/v1/admin/drivers/{driverId}/documents/{documentId}
   {
     "status": "approved" // or "rejected"
   }
   ```

5. **If All Required Documents Approved:**
   - Driver automatically approved
   - Driver can start accepting rides

---

## Notes

- **Signed URLs** are valid for 1 hour
- Documents are stored privately in S3
- Rejecting a document clears the `verifiedAt` timestamp
- Approving a document clears any previous `rejectionReason`
- All actions are logged for audit purposes

---

## Testing in Postman

### Collection Setup:

1. **Login as Admin:**
   ```
   POST /api/v1/auth/admin/login
   ```

2. **Get Pending Documents:**
   ```
   GET /api/v1/admin/drivers/documents/pending
   Headers: Authorization: Bearer {admin_token}
   ```

3. **View Specific Driver:**
   ```
   GET /api/v1/admin/drivers/{driverId}/documents
   Headers: Authorization: Bearer {admin_token}
   ```

4. **Approve Document:**
   ```
   PATCH /api/v1/admin/drivers/{driverId}/documents/{documentId}
   Headers: Authorization: Bearer {admin_token}
   Body: { "status": "approved" }
   ```

---

**Ready to use! 🎉**
