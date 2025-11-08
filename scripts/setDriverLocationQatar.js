/**
 * Script to set a test driver location in Qatar (Doha)
 * Usage: node scripts/setDriverLocationQatar.js <DRIVER_ID>
 * Example: node scripts/setDriverLocationQatar.js 690f07a9c2313b1f06af9338
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Driver = require('../src/models/Driver');

async function setDriverLocation() {
  try {
    const driverId = process.argv[2];

    if (!driverId) {
      console.error('❌ Please provide a driver ID');
      console.error('Usage: node scripts/setDriverLocationQatar.js <DRIVER_ID>');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');

    // Find driver
    const driver = await Driver.findById(driverId);
    if (!driver) {
      console.error(`❌ Driver ${driverId} not found`);
      process.exit(1);
    }

    console.log(`Found driver: ${driver._id}`);
    console.log(`Current location: [${driver.currentLocation.coordinates[0]}, ${driver.currentLocation.coordinates[1]}]`);
    console.log(`Current status: Online=${driver.isOnline}, LocationEnabled=${driver.isLocationEnabled}\n`);

    // Set location to Doha, Qatar
    const dohaLng = 51.5310;
    const dohaLat = 25.2854;
    const dohaAddress = 'Doha, Qatar';

    driver.currentLocation = {
      type: 'Point',
      coordinates: [dohaLng, dohaLat],
      address: dohaAddress,
      lastUpdated: new Date()
    };
    driver.isLocationEnabled = true;
    driver.isOnline = true;

    await driver.save();

    console.log('✅ Driver location updated!');
    console.log(`New location: [${dohaLng}, ${dohaLat}] - ${dohaAddress}`);
    console.log(`Status: Online=${driver.isOnline}, LocationEnabled=${driver.isLocationEnabled}`);
    console.log('\n🔍 Test nearby drivers API:');
    console.log(`GET https://dev.resq-qa.com/api/v1/user/nearby-drivers?latitude=25.2854&longitude=51.5310&radius=10`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setDriverLocation();
