const asyncHandler = require('express-async-handler');
const Driver = require('../models/Driver');
const { getSignedFileUrl, extractS3Key } = require('../config/s3');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { DOCUMENT_STATUS } = require('../config/constants');

/**
 * ADMIN - Get all drivers with their documents
 * GET /api/v1/admin/drivers/documents
 */
exports.getAllDriverDocuments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    documentStatus, // Filter by document status (pending, approved, rejected)
    approvalStatus, // Filter by driver approval status
    search
  } = req.query;

  // Build query
  const query = {};

  // Filter by driver approval status
  if (approvalStatus) {
    query.approvalStatus = approvalStatus;
  }

  // Filter by document status (check if any document has this status)
  if (documentStatus) {
    query['documents.status'] = documentStatus;
  }

  // Get drivers with populated user info
  let drivers = await Driver.find(query)
    .populate({
      path: 'userId',
      select: 'phoneNumber profile username'
    })
    .select('userId documents approvalStatus vehicleDetails createdAt')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  // Search by phone number or name if provided
  if (search) {
    drivers = drivers.filter(driver => {
      const phoneMatch = driver.userId?.phoneNumber?.includes(search);
      const nameMatch = driver.userId?.profile?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
                       driver.userId?.profile?.lastName?.toLowerCase().includes(search.toLowerCase());
      return phoneMatch || nameMatch;
    });
  }

  // Generate signed URLs for all documents
  const driversWithSignedUrls = await Promise.all(
    drivers.map(async (driver) => {
      const documentsWithUrls = await Promise.all(
        (driver.documents || []).map(async (doc) => {
          try {
            const key = extractS3Key(doc.url);
            const signedUrl = await getSignedFileUrl(key, 3600); // 1 hour

            return {
              ...doc,
              url: signedUrl
            };
          } catch (error) {
            console.error(`⚠️  [Admin] Failed to generate signed URL for driver ${driver._id}:`, error.message);
            return {
              ...doc,
              url: null,
              error: 'Failed to generate download URL'
            };
          }
        })
      );

      return {
        _id: driver._id,
        driver: {
          phoneNumber: driver.userId?.phoneNumber,
          name: driver.userId?.profile?.firstName && driver.userId?.profile?.lastName
            ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName}`
            : driver.userId?.username || 'N/A'
        },
        documents: documentsWithUrls,
        approvalStatus: driver.approvalStatus,
        vehicleType: driver.vehicleDetails?.vehicleType,
        totalDocuments: documentsWithUrls.length,
        pendingDocuments: documentsWithUrls.filter(d => d.status === 'pending').length,
        approvedDocuments: documentsWithUrls.filter(d => d.status === 'approved').length,
        rejectedDocuments: documentsWithUrls.filter(d => d.status === 'rejected').length,
        createdAt: driver.createdAt
      };
    })
  );

  // Get total count for pagination
  const totalDrivers = await Driver.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      drivers: driversWithSignedUrls,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalDrivers / parseInt(limit)),
        totalDrivers,
        perPage: parseInt(limit)
      }
    }
  });
});

/**
 * ADMIN - Get specific driver's documents
 * GET /api/v1/admin/drivers/:driverId/documents
 */
exports.getDriverDocuments = asyncHandler(async (req, res) => {
  const { driverId } = req.params;

  const driver = await Driver.findById(driverId)
    .populate({
      path: 'userId',
      select: 'phoneNumber profile username email'
    })
    .select('userId documents approvalStatus vehicleDetails createdAt updatedAt')
    .lean();

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Generate signed URLs for documents
  const documentsWithSignedUrls = await Promise.all(
    (driver.documents || []).map(async (doc) => {
      try {
        const key = extractS3Key(doc.url);
        const signedUrl = await getSignedFileUrl(key, 3600); // 1 hour expiry

        return {
          _id: doc._id,
          type: doc.type,
          url: signedUrl,
          status: doc.status,
          uploadedAt: doc.uploadedAt,
          verifiedAt: doc.verifiedAt,
          rejectionReason: doc.rejectionReason,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType
        };
      } catch (error) {
        console.error(`⚠️  [Admin] Failed to generate signed URL:`, error.message);
        return {
          _id: doc._id,
          type: doc.type,
          url: null,
          status: doc.status,
          error: 'Failed to generate download URL'
        };
      }
    })
  );

  res.status(200).json({
    success: true,
    data: {
      driverId: driver._id,
      driver: {
        phoneNumber: driver.userId?.phoneNumber,
        email: driver.userId?.email,
        name: driver.userId?.profile?.firstName && driver.userId?.profile?.lastName
          ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName}`
          : driver.userId?.username || 'N/A',
        username: driver.userId?.username
      },
      approvalStatus: driver.approvalStatus,
      vehicleDetails: driver.vehicleDetails,
      documents: documentsWithSignedUrls,
      documentsSummary: {
        total: documentsWithSignedUrls.length,
        pending: documentsWithSignedUrls.filter(d => d.status === 'pending').length,
        approved: documentsWithSignedUrls.filter(d => d.status === 'approved').length,
        rejected: documentsWithSignedUrls.filter(d => d.status === 'rejected').length
      },
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt
    }
  });
});

