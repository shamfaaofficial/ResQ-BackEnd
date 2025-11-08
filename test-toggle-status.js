/**
 * Test script for driver toggle status endpoint
 *
 * Usage: node test-toggle-status.js <ACCESS_TOKEN>
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
  console.error('Error: Please provide an access token');
  console.error('Usage: node test-toggle-status.js <ACCESS_TOKEN>');
  process.exit(1);
}

async function testToggleStatus() {
  try {
    console.log('Testing driver toggle status endpoint...\n');

    // Test 1: Go online WITH location
    console.log('Test 1: Going online WITH location data');
    const response1 = await axios.patch(
      `${BASE_URL}/api/v1/driver/status`,
      {
        isOnline: true,
        latitude: 25.2854,
        longitude: 51.5310,
        address: 'Doha, Qatar'
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Success:', response1.data);
    console.log('\n---\n');

    // Wait a second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Go offline
    console.log('Test 2: Going offline');
    const response2 = await axios.patch(
      `${BASE_URL}/api/v1/driver/status`,
      {
        isOnline: false
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Success:', response2.data);
    console.log('\n---\n');

    // Wait a second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Go online again WITHOUT location (should work because location already enabled)
    console.log('Test 3: Going online again WITHOUT location (should work)');
    const response3 = await axios.patch(
      `${BASE_URL}/api/v1/driver/status`,
      {
        isOnline: true
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Success:', response3.data);
    console.log('\n---\n');

    console.log('All tests passed! ✅');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testToggleStatus();
