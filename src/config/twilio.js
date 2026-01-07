const twilio = require('twilio');

// Initialize Twilio client with validation
let twilioClient;
let twilioVerifyClient;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

// Validate Twilio credentials
if (accountSid && authToken && accountSid.startsWith('AC') && authToken.length > 10) {
  twilioClient = twilio(accountSid, authToken);
  
  // Initialize Verify API client if service SID is provided
  if (verifyServiceSid && verifyServiceSid.startsWith('VA')) {
    twilioVerifyClient = twilioClient.verify.v2.services(verifyServiceSid);
    console.log('✅ Twilio Verify API initialized successfully');
    console.log(`   Service SID: ${verifyServiceSid}`);
  } else {
    console.warn('⚠️  Twilio Verify Service SID not configured');
    console.warn('   Falling back to standard SMS API for OTP');
  }
  
  console.log('✅ Twilio client initialized successfully');
} else {
  console.warn('⚠️  Twilio credentials not configured or invalid');
  console.warn('   SMS functionality will not work until you add valid credentials to .env');
  console.warn('   Required: TWILIO_ACCOUNT_SID (starts with AC) and TWILIO_AUTH_TOKEN');

  // Create a mock client for development
  twilioClient = null;
  twilioVerifyClient = null;
}

module.exports = {
  twilioClient,
  twilioVerifyClient
};
