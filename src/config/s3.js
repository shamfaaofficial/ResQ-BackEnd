const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
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
 * @param {string} fileName - File name/key in S3
 * @param {string} mimeType - File MIME type
 * @returns {Promise<string>} - S3 file URL
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
    return fileUrl;
  } catch (error) {
    console.error('S3 Upload Error:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
};

/**
 * Delete file from S3
 * @param {string} fileName - File name/key in S3
 * @returns {Promise<void>}
 */
const deleteFromS3 = async (fileName) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: fileName
    });

    await s3Client.send(command);
    console.log(`File deleted from S3: ${fileName}`);
  } catch (error) {
    console.error('S3 Delete Error:', error);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
};

/**
 * Get signed URL for private file access
 * @param {string} fileName - File name/key in S3
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} - Signed URL
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
    console.error('S3 Signed URL Error:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

/**
 * Extract S3 key from full S3 URL
 * @param {string} s3Url - Full S3 URL
 * @returns {string} - S3 key/filename
 */
const extractS3Key = (s3Url) => {
  try {
    const url = new URL(s3Url);
    // Remove leading slash from pathname
    return url.pathname.substring(1);
  } catch (error) {
    console.error('Invalid S3 URL:', s3Url);
    throw new Error('Invalid S3 URL format');
  }
};

module.exports = {
  s3Client,
  bucketName,
  uploadToS3,
  deleteFromS3,
  getSignedFileUrl,
  extractS3Key
};
