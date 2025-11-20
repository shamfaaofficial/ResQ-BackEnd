# S3 Document Upload API Documentation

This document provides complete API documentation for the driver document upload system using AWS S3.

## Overview

Drivers are required to upload **two documents** for account verification:
1. **Driver License** - Valid driver's license
2. **Vehicle Registration** - Valid vehicle registration document

Documents are uploaded to AWS S3 (bucket: `readytogo-dev-bucket`, region: `ap-southeast-2`) and reviewed by admins before driver approval.

---

## Driver APIs

### 1. Get Document Requirements

Get the list of required documents and their specifications.

**Endpoint:** `GET /api/v1/driver/documents/requirements`

**Authentication:** Required (Driver role)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "required": [
      {
        "type": "license",
        "name": "Driver License",
        "description": "Valid driver license",
        "acceptedFormats": ["image/jpeg", "image/jpg", "image/png", "application/pdf"],
        "maxSize": "5MB"
      },
      {
        "type": "registration",
        "name": "Vehicle Registration",
        "description": "Valid vehicle registration document",
        "acceptedFormats": ["image/jpeg", "image/jpg", "image/png", "application/pdf"],
        "maxSize": "5MB"
      }
    ]
  }
}
```

---

### 2. Get My Documents

Get all documents uploaded by the authenticated driver with signed URLs for viewing.

**Endpoint:** `GET /api/v1/driver/documents`

**Authentication:** Required (Driver role)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "507f1f77bcf86cd799439011",
        "type": "license",
        "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/690f0e1a482c36296774fe6c/license_1763201965537.jpg",
        "signedUrl": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/690f0e1a482c36296774fe6c/license_1763201965537.jpg?X-Amz-Algorithm=...",
        "status": "pending",
        "uploadedAt": "2025-11-15T10:30:00.000Z",
        "verifiedAt": null,
        "rejectionReason": null,
        "adminComments": null,
        "reviewedBy": null,
        "reviewedAt": null,
        "fileName": "license.jpg",
        "fileSize": 2048576,
        "mimeType": "image/jpeg"
      },
      {
        "id": "507f1f77bcf86cd799439012",
        "type": "registration",
        "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/690f0e1a482c36296774fe6c/registration_1763201970000.pdf",
        "signedUrl": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/690f0e1a482c36296774fe6c/registration_1763201970000.pdf?X-Amz-Algorithm=...",
        "status": "approved",
        "uploadedAt": "2025-11-15T10:31:00.000Z",
        "verifiedAt": "2025-11-15T11:00:00.000Z",
        "rejectionReason": null,
        "adminComments": "Document verified",
        "reviewedBy": {
          "id": "507f1f77bcf86cd799439013",
          "name": "Admin User"
        },
        "reviewedAt": "2025-11-15T11:00:00.000Z",
        "fileName": "registration.pdf",
        "fileSize": 1536000,
        "mimeType": "application/pdf"
      }
    ],
    "approvalStatus": "pending",
    "adminComments": null,
    "reviewedBy": null
  }
}
```

**Document Status Values:**
- `pending` - Document uploaded, awaiting admin review
- `approved` - Document approved by admin
- `rejected` - Document rejected by admin

**Note:** `signedUrl` is a temporary URL that expires in 1 hour. Use this URL to display/download the document.

---

### 3. Upload Document

Upload a document (license or registration) to S3.

**Endpoint:** `POST /api/v1/driver/documents/upload`

**Authentication:** Required (Driver role)

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document` | File | Yes | Document file (JPEG, PNG, or PDF) |
| `documentType` | String | Yes | Type of document: `license` or `registration` |

**Example Request (cURL):**
```bash
curl -X POST https://dev.resq-qa.com/api/v1/driver/documents/upload \
  -H "Authorization: Bearer <access_token>" \
  -F "document=@/path/to/license.jpg" \
  -F "documentType=license"
```

**Example Request (JavaScript with FormData):**
```javascript
const formData = new FormData();
formData.append('document', fileInput.files[0]);
formData.append('documentType', 'license');

