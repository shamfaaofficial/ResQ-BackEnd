const asyncHandler = require('express-async-handler');
const Driver = require('../models/Driver');
const User = require('../models/User');
const { deleteFromS3, getSignedFileUrl, extractS3Key } = require('../config/s3');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { APPROVAL_STATUS, DOCUMENT_STATUS } = require('../config/constants');

/**
 * Get all drivers with their documents
 * GET /api/v1/admin/drivers/documents
 * @access Private (Admin only)
 * Query params: status (pending/approved/rejected), page, limit
 */
exports.getAllDriverDocuments = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const query = {};
  if (status) {
    query.approvalStatus = status;
  }

  const drivers = await Driver.find(query)
    .populate('userId', 'phoneNumber profile')
    .populate('reviewedBy', 'profile.firstName profile.lastName')
    .select('documents approvalStatus adminComments reviewedBy createdAt')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Driver.countDocuments(query);

  // Generate signed URLs for documents
  const driversWithSignedUrls = await Promise.all(
    drivers.map(async (driver) => {
      const documentsWithUrls = await Promise.all(
        driver.documents.map(async (doc) => {
          let signedUrl = null;
          if (doc.url) {
            try {
              const s3Key = extractS3Key(doc.url);
              signedUrl = await getSignedFileUrl(s3Key, 3600);
            } catch (error) {
              console.error(`Failed to generate signed URL: ${error}`);
            }
          }

          return {
            id: doc._id,
            type: doc.type,
            url: doc.url,
            signedUrl,
            status: doc.status,
            uploadedAt: doc.uploadedAt,
            verifiedAt: doc.verifiedAt,
            rejectionReason: doc.rejectionReason,
            adminComments: doc.adminComments,
            reviewedBy: doc.reviewedBy,
            reviewedAt: doc.reviewedAt
          };
        })
      );

      return {
        driverId: driver._id,
        userId: driver.userId._id,
        phoneNumber: driver.userId.phoneNumber,
        name: `${driver.userId.profile?.firstName || ''} ${driver.userId.profile?.lastName || ''}`.trim(),
        documents: documentsWithUrls,
        approvalStatus: driver.approvalStatus,
        adminComments: driver.adminComments,
        reviewedBy: driver.reviewedBy,
        createdAt: driver.createdAt
      };
    })
  );

  res.json({
    success: true,
    data: {
      drivers: driversWithSignedUrls,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalDocuments: total,
        limit: parseInt(limit)
      }
    }
  });
});

/**
 * Get drivers with pending documents (needs review)
 * GET /api/v1/admin/drivers/documents/pending
 * @access Private (Admin only)
 */
exports.getPendingDocuments = asyncHandler(async (req, res) => {
  const drivers = await Driver.find({
    $or: [
      { approvalStatus: APPROVAL_STATUS.PENDING },
      { 'documents.status': DOCUMENT_STATUS.PENDING }
    ]
  })
    .populate('userId', 'phoneNumber profile')
    .select('documents approvalStatus createdAt')
    .sort({ createdAt: -1 });

  // Generate signed URLs and filter only pending documents
  const driversWithPendingDocs = await Promise.all(
    drivers.map(async (driver) => {
      const pendingDocs = await Promise.all(
        driver.documents
          .filter(doc => doc.status === DOCUMENT_STATUS.PENDING)
          .map(async (doc) => {
            let signedUrl = null;
            if (doc.url) {
              try {
                const s3Key = extractS3Key(doc.url);
                signedUrl = await getSignedFileUrl(s3Key, 3600);
              } catch (error) {
                console.error(`Failed to generate signed URL: ${error}`);
              }
            }

            return {
              id: doc._id,
              type: doc.type,
              url: doc.url,
              signedUrl,
              status: doc.status,
              uploadedAt: doc.uploadedAt
            };
          })
      );

      return {
        driverId: driver._id,
        userId: driver.userId._id,
        phoneNumber: driver.userId.phoneNumber,
        name: `${driver.userId.profile?.firstName || ''} ${driver.userId.profile?.lastName || ''}`.trim(),
        pendingDocuments: pendingDocs,
        approvalStatus: driver.approvalStatus,
        createdAt: driver.createdAt
      };
    })
  );

  // Filter out drivers with no pending documents
  const filteredDrivers = driversWithPendingDocs.filter(
    driver => driver.pendingDocuments.length > 0
  );

  res.json({
    success: true,
    data: {
      totalDrivers: filteredDrivers.length,
      drivers: filteredDrivers
    }
  });
});

