const twilio = require('twilio');

// Initialize Twilio client with validation
let twilioClient;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Validate Twilio credentials
if (accountSid && authToken && accountSid.startsWith('AC') && authToken.length > 10) {
  twilioClient = twilio(accountSid, authToken);
  console.log('✅ Twilio client initialized successfully');
} else {
  console.warn('⚠️  Twilio credentials not configured or invalid');
  console.warn('   SMS functionality will not work until you add valid credentials to .env');
  console.warn('   Required: TWILIO_ACCOUNT_SID (starts with AC) and TWILIO_AUTH_TOKEN');

  // Create a mock client for development
  twilioClient = null;
}

module.exports = twilioClient;