/**
 * ADMIN - Approve/Reject a specific document
 * PATCH /api/v1/admin/drivers/:driverId/documents/:documentId
 */
exports.updateDocumentStatus = asyncHandler(async (req, res) => {
  const { driverId, documentId } = req.params;
  const { status, rejectionReason, adminComments } = req.body;
  const adminId = req.user.userId; // From auth middleware

  // Validate status
  const validStatuses = Object.values(DOCUMENT_STATUS);
  if (!status || !validStatuses.includes(status)) {
    throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // If rejecting, rejection reason is required
  if (status === 'rejected' && !rejectionReason) {
    throw new ValidationError('Rejection reason is required when rejecting a document');
  }

  const driver = await Driver.findById(driverId).populate('userId', 'phoneNumber profile');
  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Find the document
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
    document.rejectionReason = undefined; // Clear rejection reason if previously rejected
  } else if (status === 'rejected') {
    document.rejectionReason = rejectionReason;
    document.verifiedAt = undefined;
  }

  await driver.save();

  // Check if all required documents are approved
  const requiredDocTypes = ['license', 'registration', 'insurance'];
  const hasAllRequired = requiredDocTypes.every(type =>
    driver.documents.some(doc => doc.type === type && doc.status === 'approved')
  );

  // Auto-approve driver if all required documents are approved
  if (hasAllRequired && driver.approvalStatus === 'pending') {
    driver.approvalStatus = 'approved';
    driver.approvalDate = new Date();
    await driver.save();

    console.log(`✅ [Admin] Driver ${driverId} auto-approved - all required documents verified`);
  }

  console.log(`✅ [Admin] Document ${documentId} status updated to: ${status}`);

  res.status(200).json({
    success: true,
    message: `Document ${status} successfully`,
    data: {
      documentId: document._id,
      documentType: document.type,
      status: document.status,
      verifiedAt: document.verifiedAt,
      rejectionReason: document.rejectionReason,
      driverApprovalStatus: driver.approvalStatus
    }
  });
});

/**
 * ADMIN - Get drivers with pending documents (needs review)
 * GET /api/v1/admin/drivers/documents/pending
 */