fetch('https://dev.resq-qa.com/api/v1/driver/documents/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
});
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "type": "license",
    "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/690f0e1a482c36296774fe6c/license_1763201965537.jpg",
    "signedUrl": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/690f0e1a482c36296774fe6c/license_1763201965537.jpg?X-Amz-Algorithm=...",
    "uploadedAt": "2025-11-15T10:30:00.000Z",
    "status": "pending"
  }
}
```

**Error Responses:**

**400 - No File Uploaded:**
```json
{
  "success": false,
  "error": "No file uploaded"
}
```

**400 - Invalid Document Type:**
```json
{
  "success": false,
  "error": "Invalid document type. Only \"license\" and \"registration\" are allowed"
}
```

**400 - Invalid File Type:**
```json
{
  "success": false,
  "error": "Invalid file type. Only JPEG, PNG, and PDF files are allowed."
}
```

**413 - File Too Large:**
```json
{
  "success": false,
  "error": "File too large. Maximum size is 5MB"
}
```

**Validation Rules:**
- File size: Maximum 5MB
- Allowed formats: JPEG, JPG, PNG, PDF
- Allowed document types: `license`, `registration`
- If document already exists, it will be replaced (old file deleted from S3)

---

### 4. Delete Document

Delete a previously uploaded document.

**Endpoint:** `DELETE /api/v1/driver/documents/:documentType`

**Authentication:** Required (Driver role)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentType` | String | Yes | Type of document: `license` or `registration` |

**Example Request:**
```bash
curl -X DELETE https://dev.resq-qa.com/api/v1/driver/documents/license \
  -H "Authorization: Bearer <access_token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Document not found"
}
```

---

## Admin APIs

### 1. Get All Drivers with Documents

Get all drivers with their uploaded documents (with pagination and filtering).

**Endpoint:** `GET /api/v1/admin/drivers/documents`

**Authentication:** Required (Admin role)

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | String | No | - | Filter by approval status: `pending`, `approved`, `rejected` |
| `page` | Number | No | 1 | Page number |
| `limit` | Number | No | 10 | Items per page |

**Example Request:**
```bash
curl https://dev.resq-qa.com/api/v1/admin/drivers/documents?status=pending&page=1&limit=10 \
  -H "Authorization: Bearer <admin_access_token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "drivers": [
      {
        "driverId": "690f0e1a482c36296774fe6c",
        "userId": "690f0e1a482c36296774fe6c",
        "phoneNumber": "+974123456789",
        "name": "John Doe",
        "documents": [
          {
            "id": "507f1f77bcf86cd799439011",
            "type": "license",
            "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/690f0e1a482c36296774fe6c/license_1763201965537.jpg",
            "signedUrl": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/...",
            "status": "pending",
            "uploadedAt": "2025-11-15T10:30:00.000Z",
            "verifiedAt": null,
            "rejectionReason": null,
            "adminComments": null,
            "reviewedBy": null,
            "reviewedAt": null
          }
        ],
        "approvalStatus": "pending",
        "adminComments": null,
        "reviewedBy": null,
        "createdAt": "2025-11-15T09:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalDocuments": 50,
      "limit": 10
    }
  }
}
```

---

### 2. Get Pending Documents

Get all drivers with pending documents that need review.

**Endpoint:** `GET /api/v1/admin/drivers/documents/pending`

**Authentication:** Required (Admin role)

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalDrivers": 3,
    "drivers": [
      {
        "driverId": "690f0e1a482c36296774fe6c",
        "userId": "690f0e1a482c36296774fe6c",
        "phoneNumber": "+974123456789",
        "name": "John Doe",
        "pendingDocuments": [
          {
            "id": "507f1f77bcf86cd799439011",
            "type": "license",
            "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/690f0e1a482c36296774fe6c/license_1763201965537.jpg",
            "signedUrl": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/...",
            "status": "pending",
            "uploadedAt": "2025-11-15T10:30:00.000Z"
          }
        ],
        "approvalStatus": "pending",
        "createdAt": "2025-11-15T09:00:00.000Z"
      }
    ]
  }
}
```

---

### 3. Get Specific Driver's Documents

Get all documents for a specific driver.

**Endpoint:** `GET /api/v1/admin/drivers/:driverId/documents`

**Authentication:** Required (Admin role)

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `driverId` | String | Yes | Driver's MongoDB ObjectId |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "driverId": "690f0e1a482c36296774fe6c",
    "userId": "690f0e1a482c36296774fe6c",
    "phoneNumber": "+974123456789",
    "name": "John Doe",
    "documents": [
      {
        "id": "507f1f77bcf86cd799439011",
        "type": "license",
        "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/690f0e1a482c36296774fe6c/license_1763201965537.jpg",
        "signedUrl": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/...",
        "status": "pending",
        "uploadedAt": "2025-11-15T10:30:00.000Z",
        "verifiedAt": null,
        "rejectionReason": null,
        "adminComments": null,
        "reviewedBy": null,
        "reviewedAt": null,
        "fileName": "license.jpg",
        "fileSize": 2048576,
        "mimeType": "image/jpeg"
      },
      {
        "id": "507f1f77bcf86cd799439012",
        "type": "registration",
        "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/690f0e1a482c36296774fe6c/registration_1763201970000.pdf",
        "signedUrl": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/...",
        "status": "pending",
        "uploadedAt": "2025-11-15T10:31:00.000Z",
        "verifiedAt": null,
        "rejectionReason": null,
        "adminComments": null,
        "reviewedBy": null,
        "reviewedAt": null,
        "fileName": "registration.pdf",
        "fileSize": 1536000,
        "mimeType": "application/pdf"
      }
    ],
    "approvalStatus": "pending",
    "adminComments": null,
    "reviewedBy": null,
    "createdAt": "2025-11-15T09:00:00.000Z"
  }
}
```

