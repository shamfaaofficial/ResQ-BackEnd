/**
 * Debug script to check driver locations in database
 * Usage: node scripts/debugDrivers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Driver = require('../src/models/Driver');

async function debugDrivers() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');

    // Get all drivers
    const allDrivers = await Driver.find({})
      .populate('userId', 'phoneNumber profile')
      .lean();

    console.log(`📊 Total drivers in database: ${allDrivers.length}\n`);

    if (allDrivers.length === 0) {
      console.log('❌ No drivers found in database!');
      console.log('💡 You need to create driver accounts first.');
      process.exit(0);
    }

    // Analyze each driver
    allDrivers.forEach((driver, index) => {
      console.log(`\n--- Driver ${index + 1} ---`);
      console.log(`ID: ${driver._id}`);
      console.log(`Phone: ${driver.userId?.phoneNumber || 'N/A'}`);
      console.log(`Online: ${driver.isOnline}`);
      console.log(`Location Enabled: ${driver.isLocationEnabled}`);
      console.log(`Approval Status: ${driver.approvalStatus}`);
      console.log(`Coordinates: [${driver.currentLocation.coordinates[0]}, ${driver.currentLocation.coordinates[1]}]`);
      console.log(`Address: ${driver.currentLocation.address || 'N/A'}`);
      console.log(`Last Updated: ${driver.currentLocation.lastUpdated}`);

      // Check if coordinates are default
      if (driver.currentLocation.coordinates[0] === 0 && driver.currentLocation.coordinates[1] === 0) {
        console.log('⚠️  WARNING: Using default coordinates [0, 0]');
      }

      // Check if driver can be found
      const canBeFound = driver.isOnline && driver.isLocationEnabled;
      console.log(`Can be found in search: ${canBeFound ? '✅' : '❌'}`);
    });

    // Check online drivers specifically
    const onlineDrivers = await Driver.find({
      isOnline: true,
      isLocationEnabled: true
    }).lean();

    console.log(`\n\n📍 Online drivers with location enabled: ${onlineDrivers.length}`);

    if (onlineDrivers.length > 0) {
      console.log('\nOnline driver locations:');
      onlineDrivers.forEach((driver) => {
        console.log(`  - ${driver._id}: [${driver.currentLocation.coordinates[0]}, ${driver.currentLocation.coordinates[1]}]`);
      });
    }

    // Test geospatial query
    console.log('\n\n🔍 Testing geospatial query...');
    const testLat = 25.2854;
    const testLng = 51.5310;
    const radiusKm = 10000; // 10,000 km to catch everything

    console.log(`Query: Find drivers within ${radiusKm}km of [${testLng}, ${testLat}]`);

    try {
      const nearbyDrivers = await Driver.find({
        isOnline: true,
        isLocationEnabled: true,
        currentLocation: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [testLng, testLat]
            },
            $maxDistance: radiusKm * 1000
          }
        }
      }).lean();

      console.log(`✅ Geospatial query returned ${nearbyDrivers.length} drivers`);

      if (nearbyDrivers.length === 0) {
        console.log('\n❌ No drivers found with geospatial query');
        console.log('\n🔧 Possible issues:');
        console.log('  1. Geospatial index not created (run: node scripts/rebuildIndexes.js)');
        console.log('  2. Driver locations not updated in MongoDB');
        console.log('  3. Drivers not online or location not enabled');
      }
    } catch (geoError) {
      console.error('❌ Geospatial query failed:', geoError.message);
      console.log('\n🔧 This usually means the 2dsphere index is missing.');
      console.log('   Run: node scripts/rebuildIndexes.js');
    }

    console.log('\n✅ Debug complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugDrivers();
