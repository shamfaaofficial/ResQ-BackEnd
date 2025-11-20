/**
 * Test Script: Verification Code API - COMPREHENSIVE
 * Tests driver verification of user's 4-digit code
 *
 * API Endpoint: POST /api/v1/trip/:bookingId/verify-code
 * Purpose: Driver enters user's 4-digit code to verify it's the actual user
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.magenta}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}\n`)
};

// Test data
let userToken = '';
let driverToken = '';
let bookingId = '';
let verificationCode = '';
let userId = '';
let driverId = '';

async function login(role, phoneNumber) {
  log.info(`Logging in as ${role}: ${phoneNumber}`);
  try {
    const res = await axios.post(`${BASE_URL}/auth/${role}/login`, {
      phoneNumber,
      password: 'Password123!'
    });
    log.success(`${role} login successful`);
    return res.data.data.tokens.accessToken;
  } catch (error) {
    log.error(`${role} login failed: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

async function createBooking(token) {
  log.info('Creating a new booking...');
  try {
    const res = await axios.post(
      `${BASE_URL}/booking/create`,
      {
        pickupLocation: {
          coordinates: [51.5074, 25.2760],
          address: 'Pickup Address, Doha',
          placeName: 'Pickup Location'
        },
        dropoffLocation: {
          coordinates: [51.5200, 25.2900],
          address: 'Dropoff Address, Doha',
          placeName: 'Dropoff Location'
        },
        vehicleType: 'sedan',
        notes: 'Test booking for verification code'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    log.success(`Booking created: ${res.data.data.booking.bookingNumber}`);
    return res.data.data.booking.id;
  } catch (error) {
    log.error(`Booking creation failed: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

async function acceptBooking(token, bookingId) {
  log.info(`Driver accepting booking: ${bookingId}`);
  try {
    const res = await axios.post(
      `${BASE_URL}/booking/${bookingId}/accept`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    log.success('Booking accepted by driver');
    log.info(`Payment Status: ${res.data.data.booking.payment?.status}`);
    return res.data.data.booking;
  } catch (error) {
    log.error(`Booking acceptance failed: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

async function markDriverArrived(token, bookingId) {
  log.info('Driver marking arrival at pickup location...');
  try {
    const res = await axios.post(
      `${BASE_URL}/trip/${bookingId}/mark-arrived`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    log.success('Driver marked as arrived');
    if (res.data.data.verificationCode) {
      log.info(`Verification Code: ${res.data.data.verificationCode}`);
      return res.data.data.verificationCode;
    }
    return null;
  } catch (error) {
    log.error(`Mark arrival failed: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

async function getUserTripDetails(token, bookingId) {
  log.info('User getting trip details to see verification code...');
  try {
    const res = await axios.get(
      `${BASE_URL}/trip/${bookingId}/details`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    log.success('Trip details retrieved');
    if (res.data.data.verificationCode?.code) {
      log.info(`Verification Code (from user view): ${res.data.data.verificationCode.code}`);
      return res.data.data.verificationCode.code;
    }
    return null;
  } catch (error) {
    log.error(`Get trip details failed: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

async function verifyCode(token, bookingId, code) {
  log.info(`Driver verifying code: ${code}`);
  try {
    const res = await axios.post(
      `${BASE_URL}/trip/${bookingId}/verify-code`,
      { verificationCode: code },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    log.success(`Verification successful! Verified at: ${res.data.data.verifiedAt}`);
    return res.data.data;
  } catch (error) {
    log.error(`Verification failed: ${error.response?.data?.message || error.message}`);
    throw error;
  }
}

async function startTrip(token, bookingId) {
  log.info('Driver starting trip...');
  try {
    const res = await axios.post(
      `${BASE_URL}/booking/${bookingId}/start`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    log.success('Trip started successfully');
    return res.data.data.booking;
  } catch (error) {
    log.error(`Start trip failed: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

// ========== TEST SCENARIOS ==========

async function testScenario1_CorrectCode() {
  log.section('TEST 1: Verify Correct Code (Happy Path)');

  try {
    // Login
    userToken = await login('user', '+97431234567');
    driverToken = await login('driver', '+97450000001');

    // Create booking
    bookingId = await createBooking(userToken);

    // Driver accepts booking
    const booking = await acceptBooking(driverToken, bookingId);

    // Driver marks arrival (generates verification code)
    verificationCode = await markDriverArrived(driverToken, bookingId);

    if (!verificationCode) {
      log.warning('No verification code returned from mark-arrived. Checking trip details...');
      verificationCode = await getUserTripDetails(userToken, bookingId);
    }

    if (!verificationCode) {
      throw new Error('Failed to get verification code');
    }

    log.info(`User shares this code with driver: ${verificationCode}`);

    // Driver verifies the code
    await verifyCode(driverToken, bookingId, verificationCode);

    // Driver should now be able to start trip
    await startTrip(driverToken, bookingId);

    log.success('TEST 1 PASSED: Correct code verified successfully');
    return true;
  } catch (error) {
    log.error(`TEST 1 FAILED: ${error.message}`);
    return false;
  }
}

async function testScenario2_WrongCode() {
  log.section('TEST 2: Verify Wrong Code (Should Fail)');

  try {
    // Login
    userToken = await login('user', '+97431234567');
    driverToken = await login('driver', '+97450000001');

    // Create booking
    bookingId = await createBooking(userToken);

    // Driver accepts booking
    await acceptBooking(driverToken, bookingId);

    // Driver marks arrival
    verificationCode = await markDriverArrived(driverToken, bookingId);

    if (!verificationCode) {
      verificationCode = await getUserTripDetails(userToken, bookingId);
    }

    log.info(`Actual verification code: ${verificationCode}`);

    // Driver enters WRONG code
    const wrongCode = '9999';
    log.warning(`Driver enters WRONG code: ${wrongCode}`);

    try {
      await verifyCode(driverToken, bookingId, wrongCode);
      log.error('TEST 2 FAILED: Wrong code was accepted (should have been rejected)');
      return false;
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('Invalid')) {
        log.success('TEST 2 PASSED: Wrong code correctly rejected');
        return true;
      } else {
        throw error;
      }
    }
  } catch (error) {
    log.error(`TEST 2 FAILED: ${error.message}`);
    return false;
  }
}

async function testScenario3_VerifyBeforeArrival() {
  log.section('TEST 3: Verify Code Before Driver Arrives (Should Fail)');

  try {
    // Login
    userToken = await login('user', '+97431234567');
    driverToken = await login('driver', '+97450000001');

    // Create booking
    bookingId = await createBooking(userToken);

    // Driver accepts booking
    const booking = await acceptBooking(driverToken, bookingId);

    // Get verification code from acceptance (if it exists)
    if (booking.verificationCode?.code) {
      verificationCode = booking.verificationCode.code;
      log.info(`Verification code from acceptance: ${verificationCode}`);
    } else {
      log.warning('No verification code generated at acceptance');
      verificationCode = '1234'; // Use dummy code
    }

    // Driver tries to verify BEFORE marking arrival
    log.warning('Driver tries to verify code BEFORE marking arrival');

    try {
      await verifyCode(driverToken, bookingId, verificationCode);
      log.error('TEST 3 FAILED: Verification allowed before arrival (should be rejected)');
      return false;
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('arrive')) {
        log.success('TEST 3 PASSED: Verification correctly rejected before arrival');
        return true;
      } else {
        throw error;
      }
    }
  } catch (error) {
    log.error(`TEST 3 FAILED: ${error.message}`);
    return false;
  }
}

async function testScenario4_VerifyTwice() {
  log.section('TEST 4: Verify Code Twice (Should Fail on Second Attempt)');

  try {
    // Login
    userToken = await login('user', '+97431234567');
    driverToken = await login('driver', '+97450000001');

    // Create booking
    bookingId = await createBooking(userToken);

    // Driver accepts and arrives
    await acceptBooking(driverToken, bookingId);
    verificationCode = await markDriverArrived(driverToken, bookingId);

    if (!verificationCode) {
      verificationCode = await getUserTripDetails(userToken, bookingId);
    }

    // First verification (should succeed)
    await verifyCode(driverToken, bookingId, verificationCode);
    log.success('First verification successful');

    // Try to verify again (should fail)
    log.warning('Attempting second verification with same code...');

    try {
      await verifyCode(driverToken, bookingId, verificationCode);
      log.error('TEST 4 FAILED: Code verified twice (should only work once)');
      return false;
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already')) {
        log.success('TEST 4 PASSED: Duplicate verification correctly rejected');
        return true;
      } else {
        throw error;
      }
    }
  } catch (error) {
    log.error(`TEST 4 FAILED: ${error.message}`);
    return false;
  }
}

async function testScenario5_WrongDriver() {
  log.section('TEST 5: Different Driver Tries to Verify (Should Fail)');

  try {
    // Login user and driver1
    userToken = await login('user', '+97431234567');
    const driver1Token = await login('driver', '+97450000001');
    const driver2Token = await login('driver', '+97450000002');

    // Create booking
    bookingId = await createBooking(userToken);

    // Driver1 accepts and arrives
    await acceptBooking(driver1Token, bookingId);
    verificationCode = await markDriverArrived(driver1Token, bookingId);

    if (!verificationCode) {
      verificationCode = await getUserTripDetails(userToken, bookingId);
    }

    log.info(`Actual verification code: ${verificationCode}`);

    // Driver2 tries to verify (should fail - booking not assigned to them)
    log.warning('Driver2 (not assigned to booking) tries to verify code...');

    try {
      await verifyCode(driver2Token, bookingId, verificationCode);
      log.error('TEST 5 FAILED: Wrong driver was able to verify (should be rejected)');
      return false;
    } catch (error) {
      if (error.response?.status === 404 && error.response?.data?.error?.includes('not assigned')) {
        log.success('TEST 5 PASSED: Wrong driver correctly rejected');
        return true;
      } else {
        throw error;
      }
    }
  } catch (error) {
    log.error(`TEST 5 FAILED: ${error.message}`);
    return false;
  }
}

async function testScenario6_MissingCode() {
  log.section('TEST 6: Verify Without Providing Code (Should Fail)');

  try {
    // Login
    userToken = await login('user', '+97431234567');
    driverToken = await login('driver', '+97450000001');

    // Create booking, accept, and arrive
    bookingId = await createBooking(userToken);
    await acceptBooking(driverToken, bookingId);
    await markDriverArrived(driverToken, bookingId);

    // Try to verify without providing code
    log.warning('Driver sends empty/missing verification code...');

    try {
      const res = await axios.post(
        `${BASE_URL}/trip/${bookingId}/verify-code`,
        { verificationCode: '' }, // Empty code
        {
          headers: { Authorization: `Bearer ${driverToken}` }
        }
      );
      log.error('TEST 6 FAILED: Empty code was accepted');
      return false;
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('required')) {
        log.success('TEST 6 PASSED: Missing code correctly rejected');
        return true;
      } else {
        throw error;
      }
    }
  } catch (error) {
    log.error(`TEST 6 FAILED: ${error.message}`);
    return false;
  }
}

// ========== RUN ALL TESTS ==========

async function runAllTests() {
  console.log('\n');
  log.section('VERIFICATION CODE API - COMPREHENSIVE TEST SUITE');
  log.info('API Endpoint: POST /api/v1/trip/:bookingId/verify-code');
  log.info('Purpose: Driver verifies user identity using 4-digit code\n');

  const results = {
    passed: 0,
    failed: 0,
    total: 6
  };

  // Run all test scenarios
  if (await testScenario1_CorrectCode()) results.passed++;
  else results.failed++;

  if (await testScenario2_WrongCode()) results.passed++;
  else results.failed++;

  if (await testScenario3_VerifyBeforeArrival()) results.passed++;
  else results.failed++;

  if (await testScenario4_VerifyTwice()) results.passed++;
  else results.failed++;

  if (await testScenario5_WrongDriver()) results.passed++;
  else results.failed++;

  if (await testScenario6_MissingCode()) results.passed++;
  else results.failed++;

  // Final summary
  log.section('TEST SUMMARY');
  console.log(`Total Tests: ${results.total}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%\n`);

  if (results.failed === 0) {
    log.success('ALL TESTS PASSED! ✨');
  } else {
    log.error(`${results.failed} TEST(S) FAILED`);
  }

  process.exit(results.failed === 0 ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
