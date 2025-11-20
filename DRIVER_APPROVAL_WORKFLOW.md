# Driver Application & Approval Workflow

## Complete Driver Onboarding Flow

### Overview
This document describes the complete driver registration, document upload, and admin approval workflow.

---

## Driver Registration Flow

### 1. Driver Sends OTP (Signup)
```http
POST /api/v1/auth/driver/signup
Content-Type: application/json

{
  "phoneNumber": "+97412345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "phoneNumber": "+97412345678",
    "expiresIn": 300
  }
}
```

---

### 2. Driver Verifies OTP
```http
POST /api/v1/auth/driver/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+97412345678",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully. Please complete your signup.",
  "data": {
    "phoneNumber": "+97412345678",
    "verified": true
  }
}
```

---

### 3. Driver Completes Signup
```http
POST /api/v1/auth/driver/complete-signup
Content-Type: application/json

{
  "phoneNumber": "+97412345678",
  "username": "ahmed_driver",
  "password": "StrongPass123!",
  "profile": {
    "firstName": "Ahmed",
    "lastName": "Ali"
  },
  "vehicleDetails": {
    "vehicleType": "sedan",
    "vehicleNumber": "ABC123",
    "vehicleMake": "Toyota",
    "vehicleModel": "Camry",
    "vehicleYear": 2020
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Driver account created successfully. Please upload required documents for verification.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "driver": {
      "_id": "673abc123def456",
      "phoneNumber": "+97412345678",
      "username": "ahmed_driver",
      "role": "driver",
      "approvalStatus": "pending", // ⚠️ Account is PENDING - cannot accept rides yet
      "profile": {
        "firstName": "Ahmed",
        "lastName": "Ali"
      }
    }
  }
}
```

**Important:**
- ✅ Account is created with `approvalStatus: "pending"`
- ❌ Driver **CANNOT** accept booking requests until approved
- 📄 Driver must upload required documents
- 👨‍💼 Admin must approve documents

---

### 4. Driver Uploads Documents

Driver must upload these **required** documents:

#### a. Upload Driver's License
```http
POST /api/v1/driver/documents/upload
Authorization: Bearer {driver_access_token}
Content-Type: multipart/form-data

Form Data:
  - document: [license.jpg file]
  - documentType: license
```

#### b. Upload Vehicle Registration
```http
POST /api/v1/driver/documents/upload
Authorization: Bearer {driver_access_token}
Content-Type: multipart/form-data

Form Data:
  - document: [registration.pdf file]
  - documentType: registration
```

#### c. Upload Insurance Certificate
```http
POST /api/v1/driver/documents/upload
Authorization: Bearer {driver_access_token}
Content-Type: multipart/form-data

Form Data:
  - document: [insurance.jpg file]
  - documentType: insurance
```

**Response (for each upload):**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "documentType": "license",
    "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/123/license_1234567890.jpg",
    "status": "pending", // Awaiting admin review
    "uploadedAt": "2025-11-15T10:30:00.000Z"
  }
}
```

---

## Admin Review & Approval Flow

### 5. Admin Views Pending Drivers
```http
GET /api/v1/admin/drivers/documents/pending
Authorization: Bearer {admin_access_token}
```

**Response:**
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
            "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/...",
            "status": "pending",
            "uploadedAt": "2025-11-15T10:30:00.000Z"
          },
          {
            "_id": "673doc124",
            "type": "registration",
            "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/...",
            "status": "pending"
          },
          {
            "_id": "673doc125",
            "type": "insurance",
            "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/...",
            "status": "pending"
          }
        ],
        "totalPendingDocuments": 3,
        "approvalStatus": "pending"
      }
    ]
  }
}
```

---

### 6. Admin Reviews Individual Documents

#### Option A: Approve Individual Document (with comments)
```http
PATCH /api/v1/admin/drivers/673abc123def456/documents/673doc123
Authorization: Bearer {admin_access_token}
Content-Type: application/json

{
  "status": "approved",
  "adminComments": "Document verified. License is valid until 2027."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Document approved successfully",
  "data": {
    "documentId": "673doc123",
    "documentType": "license",
    "status": "approved",
    "verifiedAt": "2025-11-15T12:00:00.000Z",
    "driverApprovalStatus": "pending" // Still pending until ALL required docs approved
  }
}
```

#### Option B: Reject Individual Document (with reason and comments)
```http
PATCH /api/v1/admin/drivers/673abc123def456/documents/673doc124
Authorization: Bearer {admin_access_token}
Content-Type: application/json

{
  "status": "rejected",
  "rejectionReason": "Document is expired",
  "adminComments": "Please upload a current vehicle registration certificate. The uploaded document expired on 10/2024."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Document rejected successfully",
  "data": {
    "documentId": "673doc124",
    "documentType": "registration",
    "status": "rejected",
    "rejectionReason": "Document is expired",
    "driverApprovalStatus": "pending"
  }
}
```

---

### 7. Admin Approval Options

#### Option A: Approve All Documents + Activate Driver (One Click)
```http
POST /api/v1/admin/drivers/673abc123def456/approve
Authorization: Bearer {admin_access_token}
Content-Type: application/json

{
  "adminComments": "All documents verified. Driver approved to start operations."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Driver approved and activated successfully",
  "data": {
    "driverId": "673abc123def456",
    "phoneNumber": "+97412345678",
    "approvalStatus": "approved", // ✅ Driver is now ACTIVE
    "approvalDate": "2025-11-15T12:30:00.000Z",
    "adminComments": "All documents verified. Driver approved to start operations.",
    "totalDocuments": 3,
    "approvedDocuments": 3
  }
}
```

