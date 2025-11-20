/**
 * Manual Test: Verification Code API
 * Simple manual test for driver verification code
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1';

// Update these with actual tokens from your system
const USER_TOKEN = process.argv[2] || '';
const DRIVER_TOKEN = process.argv[3] || '';
const BOOKING_ID = process.argv[4] || '';

if (!USER_TOKEN || !DRIVER_TOKEN) {
  console.log('\n=== MANUAL VERIFICATION CODE TEST ===\n');
  console.log('Usage: node test-verify-code-manual.js <USER_TOKEN> <DRIVER_TOKEN> [BOOKING_ID]\n');
  console.log('Steps to test manually:');
  console.log('1. Login as user and driver to get tokens');
  console.log('2. Create a booking as user');
  console.log('3. Driver accepts the booking');
  console.log('4. Driver marks arrival (generates verification code)');
  console.log('5. User sees the code in trip details');
  console.log('6. Driver calls POST /trip/:bookingId/verify-code with the code');
  console.log('7. Verification should succeed and allow trip to start\n');
  console.log('Quick test commands:');
  console.log('# 1. Login as user');
  console.log('curl -X POST http://localhost:5000/api/v1/auth/user/login \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"phoneNumber": "+97431234567", "password": "Password123!"}\'');
  console.log('');
  console.log('# 2. Login as driver');
  console.log('curl -X POST http://localhost:5000/api/v1/auth/driver/login \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"phoneNumber": "+97450000001", "password": "Password123!"}\'');
  console.log('');
  console.log('# 3. Get user active booking to find bookingId');
  console.log('curl -X GET http://localhost:5000/api/v1/booking/active \\');
  console.log('  -H "Authorization: Bearer <USER_TOKEN>"');
  console.log('');
  console.log('# 4. Get trip details to see verification code');
  console.log('curl -X GET http://localhost:5000/api/v1/trip/<BOOKING_ID>/details \\');
  console.log('  -H "Authorization: Bearer <USER_TOKEN>"');
  console.log('');
  console.log('# 5. Driver verifies the code');
  console.log('curl -X POST http://localhost:5000/api/v1/trip/<BOOKING_ID>/verify-code \\');
  console.log('  -H "Authorization: Bearer <DRIVER_TOKEN>" \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"verificationCode": "1234"}\'');
  console.log('');
  process.exit(0);
}

async function testVerification() {
  console.log('\n=== TESTING VERIFICATION CODE API ===\n');

  try {
    // 1. Get user's trip details to see verification code
    console.log('1. Getting trip details for user...');
    const tripRes = await axios.get(
      `${BASE_URL}/trip/${BOOKING_ID}/details`,
      { headers: { Authorization: `Bearer ${USER_TOKEN}` } }
    );

    const verificationCode = tripRes.data.data.verificationCode?.code;
    console.log(`   ✓ Verification Code: ${verificationCode}`);
    console.log(`   ✓ Is Verified: ${tripRes.data.data.verificationCode?.isVerified}`);

    if (!verificationCode) {
      console.log('   ✗ No verification code found. Make sure driver has marked arrival.');
      process.exit(1);
    }

    // 2. Driver verifies the code
    console.log('\n2. Driver verifying code...');
    const verifyRes = await axios.post(
      `${BASE_URL}/trip/${BOOKING_ID}/verify-code`,
      { verificationCode },
      { headers: { Authorization: `Bearer ${DRIVER_TOKEN}` } }
    );

    console.log(`   ✓ ${verifyRes.data.message}`);
    console.log(`   ✓ Verified at: ${verifyRes.data.data.verifiedAt}`);

    // 3. Driver starts trip
    console.log('\n3. Driver starting trip...');
    const startRes = await axios.post(
      `${BASE_URL}/booking/${BOOKING_ID}/start`,
      {},
      { headers: { Authorization: `Bearer ${DRIVER_TOKEN}` } }
    );

    console.log(`   ✓ ${startRes.data.message}`);
    console.log(`   ✓ Booking status: ${startRes.data.data.booking.status}`);

    console.log('\n=== ALL TESTS PASSED ✓ ===\n');

  } catch (error) {
    console.error('\n✗ Test failed:', error.response?.data || error.message);
    console.error('\nFull error:', error.response?.data);
    process.exit(1);
  }
}

testVerification();
