const asyncHandler = require('express-async-handler');
const Driver = require('../models/Driver');
const { uploadToS3, deleteFromS3, getSignedFileUrl, extractS3Key } = require('../config/s3');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { DOCUMENT_TYPES, DOCUMENT_STATUS } = require('../config/constants');

/**
 * Upload driver document to S3
 * POST /api/v1/driver/documents/upload
 */
exports.uploadDocument = asyncHandler(async (req, res) => {
  const driverId = req.user.userId; // From auth middleware
  const { documentType } = req.body;

  // Validate document type
  const validDocTypes = ['license', 'registration', 'insurance', 'vehicle_photo', 'profile_photo', 'other'];
  if (!documentType || !validDocTypes.includes(documentType)) {
    throw new ValidationError(`Invalid document type. Must be one of: ${validDocTypes.join(', ')}`);
  }

  // Check if file was uploaded
  if (!req.file) {
    throw new ValidationError('No file uploaded. Please provide a file.');
  }

  // Find driver
  const driver = await Driver.findOne({ userId: driverId });
  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  try {
    // Generate S3 file path: drivers/{driverId}/{documentType}_{timestamp}.{ext}
    const fileExtension = req.file.originalname.split('.').pop();
    const timestamp = Date.now();
    const s3FileName = `drivers/${driver._id}/${documentType}_${timestamp}.${fileExtension}`;

    // Upload to S3
    const s3Url = await uploadToS3(
      req.file.buffer,
      s3FileName,
      req.file.mimetype
    );

    // If there's an existing document of this type, delete the old one from S3
    const existingDoc = driver.documents.find(doc => doc.type === documentType);
    if (existingDoc && existingDoc.url) {
      try {
        const oldKey = extractS3Key(existingDoc.url);
        await deleteFromS3(oldKey);
        console.log(`🗑️  [Document] Deleted old document from S3: ${oldKey}`);
      } catch (error) {
        console.error(`⚠️  [Document] Failed to delete old document:`, error.message);
        // Continue even if delete fails
      }
    }

    // Update or add document in driver's documents array
    const documentIndex = driver.documents.findIndex(doc => doc.type === documentType);

    const documentData = {
      type: documentType,
      url: s3Url,
      uploadedAt: new Date(),
      status: 'pending', // Admin needs to verify
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    };

    if (documentIndex >= 0) {
      // Update existing document
      driver.documents[documentIndex] = {
        ...driver.documents[documentIndex],
        ...documentData
      };
    } else {
      // Add new document
      driver.documents.push(documentData);
    }

    await driver.save();

    console.log(`✅ [Document] Uploaded successfully: ${documentType} for driver ${driver._id}`);

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        documentType,
        url: s3Url,
        status: 'pending',
        uploadedAt: documentData.uploadedAt
      }
    });
  } catch (error) {
    console.error(`❌ [Document] Upload failed:`, error);
    throw new Error(`Document upload failed: ${error.message}`);
  }
});

/**
 * Get all documents for logged-in driver
 * GET /api/v1/driver/documents
 */
exports.getMyDocuments = asyncHandler(async (req, res) => {
  const driverId = req.user.userId;

  const driver = await Driver.findOne({ userId: driverId }).select('documents');
  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Generate signed URLs for private documents
  const documentsWithSignedUrls = await Promise.all(
    driver.documents.map(async (doc) => {
      try {
        const key = extractS3Key(doc.url);
        const signedUrl = await getSignedFileUrl(key, 3600); // 1 hour expiry

        return {
          _id: doc._id,
          type: doc.type,
          url: signedUrl, // Temporary signed URL
          status: doc.status,
          uploadedAt: doc.uploadedAt,
          verifiedAt: doc.verifiedAt,
          rejectionReason: doc.rejectionReason,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType
        };
      } catch (error) {
        console.error(`⚠️  [Document] Failed to generate signed URL:`, error.message);
        return {
          _id: doc._id,
          type: doc.type,
          url: null,
          status: doc.status,
          uploadedAt: doc.uploadedAt,
          error: 'Failed to generate download URL'
        };
      }
    })
  );

  res.status(200).json({
    success: true,
    data: {
      documents: documentsWithSignedUrls,
      totalDocuments: driver.documents.length
    }
  });
});

/**
 * Delete a document
 * DELETE /api/v1/driver/documents/:documentType
 */
exports.deleteDocument = asyncHandler(async (req, res) => {
  const driverId = req.user.userId;
  const { documentType } = req.params;

  const driver = await Driver.findOne({ userId: driverId });
  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Find the document
  const docIndex = driver.documents.findIndex(doc => doc.type === documentType);
  if (docIndex === -1) {
    throw new NotFoundError(`Document of type '${documentType}' not found`);
  }

  const document = driver.documents[docIndex];

  // Delete from S3
  try {
    const s3Key = extractS3Key(document.url);
    await deleteFromS3(s3Key);
    console.log(`🗑️  [Document] Deleted from S3: ${s3Key}`);
  } catch (error) {
    console.error(`⚠️  [Document] S3 deletion failed:`, error.message);
    // Continue to remove from database even if S3 delete fails
  }

  // Remove from driver documents array
  driver.documents.splice(docIndex, 1);
  await driver.save();

  console.log(`✅ [Document] Deleted successfully: ${documentType} for driver ${driver._id}`);

  res.status(200).json({
    success: true,
    message: 'Document deleted successfully'
  });
});

/**
 * Get document upload requirements/info
 * GET /api/v1/driver/documents/requirements
 */
exports.getDocumentRequirements = asyncHandler(async (req, res) => {
  const requirements = {
    requiredDocuments: [
      {
        type: 'license',
        name: 'Driver\'s License',
        description: 'Valid driver\'s license (front and back)',
        required: true,
        formats: ['image/jpeg', 'image/png', 'application/pdf'],
        maxSize: '5MB'
      },
      {
        type: 'registration',
        name: 'Vehicle Registration',
        description: 'Vehicle registration certificate',
        required: true,
        formats: ['image/jpeg', 'image/png', 'application/pdf'],
        maxSize: '5MB'
      },
      {
        type: 'insurance',
        name: 'Insurance Certificate',
        description: 'Valid vehicle insurance certificate',
        required: true,
        formats: ['image/jpeg', 'image/png', 'application/pdf'],
        maxSize: '5MB'
      },
      {
        type: 'vehicle_photo',
        name: 'Vehicle Photo',
        description: 'Clear photo of your tow truck',
        required: true,
        formats: ['image/jpeg', 'image/png'],
        maxSize: '5MB'
      },
      {
        type: 'profile_photo',
        name: 'Profile Photo',
        description: 'Professional profile photo',
        required: false,
        formats: ['image/jpeg', 'image/png'],
        maxSize: '2MB'
      }
    ],
    guidelines: [
      'All documents must be clear and readable',
      'Documents must be current and not expired',
      'Photos should be well-lit with no glare',
      'Accepted formats: JPEG, PNG, PDF',
      'Maximum file size: 5MB per document'
    ]
  };

  res.status(200).json({
    success: true,
    data: requirements
  });
});

module.exports = {
  uploadDocument,
  getMyDocuments,
  deleteDocument,
  getDocumentRequirements
};