exports.getPendingDocuments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  // Find drivers with pending documents
  const drivers = await Driver.find({
    'documents.status': 'pending'
  })
    .populate({
      path: 'userId',
      select: 'phoneNumber profile username'
    })
    .select('userId documents approvalStatus vehicleDetails createdAt')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  // Generate signed URLs and filter to only pending documents
  const driversWithPendingDocs = await Promise.all(
    drivers.map(async (driver) => {
      const pendingDocuments = driver.documents.filter(doc => doc.status === 'pending');

      const documentsWithUrls = await Promise.all(
        pendingDocuments.map(async (doc) => {
          try {
            const key = extractS3Key(doc.url);
            const signedUrl = await getSignedFileUrl(key, 3600);

            return {
              _id: doc._id,
              type: doc.type,
              url: signedUrl,
              status: doc.status,
              uploadedAt: doc.uploadedAt,
              fileName: doc.fileName,
              fileSize: doc.fileSize,
              mimeType: doc.mimeType
            };
          } catch (error) {
            return {
              _id: doc._id,
              type: doc.type,
              url: null,
              status: doc.status,
              error: 'Failed to generate download URL'
            };
          }
        })
      );

      return {
        _id: driver._id,
        driver: {
          phoneNumber: driver.userId?.phoneNumber,
          name: driver.userId?.profile?.firstName && driver.userId?.profile?.lastName
            ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName}`
            : driver.userId?.username || 'N/A'
        },
        pendingDocuments: documentsWithUrls,
        totalPendingDocuments: documentsWithUrls.length,
        approvalStatus: driver.approvalStatus,
        vehicleType: driver.vehicleDetails?.vehicleType,
        createdAt: driver.createdAt
      };
    })
  );

  const totalCount = await Driver.countDocuments({
    'documents.status': 'pending'
  });

  res.status(200).json({
    success: true,
    data: {
      drivers: driversWithPendingDocs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalDrivers: totalCount,
        perPage: parseInt(limit)
      }
    }
  });
});

/**
 * ADMIN - Bulk approve/reject multiple documents
 * PATCH /api/v1/admin/drivers/documents/bulk-update
 */
exports.bulkUpdateDocuments = asyncHandler(async (req, res) => {
  const { updates } = req.body;

  // Validate input
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new ValidationError('Updates array is required and must not be empty');
  }

  // Validate each update
  updates.forEach((update, index) => {
    if (!update.driverId || !update.documentId || !update.status) {
      throw new ValidationError(`Update at index ${index} is missing required fields (driverId, documentId, status)`);
    }
  });

  const results = [];

  for (const update of updates) {
    try {
      const { driverId, documentId, status, rejectionReason } = update;

      const driver = await Driver.findById(driverId);
      if (!driver) {
        results.push({
          driverId,
          documentId,
          success: false,
          error: 'Driver not found'
        });
        continue;
      }

      const document = driver.documents.id(documentId);
      if (!document) {
        results.push({
          driverId,
          documentId,
          success: false,
          error: 'Document not found'
        });
        continue;
      }

      // Update status
      document.status = status;

      if (status === 'approved') {
        document.verifiedAt = new Date();
        document.rejectionReason = undefined;
      } else if (status === 'rejected' && rejectionReason) {
        document.rejectionReason = rejectionReason;
        document.verifiedAt = undefined;
      }

      await driver.save();

      results.push({
        driverId,
        documentId,
        documentType: document.type,
        success: true,
        status: document.status
      });

    } catch (error) {
      results.push({
        driverId: update.driverId,
        documentId: update.documentId,
        success: false,
        error: error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  res.status(200).json({
    success: true,
    message: `Bulk update completed: ${successCount} succeeded, ${failureCount} failed`,
    data: {
      results,
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: failureCount
      }
    }
  });
});

/**
 * ADMIN - Reject driver application and delete account
 * DELETE /api/v1/admin/drivers/:driverId/reject
 */
exports.rejectDriverApplication = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { rejectionReason, adminComments } = req.body;
  const adminId = req.user.userId;
  const User = require('../models/User');
  const { deleteFromS3, extractS3Key } = require('../config/s3');

  if (!rejectionReason) {
    throw new ValidationError('Rejection reason is required');
  }

  const driver = await Driver.findById(driverId).populate('userId');
  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  const userId = driver.userId._id;
  const phoneNumber = driver.userId.phoneNumber;

  console.log(`🗑️  [Admin] Rejecting driver application: ${driverId}`);
  console.log(`   Phone: ${phoneNumber}`);
  console.log(`   Reason: ${rejectionReason}`);

  // Delete all uploaded documents from S3
  if (driver.documents && driver.documents.length > 0) {
    console.log(`   Deleting ${driver.documents.length} document(s) from S3...`);

    for (const doc of driver.documents) {
      try {
        const s3Key = extractS3Key(doc.url);
        await deleteFromS3(s3Key);
        console.log(`   ✅ Deleted: ${s3Key}`);
      } catch (error) {
        console.error(`   ⚠️  Failed to delete: ${doc.url} - ${error.message}`);
        // Continue even if S3 delete fails
      }
    }
  }

  // Delete Driver document
  await Driver.findByIdAndDelete(driverId);
  console.log(`   ✅ Driver document deleted`);

  // Delete User document
  await User.findByIdAndDelete(userId);
  console.log(`   ✅ User account deleted`);

  console.log(`✅ [Admin] Driver application rejected and account deleted`);

  res.status(200).json({
    success: true,
    message: 'Driver application rejected and account deleted successfully',
    data: {
      driverId,
      phoneNumber,
      rejectionReason,
      adminComments,
      deletedAt: new Date()
    }
  });
});

/**
 * ADMIN - Approve driver (mark all documents as approved and activate account)
 * POST /api/v1/admin/drivers/:driverId/approve
 */
exports.approveDriverApplication = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { adminComments } = req.body;
  const adminId = req.user.userId;

  const driver = await Driver.findById(driverId).populate('userId', 'phoneNumber profile');
  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  // Check if driver already approved
  if (driver.approvalStatus === 'approved') {
    return res.status(400).json({
      success: false,
      error: 'Driver is already approved'
    });
  }

  // Check if all required documents are uploaded
  const requiredDocTypes = ['license', 'registration', 'insurance'];
  const uploadedDocTypes = driver.documents.map(doc => doc.type);

  const missingDocs = requiredDocTypes.filter(type => !uploadedDocTypes.includes(type));

  if (missingDocs.length > 0) {
    throw new ValidationError(`Cannot approve driver. Missing required documents: ${missingDocs.join(', ')}`);
  }

  // Approve all documents
  driver.documents.forEach(doc => {
    if (doc.status !== 'approved') {
      doc.status = 'approved';
      doc.verifiedAt = new Date();
      doc.reviewedBy = adminId;
      doc.reviewedAt = new Date();
      doc.rejectionReason = undefined;
    }
  });

  // Approve driver
  driver.approvalStatus = 'approved';
  driver.approvalDate = new Date();
  driver.reviewedBy = adminId;

  if (adminComments) {
    driver.adminComments = adminComments;
  }

  await driver.save();

  console.log(`✅ [Admin] Driver ${driverId} approved and activated`);

  res.status(200).json({
    success: true,
    message: 'Driver approved and activated successfully',
    data: {
      driverId: driver._id,
      phoneNumber: driver.userId.phoneNumber,
      approvalStatus: driver.approvalStatus,
      approvalDate: driver.approvalDate,
      adminComments: driver.adminComments,
      totalDocuments: driver.documents.length,
      approvedDocuments: driver.documents.filter(d => d.status === 'approved').length
    }
  });
});

module.exports = {
  getAllDriverDocuments,
  getDriverDocuments,
  updateDocumentStatus,
  getPendingDocuments,
  bulkUpdateDocuments,
  rejectDriverApplication,
  approveDriverApplication
};