/**
 * Get specific driver's documents
 * GET /api/v1/admin/drivers/:driverId/documents
 * @access Private (Admin only)
 */
exports.getDriverDocuments = asyncHandler(async (req, res) => {
  const { driverId } = req.params;

  const driver = await Driver.findById(driverId)
    .populate('userId', 'phoneNumber profile')
    .populate('reviewedBy', 'profile.firstName profile.lastName')
    .select('documents approvalStatus adminComments reviewedBy createdAt');

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Generate signed URLs
  const documentsWithSignedUrls = await Promise.all(
    driver.documents.map(async (doc) => {
      let signedUrl = null;
      if (doc.url) {
        try {
          const s3Key = extractS3Key(doc.url);
          signedUrl = await getSignedFileUrl(s3Key, 3600);
        } catch (error) {
          console.error(`Failed to generate signed URL: ${error}`);
        }
      }

      return {
        id: doc._id,
        type: doc.type,
        url: doc.url,
        signedUrl,
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
      driverId: driver._id,
      userId: driver.userId._id,
      phoneNumber: driver.userId.phoneNumber,
      name: `${driver.userId.profile?.firstName || ''} ${driver.userId.profile?.lastName || ''}`.trim(),
      documents: documentsWithSignedUrls,
      approvalStatus: driver.approvalStatus,
      adminComments: driver.adminComments,
      reviewedBy: driver.reviewedBy ? {
        id: driver.reviewedBy._id,
        name: `${driver.reviewedBy.profile?.firstName || ''} ${driver.reviewedBy.profile?.lastName || ''}`.trim()
      } : null,
      createdAt: driver.createdAt
    }
  });
});

/**
 * Update document status (approve/reject individual document)
 * PATCH /api/v1/admin/drivers/:driverId/documents/:documentId
 * @access Private (Admin only)
 */
exports.updateDocumentStatus = asyncHandler(async (req, res) => {
  const { driverId, documentId } = req.params;
  const { status, rejectionReason, adminComments } = req.body;
  const adminId = req.user.userId;

  // Validate status
  if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
    throw new ValidationError('Invalid status. Must be: approved, rejected, or pending');
  }

  // Rejection reason required for rejected status
  if (status === 'rejected' && !rejectionReason) {
    throw new ValidationError('Rejection reason is required when rejecting a document');
  }

  const driver = await Driver.findById(driverId);
  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Find document
  const document = driver.documents.id(documentId);
  if (!document) {
    throw new NotFoundError('Document not found');
  }

  // Update document status
  document.status = status;
  document.reviewedBy = adminId;
  document.reviewedAt = new Date();

  if (adminComments) {
    document.adminComments = adminComments;
  }

  if (status === 'approved') {
    document.verifiedAt = new Date();
    document.rejectionReason = undefined;
  } else if (status === 'rejected') {
    document.rejectionReason = rejectionReason;
    document.verifiedAt = undefined;
  }

  await driver.save();

  res.json({
    success: true,
    message: `Document ${status} successfully`,
    data: {
      documentId: document._id,
      type: document.type,
      status: document.status,
      adminComments: document.adminComments,
      rejectionReason: document.rejectionReason,
      reviewedAt: document.reviewedAt
    }
  });
});

/**
 * Bulk update multiple documents
 * PATCH /api/v1/admin/drivers/documents/bulk-update
 * @access Private (Admin only)
 */