---

### 4. Approve/Reject Specific Document

Update the status of a specific document (approve or reject).

**Endpoint:** `PATCH /api/v1/admin/drivers/:driverId/documents/:documentId`

**Authentication:** Required (Admin role)

**Headers:**
```
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `driverId` | String | Yes | Driver's MongoDB ObjectId |
| `documentId` | String | Yes | Document's MongoDB ObjectId |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | String | Yes | `approved`, `rejected`, or `pending` |
| `rejectionReason` | String | Conditional | Required when status is `rejected` |
| `adminComments` | String | No | Admin comments about the document |

**Example Request (Approve):**
```json
{
  "status": "approved",
  "adminComments": "Document verified successfully"
}
```

**Example Request (Reject):**
```json
{
  "status": "rejected",
  "rejectionReason": "Document is blurry and unreadable",
  "adminComments": "Please upload a clearer photo"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Document approved successfully",
  "data": {
    "documentId": "507f1f77bcf86cd799439011",
    "type": "license",
    "status": "approved",
    "adminComments": "Document verified successfully",
    "rejectionReason": null,
    "reviewedAt": "2025-11-15T11:00:00.000Z"
  }
}
```

**Error Responses:**

**400 - Invalid Status:**
```json
{
  "success": false,
  "error": "Invalid status. Must be: approved, rejected, or pending"
}
```

**400 - Missing Rejection Reason:**
```json
{
  "success": false,
  "error": "Rejection reason is required when rejecting a document"
}
```

---

### 5. Bulk Update Documents

Update multiple documents in a single request.

**Endpoint:** `PATCH /api/v1/admin/drivers/documents/bulk-update`

**Authentication:** Required (Admin role)

**Headers:**
```
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `updates` | Array | Yes | Array of update objects |

**Update Object Structure:**
```json
{
  "driverId": "690f0e1a482c36296774fe6c",
  "documentId": "507f1f77bcf86cd799439011",
  "status": "approved",
  "rejectionReason": "Optional rejection reason",
  "adminComments": "Optional admin comments"
}
```

**Example Request:**
```json
{
  "updates": [
    {
      "driverId": "690f0e1a482c36296774fe6c",
      "documentId": "507f1f77bcf86cd799439011",
      "status": "approved",
      "adminComments": "License verified"
    },
    {
      "driverId": "690f0e1a482c36296774fe6c",
      "documentId": "507f1f77bcf86cd799439012",
      "status": "rejected",
      "rejectionReason": "Expired registration",
      "adminComments": "Please upload current registration"
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Bulk update completed",
  "data": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "results": [
      {
        "driverId": "690f0e1a482c36296774fe6c",
        "documentId": "507f1f77bcf86cd799439011",
        "success": true,
        "status": "approved"
      },
      {
        "driverId": "690f0e1a482c36296774fe6c",
        "documentId": "507f1f77bcf86cd799439012",
        "success": true,
        "status": "rejected"
      }
    ]
  }
}
```

---

### 6. Approve Driver Application

Approve all documents and activate the driver account in one action.

**Endpoint:** `POST /api/v1/admin/drivers/:driverId/approve`

**Authentication:** Required (Admin role)

