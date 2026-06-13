const asyncHandler = require('express-async-handler');
const Driver = require('../models/Driver');
const { uploadToS3, deleteFromS3, getSignedFileUrl, extractS3Key } = require('../config/s3');
const { ValidationError, NotFoundError } = require('../utils/errors');
const path = require('path');

/**
 * Get document requirements/types
 * GET /api/v1/driver/documents/requirements
 * @access Private (Driver only)
 */
exports.getDocumentRequirements = asyncHandler(async (req, res) => {
  const requirements = {
    required: [
      {
        type: 'license',
        name: 'Driver License',
        description: 'Valid driver license',
        acceptedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
        maxSize: '5MB'
      },
      {
        type: 'registration',
        name: 'Vehicle Registration',
        description: 'Valid vehicle registration document',
        acceptedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
        maxSize: '5MB'
      },
      {
        type: 'vehicle_image',
        name: 'Vehicle Image',
        description: 'Clear photo of the vehicle',
        acceptedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        maxSize: '5MB'
      }
    ]
  };

  res.json({
    success: true,
    data: requirements
  });
});

/**
 * Get driver's own documents
 * GET /api/v1/driver/documents
 * @access Private (Driver only)
 */
exports.getMyDocuments = asyncHandler(async (req, res) => {
  const driverId = req.userId;

  const driver = await Driver.findOne({ userId: driverId })
    .select('documents approvalStatus adminComments reviewedBy reviewedAt')
    .populate('reviewedBy', 'profile.firstName profile.lastName');

  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Generate signed URLs for all documents
  const documentsWithSignedUrls = await Promise.all(
    driver.documents.map(async (doc) => {
      let signedUrl = null;
      if (doc.url) {
        try {
          const s3Key = extractS3Key(doc.url);
          signedUrl = await getSignedFileUrl(s3Key, 3600); // 1 hour expiry
        } catch (error) {
          console.error(`Failed to generate signed URL for ${doc.url}:`, error);
        }
      }

      return {
        id: doc._id,
        type: doc.type,
        url: doc.url,
        signedUrl, // Temporary access URL (expires in 1 hour)
        status: doc.status,
        uploadedAt: doc.uploadedAt,
        verifiedAt: doc.verifiedAt,
        rejectionReason: doc.rejectionReason,
        adminComments: doc.adminComments,
        reviewedBy: doc.reviewedBy ? {
          id: doc.reviewedBy._id,
          name: `${doc.reviewedBy.profile?.firstName || ''} ${doc.reviewedBy.profile?.lastName || ''}`.trim()
        } : null,
        reviewedAt: doc.reviewedAt,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType
      };
    })
  );

  res.json({
    success: true,
    data: {
      documents: documentsWithSignedUrls,
      approvalStatus: driver.approvalStatus,
      adminComments: driver.adminComments,
      reviewedBy: driver.reviewedBy ? {
        id: driver.reviewedBy._id,
        name: `${driver.reviewedBy.profile?.firstName || ''} ${driver.reviewedBy.profile?.lastName || ''}`.trim()
      } : null
    }
  });
});

/**
 * Upload document to S3
 * POST /api/v1/driver/documents/upload
 * @access Private (Driver only)
 */
exports.uploadDocument = asyncHandler(async (req, res) => {
  const driverId = req.userId;
  const { documentType, vehicleType } = req.body;

  const validDocTypes = ['license', 'registration', 'vehicle_image'];
  if (!documentType || !validDocTypes.includes(documentType)) {
    throw new ValidationError('Invalid document type. Must be "license", "registration", or "vehicle_image"');
  }

  if (!req.file) {
    throw new ValidationError('No file uploaded');
  }

  const driver = await Driver.findOne({ userId: driverId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const fileExtension = path.extname(req.file.originalname);
  const s3FileName = `drivers/${driver._id}/${documentType}_${Date.now()}${fileExtension}`;
  const s3Url = await uploadToS3(req.file.buffer, s3FileName, req.file.mimetype);

  // Vehicle image goes into vehicleDetails.vehicleImages, not documents array
  if (documentType === 'vehicle_image') {
    driver.vehicleDetails.vehicleImages.push(s3Url);
    await driver.save();

    const signedUrl = await getSignedFileUrl(s3FileName, 3600);

    return res.status(201).json({
      success: true,
      message: 'Vehicle image uploaded successfully',
      data: {
        type: 'vehicle_image',
        url: s3Url,
        signedUrl,
        uploadedAt: new Date(),
        vehicleType: driver.vehicleDetails.vehicleType || null
      }
    });
  }

  // license / registration flow
  const existingDocIndex = driver.documents.findIndex(doc => doc.type === documentType);

  if (existingDocIndex !== -1) {
    try {
      const oldS3Key = extractS3Key(driver.documents[existingDocIndex].url);
      await deleteFromS3(oldS3Key);
    } catch (error) {
      console.error('Failed to delete old S3 file:', error);
    }

    driver.documents[existingDocIndex] = {
      type: documentType,
      url: s3Url,
      uploadedAt: new Date(),
      status: 'pending',
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      verifiedAt: undefined,
      rejectionReason: undefined,
      adminComments: undefined,
      reviewedBy: undefined,
      reviewedAt: undefined
    };
  } else {
    driver.documents.push({
      type: documentType,
      url: s3Url,
      uploadedAt: new Date(),
      status: 'pending',
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });
  }

  await driver.save();

  const signedUrl = await getSignedFileUrl(s3FileName, 3600);

  res.status(201).json({
    success: true,
    message: 'Document uploaded successfully',
    data: {
      type: documentType,
      url: s3Url,
      signedUrl,
      uploadedAt: new Date(),
      status: 'pending'
    }
  });
});

/**
 * Delete document
 * DELETE /api/v1/driver/documents/:documentType
 * @access Private (Driver only)
 */
exports.deleteDocument = asyncHandler(async (req, res) => {
  const driverId = req.userId;
  const { documentType } = req.params;

  const driver = await Driver.findOne({ userId: driverId });
  if (!driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Find document
  const docIndex = driver.documents.findIndex(doc => doc.type === documentType);
  if (docIndex === -1) {
    throw new NotFoundError('Document not found');
  }

  // Delete from S3
  try {
    const s3Key = extractS3Key(driver.documents[docIndex].url);
    await deleteFromS3(s3Key);
  } catch (error) {
    console.error('Failed to delete S3 file:', error);
    // Continue to remove from database even if S3 deletion fails
  }

  // Remove from driver's documents array
  driver.documents.splice(docIndex, 1);
  await driver.save();

  res.json({
    success: true,
    message: 'Document deleted successfully'
  });
});
