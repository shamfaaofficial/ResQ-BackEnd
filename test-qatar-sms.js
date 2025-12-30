/**
 * Test script for Qatar SMS functionality
 * Run: node test-qatar-sms.js
 */

require('dotenv').config();
const smsService = require('./src/services/sms.service');

async function testQatarSMS() {
  console.log('\n🧪 Testing Qatar SMS Configuration...\n');

  // Check environment variables
  console.log('📋 Configuration Check:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`   TWILIO_MESSAGING_SERVICE_SID: ${process.env.TWILIO_MESSAGING_SERVICE_SID || 'Not set'}`);
  console.log(`   TWILIO_PHONE_NUMBER: ${process.env.TWILIO_PHONE_NUMBER || 'Not set'}\n`);

  if (!process.env.TWILIO_MESSAGING_SERVICE_SID && !process.env.TWILIO_PHONE_NUMBER) {
    console.error('❌ Error: Either TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER must be set\n');
    process.exit(1);
  }

  // Test phone number (replace with your actual Qatar number)
  const testPhoneNumber = process.argv[2] || '+97431234567';

  console.log(`📱 Test Phone Number: ${testPhoneNumber}`);
  console.log('⚠️  Make sure to replace this with your actual Qatar number!\n');

  try {
    console.log('📤 Sending test OTP...\n');

    const testOTP = '123456';
    const result = await smsService.sendOTP(testPhoneNumber, testOTP, 'signup');

    if (result.success) {
      console.log('✅ SMS sent successfully!');
      console.log(`   Message SID: ${result.messageSid}`);
      console.log(`   OTP Code: ${testOTP}`);
      console.log('\n📱 Check your phone for the SMS!\n');

      if (process.env.NODE_ENV === 'development' && result.messageSid === 'dev-mode') {
        console.log('⚠️  Running in development mode - SMS may not actually be sent');
        console.log('   Check Twilio logs to verify: https://console.twilio.com/monitor/logs/sms\n');
      }
    } else {
      console.error('❌ Failed to send SMS');
      console.error(`   Error: ${result.error}\n`);
    }
  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error(`   ${error.message}\n`);

    // Common error solutions
    if (error.code === 21408) {
      console.log('💡 Solution: Enable Qatar in Twilio Geo Permissions');
      console.log('   https://console.twilio.com/us1/develop/sms/settings/geo-permissions\n');
    } else if (error.code === 21211) {
      console.log('💡 Solution: Check phone number format');
      console.log('   Must be: +974XXXXXXXX (12 digits total)');
      console.log('   First digit after 974 must be 3, 5, 6, or 7\n');
    } else if (error.code === 21614) {
      console.log('💡 Solution: Add phone number to Messaging Service sender pool');
      console.log('   https://console.twilio.com/us1/develop/sms/services\n');
    }
  }
}

// Usage instructions
if (process.argv[2] === '--help') {
  console.log('\n📖 Usage:');
  console.log('   node test-qatar-sms.js [phone_number]');
  console.log('\n📝 Examples:');
  console.log('   node test-qatar-sms.js +97431234567');
  console.log('   node test-qatar-sms.js 31234567');
  console.log('   node test-qatar-sms.js 97431234567\n');
  process.exit(0);
}

testQatarSMS();