exports.bulkUpdateDocuments = asyncHandler(async (req, res) => {
  const { updates } = req.body; // Array of { driverId, documentId, status, rejectionReason, adminComments }
  const adminId = req.user.userId;

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    throw new ValidationError('Updates array is required');
  }

  const results = [];

  for (const update of updates) {
    try {
      const { driverId, documentId, status, rejectionReason, adminComments } = update;

      const driver = await Driver.findById(driverId);
      if (!driver) {
        results.push({ driverId, documentId, success: false, error: 'Driver not found' });
        continue;
      }

      const document = driver.documents.id(documentId);
      if (!document) {
        results.push({ driverId, documentId, success: false, error: 'Document not found' });
        continue;
      }

      document.status = status;
      document.reviewedBy = adminId;
      document.reviewedAt = new Date();

      if (adminComments) {
        document.adminComments = adminComments;
      }

      if (status === 'approved') {
        document.verifiedAt = new Date();
      } else if (status === 'rejected') {
        document.rejectionReason = rejectionReason;
      }

      await driver.save();

      results.push({ driverId, documentId, success: true, status: document.status });
    } catch (error) {
      results.push({ driverId: update.driverId, documentId: update.documentId, success: false, error: error.message });
    }
  }

  res.json({
    success: true,
    message: 'Bulk update completed',
    data: {
      total: updates.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    }
  });
});

/**
 * Approve driver application (approve all documents and activate account)
 * POST /api/v1/admin/drivers/:driverId/approve
 * @access Private (Admin only)
 */
exports.approveDriverApplication = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { adminComments } = req.body;
  const adminId = req.user.userId;

  const driver = await Driver.findById(driverId).populate('userId', 'phoneNumber profile');
  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Approve all documents
  driver.documents.forEach(doc => {
    if (doc.status !== DOCUMENT_STATUS.APPROVED) {
      doc.status = DOCUMENT_STATUS.APPROVED;
      doc.verifiedAt = new Date();
      doc.reviewedBy = adminId;
      doc.reviewedAt = new Date();
    }
  });

  // Approve driver account
  driver.approvalStatus = APPROVAL_STATUS.APPROVED;
  driver.approvalDate = new Date();
  driver.reviewedBy = adminId;

  if (adminComments) {
    driver.adminComments = adminComments;
  }

  await driver.save();

  res.json({
    success: true,
    message: 'Driver application approved successfully',
    data: {
      driverId: driver._id,
      userId: driver.userId._id,
      phoneNumber: driver.userId.phoneNumber,
      name: `${driver.userId.profile?.firstName || ''} ${driver.userId.profile?.lastName || ''}`.trim(),
      approvalStatus: driver.approvalStatus,
      approvalDate: driver.approvalDate,
      adminComments: driver.adminComments
    }
  });
});

/**
 * Reject driver application and delete account
 * DELETE /api/v1/admin/drivers/:driverId/reject
 * @access Private (Admin only)
 */
exports.rejectDriverApplication = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { rejectionReason, adminComments } = req.body;

  if (!rejectionReason) {
    throw new ValidationError('Rejection reason is required');
  }

  const driver = await Driver.findById(driverId).populate('userId', 'phoneNumber profile');
  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  const userId = driver.userId._id;
  const phoneNumber = driver.userId.phoneNumber;
  const driverName = `${driver.userId.profile?.firstName || ''} ${driver.userId.profile?.lastName || ''}`.trim();

  // Delete all documents from S3
  const s3DeletionResults = [];
  for (const doc of driver.documents) {
    if (doc.url) {
      try {
        const s3Key = extractS3Key(doc.url);
        await deleteFromS3(s3Key);
        s3DeletionResults.push({ type: doc.type, deleted: true });
      } catch (error) {
        console.error(`Failed to delete S3 file for ${doc.type}:`, error);
        s3DeletionResults.push({ type: doc.type, deleted: false, error: error.message });
      }
    }
  }

  // Delete Driver document
  await Driver.findByIdAndDelete(driverId);

  // Delete User document
  await User.findByIdAndDelete(userId);

  res.json({
    success: true,
    message: 'Driver application rejected and account deleted successfully',
    data: {
      driverId,
      userId,
      phoneNumber,
      name: driverName,
      rejectionReason,
      adminComments,
      documentsDeleted: s3DeletionResults.filter(r => r.deleted).length,
      totalDocuments: driver.documents.length,
      s3DeletionResults
    }
  });
});