**Headers:**
```
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `driverId` | String | Yes | Driver's MongoDB ObjectId |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `adminComments` | String | No | Comments about the approval |

**Example Request:**
```json
{
  "adminComments": "All documents verified. Driver approved."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Driver application approved successfully",
  "data": {
    "driverId": "690f0e1a482c36296774fe6c",
    "userId": "690f0e1a482c36296774fe6c",
    "phoneNumber": "+974123456789",
    "name": "John Doe",
    "approvalStatus": "approved",
    "approvalDate": "2025-11-15T11:00:00.000Z",
    "adminComments": "All documents verified. Driver approved."
  }
}
```

**Note:** This endpoint:
- Approves ALL documents (sets status to `approved`)
- Sets driver `approvalStatus` to `approved`
- Sets `approvalDate` to current timestamp
- Driver can now accept booking requests

---

### 7. Reject Driver Application and Delete Account

Reject the driver application and permanently delete the driver account and all uploaded documents.

**Endpoint:** `DELETE /api/v1/admin/drivers/:driverId/reject`

**Authentication:** Required (Admin role)

**Headers:**
```
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `driverId` | String | Yes | Driver's MongoDB ObjectId |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rejectionReason` | String | Yes | Reason for rejection |
| `adminComments` | String | No | Additional admin comments |

**Example Request:**
```json
{
  "rejectionReason": "Documents are invalid or fraudulent",
  "adminComments": "Multiple verification issues detected"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Driver application rejected and account deleted successfully",
  "data": {
    "driverId": "690f0e1a482c36296774fe6c",
    "userId": "690f0e1a482c36296774fe6c",
    "phoneNumber": "+974123456789",
    "name": "John Doe",
    "rejectionReason": "Documents are invalid or fraudulent",
    "adminComments": "Multiple verification issues detected",
    "documentsDeleted": 2,
    "totalDocuments": 2,
    "s3DeletionResults": [
      {
        "type": "license",
        "deleted": true
      },
      {
        "type": "registration",
        "deleted": true
      }
    ]
  }
}
```

**Note:** This endpoint:
- Deletes ALL documents from S3
- Deletes the Driver document from database
- Deletes the User document from database
- This action is **permanent and irreversible**

---

## Error Handling

All endpoints follow standard error response format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created (document uploaded) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found (driver/document not found) |
| 413 | Payload Too Large (file > 5MB) |
| 500 | Internal Server Error |

---

## AWS S3 Configuration

**Bucket:** `readytogo-dev-bucket`
**Region:** `ap-southeast-2` (Asia Pacific - Sydney)
**File Access:** Private (requires signed URLs)
**Signed URL Expiry:** 1 hour

**File Naming Convention:**
```
drivers/{driverId}/{documentType}_{timestamp}.{extension}
```

Example:
```
drivers/690f0e1a482c36296774fe6c/license_1763201965537.jpg
drivers/690f0e1a482c36296774fe6c/registration_1763201970000.pdf
```

---

## Driver Approval Workflow

1. **Driver Signs Up** → Account created with status `pending`
2. **Driver Uploads Documents** → Both `license` and `registration` required
3. **Admin Reviews Documents** → Can approve/reject individual documents
4. **Admin Approves Application** → All documents approved, driver account activated
5. **Driver Can Accept Rides** → Driver is now `approved` and can go online

**Rejection Flow:**
- Admin can reject individual documents (driver can re-upload)
- Admin can reject entire application (account permanently deleted)

---

## Testing with Postman/cURL

### Upload License Document:
```bash
curl -X POST https://dev.resq-qa.com/api/v1/driver/documents/upload \
  -H "Authorization: Bearer YOUR_DRIVER_TOKEN" \
  -F "document=@license.jpg" \
  -F "documentType=license"
```

### Upload Registration Document:
```bash
curl -X POST https://dev.resq-qa.com/api/v1/driver/documents/upload \
  -H "Authorization: Bearer YOUR_DRIVER_TOKEN" \
  -F "document=@registration.pdf" \
  -F "documentType=registration"
```

### Admin Approve Document:
```bash
curl -X PATCH https://dev.resq-qa.com/api/v1/admin/drivers/DRIVER_ID/documents/DOCUMENT_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "adminComments": "Document verified"
  }'
```

### Admin Approve Driver:
```bash
curl -X POST https://dev.resq-qa.com/api/v1/admin/drivers/DRIVER_ID/approve \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "adminComments": "All documents verified"
  }'
```

---

## Notes

- All signed URLs expire after 1 hour for security
- Maximum file size: 5MB
- Supported formats: JPEG, JPG, PNG, PDF
- Only 2 document types required: `license` and `registration`
- Drivers cannot accept bookings until approved by admin
- Document re-upload replaces existing document (old file deleted from S3)