**What Happens:**
- ✅ All documents marked as `approved`
- ✅ Driver `approvalStatus` changed to `approved`
- ✅ Driver can now accept booking requests
- ✅ Driver can go online

---

#### Option B: Reject Driver Application + Delete Account
```http
DELETE /api/v1/admin/drivers/673abc123def456/reject
Authorization: Bearer {admin_access_token}
Content-Type: application/json

{
  "rejectionReason": "Invalid documents provided",
  "adminComments": "Driver submitted fake license and registration. Application permanently rejected."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Driver application rejected and account deleted successfully",
  "data": {
    "driverId": "673abc123def456",
    "phoneNumber": "+97412345678",
    "rejectionReason": "Invalid documents provided",
    "adminComments": "Driver submitted fake license and registration. Application permanently rejected.",
    "deletedAt": "2025-11-15T12:45:00.000Z"
  }
}
```

**What Happens:**
- 🗑️ All uploaded documents deleted from S3
- 🗑️ Driver document deleted from database
- 🗑️ User account deleted from database
- ❌ Driver permanently removed from system

---

## Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    DRIVER REGISTRATION                          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
              1. Send OTP to phone number
                           │
                           ▼
              2. Verify OTP (6-digit code)
                           │
                           ▼
         3. Complete signup (profile + vehicle)
                           │
                           ▼
    ┌──────────────────────────────────────────────────┐
    │ Driver Account Created                           │
    │ Status: PENDING (Cannot accept rides yet)        │
    └──────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DOCUMENT UPLOAD                              │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
         Driver uploads 3 required documents:
         ✓ License
         ✓ Registration
         ✓ Insurance
                           │
                           ▼
    ┌──────────────────────────────────────────────────┐
    │ All Documents Status: PENDING                    │
    │ Waiting for admin review                         │
    └──────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN REVIEW                                 │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
                 Admin has 2 options:
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
    ┌─────────────┐               ┌──────────────┐
    │  APPROVE    │               │   REJECT     │
    │  DRIVER     │               │   DRIVER     │
    └─────────────┘               └──────────────┘
           │                               │
           ▼                               ▼
 ✅ All docs approved         ❌ Delete all documents from S3
 ✅ Status: APPROVED          ❌ Delete driver from database
 ✅ Can accept rides          ❌ Delete user account
 ✅ Can go online             ❌ Permanently removed
```

---

## Driver States

| State | Description | Can Login? | Can Upload Docs? | Can Accept Rides? | Can Go Online? |
|-------|-------------|------------|------------------|-------------------|----------------|
| **Registered** | Account created, OTP verified | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Documents Uploaded** | All required docs uploaded | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Pending Review** | Admin reviewing documents | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Approved** | Admin approved all documents | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Rejected** | Admin rejected application | ❌ No (deleted) | ❌ No (deleted) | ❌ No | ❌ No |

---

## API Summary

### Driver APIs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/auth/driver/signup` | POST | Send OTP |
| `/api/v1/auth/driver/verify-otp` | POST | Verify OTP |
| `/api/v1/auth/driver/complete-signup` | POST | Create account (status: pending) |
| `/api/v1/driver/documents/upload` | POST | Upload documents |
| `/api/v1/driver/documents` | GET | View my documents |

### Admin APIs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/admin/drivers/documents/pending` | GET | View drivers awaiting review |
| `/api/v1/admin/drivers/:id/documents` | GET | View specific driver's docs |
| `/api/v1/admin/drivers/:id/documents/:docId` | PATCH | Approve/reject individual document |
| `/api/v1/admin/drivers/:id/approve` | POST | Approve driver + activate account |
| `/api/v1/admin/drivers/:id/reject` | DELETE | Reject driver + delete account |

---

## Request Body Examples

### Approve Individual Document
```json
{
  "status": "approved",
  "adminComments": "License verified. Valid until 2027."
}
```

### Reject Individual Document
```json
{
  "status": "rejected",
  "rejectionReason": "Document expired",
  "adminComments": "Please upload current registration valid until at least 2026."
}
```

### Approve Entire Driver Application
```json
{
  "adminComments": "All documents verified. Driver approved to operate."
}
```

### Reject Entire Driver Application
```json
{
  "rejectionReason": "Submitted fraudulent documents",
  "adminComments": "License number does not match government records. Application permanently rejected."
}
```

---

## Important Notes

1. **Driver Registration:**
   - Account created with `approvalStatus: "pending"`
   - Driver can login but cannot accept rides
   - Must upload 3 required documents

2. **Document Upload:**
   - Documents uploaded to S3 with private access
   - Status defaults to `pending`
   - Driver can re-upload rejected documents

3. **Admin Review:**
   - Admin can approve/reject individual documents
   - Admin can add comments (visible to driver)
   - Admin can approve entire driver in one click
   - Admin can reject and delete account permanently

4. **Auto-Approval:**
   - When last required document is approved individually
   - Driver status automatically changes to `approved`
   - Driver can immediately start accepting rides

5. **Rejection:**
   - Rejected drivers are permanently deleted
   - All S3 documents deleted
   - Cannot re-register with same phone number (unless admin removes from blocklist)

---

**Complete driver approval workflow implemented! 🎉**
