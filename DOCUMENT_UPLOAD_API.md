# Driver Document Upload API Documentation

## Overview
Driver document upload system using AWS S3 for secure storage. Supports uploading driving licenses, vehicle registration, insurance, photos, and other required documents.

## S3 Configuration
- **Region**: ap-southeast-2 (Asia Pacific - Sydney)
- **Bucket**: readytogo-dev-bucket
- **File Path Structure**: `drivers/{driverId}/{documentType}_{timestamp}.{extension}`

## API Endpoints

### 1. Get Document Requirements
Get information about required documents and upload guidelines.

```http
GET /api/v1/driver/documents/requirements
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requiredDocuments": [
      {
        "type": "license",
        "name": "Driver's License",
        "description": "Valid driver's license (front and back)",
        "required": true,
        "formats": ["image/jpeg", "image/png", "application/pdf"],
        "maxSize": "5MB"
      },
      {
        "type": "registration",
        "name": "Vehicle Registration",
        "description": "Vehicle registration certificate",
        "required": true,
        "formats": ["image/jpeg", "image/png", "application/pdf"],
        "maxSize": "5MB"
      },
      {
        "type": "insurance",
        "name": "Insurance Certificate",
        "description": "Valid vehicle insurance certificate",
        "required": true,
        "formats": ["image/jpeg", "image/png", "application/pdf"],
        "maxSize": "5MB"
      },
      {
        "type": "vehicle_photo",
        "name": "Vehicle Photo",
        "description": "Clear photo of your tow truck",
        "required": true,
        "formats": ["image/jpeg", "image/png"],
        "maxSize": "5MB"
      },
      {
        "type": "profile_photo",
        "name": "Profile Photo",
        "description": "Professional profile photo",
        "required": false,
        "formats": ["image/jpeg", "image/png"],
        "maxSize": "2MB"
      }
    ],
    "guidelines": [
      "All documents must be clear and readable",
      "Documents must be current and not expired",
      "Photos should be well-lit with no glare",
      "Accepted formats: JPEG, PNG, PDF",
      "Maximum file size: 5MB per document"
    ]
  }
}
```

---

### 2. Upload Document
Upload a driver document to S3.

```http
POST /api/v1/driver/documents/upload
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

**Form Data:**
- `document` (file): The document file to upload
- `documentType` (string): Type of document (license, registration, insurance, vehicle_photo, profile_photo, other)

**Example using cURL:**
```bash
curl -X POST https://dev.resq-qa.com/api/v1/driver/documents/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "document=@/path/to/license.jpg" \
  -F "documentType=license"
```

**Example using Postman:**
1. Method: POST
2. URL: `https://dev.resq-qa.com/api/v1/driver/documents/upload`
3. Headers: `Authorization: Bearer {your_token}`
4. Body:
   - Type: form-data
   - Key: `document`, Type: File, Value: Select file
   - Key: `documentType`, Type: Text, Value: `license`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "documentType": "license",
    "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/123/license_1234567890.jpg",
    "status": "pending",
    "uploadedAt": "2025-11-15T10:30:00.000Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid document type. Must be one of: license, registration, insurance, vehicle_photo, profile_photo, other"
}
```

**Supported Document Types:**
- `license` - Driver's License
- `registration` - Vehicle Registration
- `insurance` - Insurance Certificate
- `vehicle_photo` - Vehicle Photo
- `profile_photo` - Profile Photo
- `national_id` - National ID (optional)
- `other` - Other documents

**File Validation:**
- **Allowed formats**: JPEG, JPG, PNG, PDF
- **Max file size**: 5MB
- **Content-Type**: Automatically detected from file

---

### 3. Get My Documents
Retrieve all uploaded documents with temporary signed URLs for secure access.

```http
GET /api/v1/driver/documents
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "_id": "673abc123def456",
        "type": "license",
        "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/123/license_1234567890.jpg?X-Amz-Algorithm=...",
        "status": "approved",
        "uploadedAt": "2025-11-15T10:30:00.000Z",
        "verifiedAt": "2025-11-15T11:00:00.000Z",
        "fileName": "license.jpg",
        "fileSize": 245678,
        "mimeType": "image/jpeg"
      },
      {
        "_id": "673abc123def457",
        "type": "registration",
        "url": "https://readytogo-dev-bucket.s3.ap-southeast-2.amazonaws.com/drivers/123/registration_1234567891.pdf?X-Amz-Algorithm=...",
        "status": "pending",
        "uploadedAt": "2025-11-15T10:35:00.000Z",
        "fileName": "vehicle-registration.pdf",
        "fileSize": 512345,
        "mimeType": "application/pdf"
      }
    ],
    "totalDocuments": 2
  }
}
```

**Note**: URLs are pre-signed and expire after 1 hour for security.

**Document Status Values:**
- `pending` - Uploaded, awaiting admin verification
- `approved` - Verified and approved by admin
- `rejected` - Rejected by admin (check `rejectionReason`)

---

### 4. Delete Document
Delete an uploaded document from S3 and database.

```http
DELETE /api/v1/driver/documents/:documentType
Authorization: Bearer {access_token}
```

**Example:**
```bash
curl -X DELETE https://dev.resq-qa.com/api/v1/driver/documents/license \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
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
  "error": "Document of type 'license' not found"
}
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid file type, missing fields, etc.) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (not a driver) |
| 404 | Not Found (document or driver not found) |
| 413 | Payload Too Large (file exceeds 5MB) |
| 500 | Internal Server Error |

