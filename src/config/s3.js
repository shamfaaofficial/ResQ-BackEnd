const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// S3 Configuration
const s3Config = {
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
};

const s3Client = new S3Client(s3Config);

const bucketName = process.env.AWS_S3_BUCKET || 'readytogo-dev-bucket';

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} fileName - File name with path (e.g., 'drivers/123/license.jpg')
 * @param {String} mimeType - File MIME type
 * @returns {Promise<String>} S3 file URL
 */
const uploadToS3 = async (fileBuffer, fileName, mimeType) => {
  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimeType,
        ACL: 'private' // Files are private, use signed URLs to access
      }
    });

    await upload.done();

    // Return the S3 URL
    const fileUrl = `https://${bucketName}.s3.${s3Config.region}.amazonaws.com/${fileName}`;

    console.log(`✅ [S3] File uploaded successfully: ${fileName}`);
    return fileUrl;
  } catch (error) {
    console.error(`❌ [S3] Upload failed:`, error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
};

/**
 * Delete file from S3
 * @param {String} fileName - File name/key in S3
 * @returns {Promise<void>}
 */
const deleteFromS3 = async (fileName) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: fileName
    });

    await s3Client.send(command);
    console.log(`✅ [S3] File deleted successfully: ${fileName}`);
  } catch (error) {
    console.error(`❌ [S3] Delete failed:`, error);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
};

/**
 * Generate signed URL for private file access
 * @param {String} fileName - File name/key in S3
 * @param {Number} expiresIn - URL expiration in seconds (default: 1 hour)
 * @returns {Promise<String>} Signed URL
 */
const getSignedFileUrl = async (fileName, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error(`❌ [S3] Failed to generate signed URL:`, error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

/**
 * Extract S3 key from full URL
 * @param {String} url - Full S3 URL
 * @returns {String} S3 key/filename
 */
const extractS3Key = (url) => {
  try {
    // Extract key from URL like: https://bucket.s3.region.amazonaws.com/path/to/file.jpg
    const urlParts = url.split('.amazonaws.com/');
    return urlParts[1] || url;
  } catch (error) {
    return url;
  }
};

/**
 * Check if S3 is configured
 * @returns {Boolean}
 */
const isS3Configured = () => {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
};

module.exports = {
  s3Client,
  bucketName,
  uploadToS3,
  deleteFromS3,
  getSignedFileUrl,
  extractS3Key,
  isS3Configured
};
