/**
 * Twilio Configuration Verification Script
 * Checks if Twilio is properly configured without sending actual SMS
 * Run: node verify-twilio-setup.js
 */

require('dotenv').config();
const twilio = require('twilio');

console.log('\n🔍 Verifying Twilio Configuration...\n');

// Check environment variables
console.log('📋 Environment Variables Check:');
console.log('================================');

const requiredVars = {
  'TWILIO_ACCOUNT_SID': process.env.TWILIO_ACCOUNT_SID,
  'TWILIO_AUTH_TOKEN': process.env.TWILIO_AUTH_TOKEN,
};

const optionalVars = {
  'TWILIO_MESSAGING_SERVICE_SID': process.env.TWILIO_MESSAGING_SERVICE_SID,
  'TWILIO_PHONE_NUMBER': process.env.TWILIO_PHONE_NUMBER,
};

let hasErrors = false;

// Check required variables
for (const [key, value] of Object.entries(requiredVars)) {
  if (value) {
    console.log(`✅ ${key}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`❌ ${key}: Missing`);
    hasErrors = true;
  }
}

// Check optional variables
for (const [key, value] of Object.entries(optionalVars)) {
  if (value) {
    console.log(`✅ ${key}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`⚠️  ${key}: Not set`);
  }
}

if (!process.env.TWILIO_MESSAGING_SERVICE_SID && !process.env.TWILIO_PHONE_NUMBER) {
  console.log('\n❌ ERROR: Either TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER must be set\n');
  hasErrors = true;
}

if (hasErrors) {
  console.log('\n❌ Configuration incomplete. Please check your .env file.\n');
  process.exit(1);
}

console.log('\n✅ Environment variables configured correctly!\n');

// Verify Twilio connection
async function verifyTwilioConnection() {
  try {
    console.log('🔌 Testing Twilio Connection...');
    console.log('================================\n');

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Fetch account details
    console.log('📡 Fetching account information...');
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();

    console.log('✅ Successfully connected to Twilio!');
    console.log(`   Account Name: ${account.friendlyName}`);
    console.log(`   Account Status: ${account.status}`);
    console.log(`   Account Type: ${account.type}\n`);

    // Check Messaging Service if configured
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      console.log('📨 Checking Messaging Service...');
      try {
        const messagingService = await client.messaging.v1
          .services(process.env.TWILIO_MESSAGING_SERVICE_SID)
          .fetch();

        console.log('✅ Messaging Service found!');
        console.log(`   Service Name: ${messagingService.friendlyName}`);
        console.log(`   Service SID: ${messagingService.sid}\n`);

        // Check phone numbers in the service
        console.log('📞 Checking Messaging Service phone numbers...');
        const phoneNumbers = await client.messaging.v1
          .services(process.env.TWILIO_MESSAGING_SERVICE_SID)
          .phoneNumbers
          .list({ limit: 10 });

        if (phoneNumbers.length === 0) {
          console.log('⚠️  No phone numbers found in Messaging Service!');
          console.log('   Add a phone number to your Messaging Service:');
          console.log('   https://console.twilio.com/us1/develop/sms/services\n');
        } else {
          console.log(`✅ Found ${phoneNumbers.length} phone number(s):`);
          phoneNumbers.forEach((pn) => {
            console.log(`   - ${pn.phoneNumber} (${pn.capabilities.join(', ')})`);
          });
          console.log('');
        }
      } catch (error) {
        console.log('❌ Messaging Service error:', error.message);
        console.log('   Check your TWILIO_MESSAGING_SERVICE_SID\n');
      }
    }

    // Check phone number if configured
    if (process.env.TWILIO_PHONE_NUMBER) {
      console.log('📱 Checking Phone Number...');
      try {
        const numbers = await client.incomingPhoneNumbers.list({ limit: 20 });
        const configuredNumber = numbers.find(
          (num) => num.phoneNumber === process.env.TWILIO_PHONE_NUMBER
        );

        if (configuredNumber) {
          console.log('✅ Phone number verified!');
          console.log(`   Number: ${configuredNumber.phoneNumber}`);
          console.log(`   Friendly Name: ${configuredNumber.friendlyName}`);
          console.log(`   SMS Enabled: ${configuredNumber.capabilities.sms ? 'Yes' : 'No'}\n`);

          if (!configuredNumber.capabilities.sms) {
            console.log('⚠️  Warning: This number does not support SMS!\n');
          }
        } else {
          console.log('⚠️  Warning: Phone number not found in your Twilio account');
          console.log(`   Configured: ${process.env.TWILIO_PHONE_NUMBER}`);
          console.log('   Available numbers:');
          numbers.forEach((num) => {
            console.log(`   - ${num.phoneNumber}`);
          });
          console.log('');
        }
      } catch (error) {
        console.log('❌ Phone number verification error:', error.message);
        console.log('');
      }
    }

    // Check balance
    console.log('💰 Checking Account Balance...');
    try {
      const balance = await client.balance.fetch();
      const balanceAmount = parseFloat(balance.balance);
      console.log(`   Current Balance: ${balance.currency} ${balanceAmount}`);

      if (balanceAmount < 5) {
        console.log('   ⚠️  Low balance! Consider adding more funds.\n');
      } else {
        console.log('   ✅ Balance looks good!\n');
      }
    } catch (error) {
      console.log('   ⚠️  Could not fetch balance:', error.message);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════');
    console.log('✅ Twilio Setup Verification Complete!');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('📝 Next Steps:');
    console.log('   1. Enable Qatar in Geo Permissions:');
    console.log('      https://console.twilio.com/us1/develop/sms/settings/geo-permissions');
    console.log('   2. Test sending SMS to Qatar:');
    console.log('      node test-qatar-sms.js +97431234567');
    console.log('   3. Read the full guide:');
    console.log('      cat TWILIO_QATAR_SETUP.md\n');

  } catch (error) {
    console.log('\n❌ Twilio Connection Failed!');
    console.log('Error:', error.message);

    if (error.code === 20003) {
      console.log('\n💡 Solution: Check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
      console.log('   They may be incorrect or belong to different accounts.\n');
    } else if (error.code === 20404) {
      console.log('\n💡 Solution: Account SID not found. Verify it in:');
      console.log('   https://console.twilio.com\n');
    } else {
      console.log('\nFull error details:', error);
      console.log('');
    }

    process.exit(1);
  }
}

verifyTwilioConnection();
