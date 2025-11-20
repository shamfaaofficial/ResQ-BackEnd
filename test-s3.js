require('dotenv').config();
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

// Test S3 connection
async function testS3Connection() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  🔍 TESTING AWS S3 CONNECTION                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('Configuration:');
  console.log(`   AWS Region: ${process.env.AWS_REGION}`);
  console.log(`   S3 Bucket: ${process.env.AWS_S3_BUCKET}`);
  console.log(`   Access Key ID: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 10)}...`);
  console.log(`   Secret Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '***configured***' : 'NOT SET'}\n`);

  try {
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    console.log('🔄 Testing S3 connection...\n');

    // Test by uploading a small test file
    const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

    const testFileName = `test/connection-test-${Date.now()}.txt`;
    const testContent = 'S3 connection test - this file can be deleted';

    console.log(`📤 Uploading test file to: ${testFileName}...\n`);

    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: testFileName,
      Body: Buffer.from(testContent),
      ContentType: 'text/plain'
    });

    await s3Client.send(uploadCommand);
    console.log('✅ Upload successful!');

    // Clean up test file
    console.log('🗑️  Deleting test file...\n');
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: testFileName
    });

    await s3Client.send(deleteCommand);
    console.log('✅ Delete successful!');

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  ✅ AWS S3 READY FOR DOCUMENT UPLOADS                ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.log('❌ S3 CONNECTION FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nPossible issues:');
    console.error('   1. Invalid AWS credentials');
    console.error('   2. Incorrect AWS region');
    console.error('   3. IAM permissions not configured');
    console.error('   4. Network/firewall blocking AWS');
    process.exit(1);
  }
}

testS3Connection();