---

## Security Features

1. **Authentication Required**: All endpoints require valid JWT access token
2. **Role-Based Access**: Only drivers can access these endpoints
3. **Private S3 Files**: All files stored with `ACL: private`
4. **Signed URLs**: Temporary URLs generated with 1-hour expiration
5. **File Validation**: Only images and PDFs allowed, max 5MB
6. **Secure Storage**: Files organized by driver ID in S3

---

## File Organization in S3

```
readytogo-dev-bucket/
└── drivers/
    └── {driverId}/
        ├── license_1234567890.jpg
        ├── registration_1234567891.pdf
        ├── insurance_1234567892.jpg
        ├── vehicle_photo_1234567893.jpg
        └── profile_photo_1234567894.jpg
```

---

## Upload Flow

```
1. Driver App → POST /api/v1/driver/documents/upload
2. Backend validates file (type, size)
3. Backend uploads to S3 (drivers/{driverId}/{type}_{timestamp}.ext)
4. Backend saves S3 URL to Driver.documents array
5. Backend returns S3 URL and status
6. Admin reviews document
7. Admin approves/rejects via admin panel
8. Driver sees updated status in app
```

---

## Testing with Postman

1. **Get Access Token**:
   - Login as driver: `POST /api/v1/auth/driver/login`
   - Copy `accessToken` from response

2. **Upload Document**:
   - Create new request: `POST /api/v1/driver/documents/upload`
   - Add header: `Authorization: Bearer {accessToken}`
   - Body → form-data:
     - Key: `document`, Type: File
     - Key: `documentType`, Type: Text, Value: `license`
   - Send request

3. **View Documents**:
   - `GET /api/v1/driver/documents`
   - Add header: `Authorization: Bearer {accessToken}`

4. **Delete Document**:
   - `DELETE /api/v1/driver/documents/license`
   - Add header: `Authorization: Bearer {accessToken}`

---

## Frontend Implementation (Flutter Example)

```dart
Future<void> uploadDocument(File file, String documentType) async {
  final uri = Uri.parse('$baseUrl/api/v1/driver/documents/upload');
  final request = http.MultipartRequest('POST', uri);

  // Add authorization header
  final token = await getAccessToken();
  request.headers['Authorization'] = 'Bearer $token';

  // Add file
  request.files.add(await http.MultipartFile.fromPath(
    'document',
    file.path,
    contentType: MediaType('image', 'jpeg'),
  ));

  // Add document type
  request.fields['documentType'] = documentType;

  // Send request
  final response = await request.send();

  if (response.statusCode == 200) {
    final responseData = await response.stream.bytesToString();
    print('Upload successful: $responseData');
  } else {
    print('Upload failed: ${response.statusCode}');
  }
}
```

---

## S3 Bucket Configuration

**Bucket**: readytogo-dev-bucket
**Region**: ap-southeast-2
**Access**: Private (signed URLs only)
**CORS**: Configured for upload/download

**IAM Permissions Required**:
- `s3:PutObject` - Upload files
- `s3:GetObject` - Generate signed URLs
- `s3:DeleteObject` - Delete files

---

## Notes

- Old documents are automatically deleted from S3 when uploading a new document of the same type
- URLs in GET response are temporary (1-hour expiration)
- Documents default to `pending` status after upload
- Admin must approve documents before driver account is fully activated
- All uploads are logged for audit purposes
