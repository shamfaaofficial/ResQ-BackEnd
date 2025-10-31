const cloudinary = require('../config/cloudinary');
const fs = require('fs').promises;

class FileUploadService {
  /**
   * Upload file to Cloudinary
   * @param {String} filePath - Local file path
   * @param {String} folder - Cloudinary folder name
   * @returns {Object} Upload result with URL
   */
  async uploadToCloudinary(filePath, folder = 'resq') {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: folder,
        resource_type: 'auto',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ]
      });

      // Delete local file after upload
      await this.deleteLocalFile(filePath);

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        resourceType: result.resource_type
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Upload multiple files to Cloudinary
   * @param {Array} files - Array of file objects with path
   * @param {String} folder - Cloudinary folder name
   * @returns {Array} Array of upload results
   */
  async uploadMultipleToCloudinary(files, folder = 'resq') {
    const uploadPromises = files.map(file =>
      this.uploadToCloudinary(file.path, folder)
    );
    return await Promise.all(uploadPromises);
  }

  /**
   * Delete file from Cloudinary
   * @param {String} publicId - Cloudinary public ID
   * @returns {Object} Deletion result
   */
  async deleteFromCloudinary(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return {
        success: result.result === 'ok',
        result: result.result
      };
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  /**
   * Delete multiple files from Cloudinary
   * @param {Array} publicIds - Array of Cloudinary public IDs
   * @returns {Object} Deletion result
   */
  async deleteMultipleFromCloudinary(publicIds) {
    try {
      const result = await cloudinary.api.delete_resources(publicIds);
      return {
        success: true,
        deleted: result.deleted,
        deletedCount: Object.keys(result.deleted).length
      };
    } catch (error) {
      console.error('Cloudinary bulk delete error:', error);
      throw new Error(`Bulk deletion failed: ${error.message}`);
    }
  }

  /**
   * Delete local file
   * @param {String} filePath - Local file path
   */
  async deleteLocalFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Local file deletion error:', error);
      // Don't throw error for local file deletion
    }
  }

  /**
   * Upload driver document
   * @param {Object} file - Multer file object
   * @param {String} documentType - Type of document (license, registration, etc.)
   * @param {String} driverId - Driver ID
   * @returns {Object} Upload result
   */
  async uploadDriverDocument(file, documentType, driverId) {
    const folder = `resq/drivers/${driverId}/${documentType}`;
    return await this.uploadToCloudinary(file.path, folder);
  }
}

module.exports = new FileUploadService();
