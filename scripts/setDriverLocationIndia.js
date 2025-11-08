/**
 * Script to set driver location to Bangalore, India for testing
 * Usage: node scripts/setDriverLocationIndia.js <DRIVER_ID> <LATITUDE> <LONGITUDE>
 *
 * Examples:
 *   Bangalore: node scripts/setDriverLocationIndia.js 690f07a9c2313b1f06af9338 12.9716 77.5946
 *   Mangaluru: node scripts/setDriverLocationIndia.js 690f07a9c2313b1f06af9338 12.9141 74.8560
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Driver = require('../src/models/Driver');

async function setDriverLocation() {
  try {
    const driverId = process.argv[2];
    const lat = parseFloat(process.argv[3]);
    const lng = parseFloat(process.argv[4]);

    if (!driverId || !lat || !lng) {
      console.error('❌ Missing arguments');
      console.error('Usage: node scripts/setDriverLocationIndia.js <DRIVER_ID> <LATITUDE> <LONGITUDE>');
      console.error('\nExamples:');
      console.error('  Bangalore: node scripts/setDriverLocationIndia.js 690f07a9c2313b1f06af9338 12.9716 77.5946');
      console.error('  Mangaluru: node scripts/setDriverLocationIndia.js 690f07a9c2313b1f06af9338 12.9141 74.8560');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');

    const driver = await Driver.findById(driverId);
    if (!driver) {
      console.error(`❌ Driver ${driverId} not found`);
      process.exit(1);
    }

    console.log(`Found driver: ${driver._id}`);
    console.log(`Current location: [${driver.currentLocation.coordinates[0]}, ${driver.currentLocation.coordinates[1]}]`);

    driver.currentLocation = {
      type: 'Point',
      coordinates: [lng, lat],
      address: 'India',
      lastUpdated: new Date()
    };
    driver.isLocationEnabled = true;
    driver.isOnline = true;

    await driver.save();

    console.log(`✅ Driver location updated to [${lng}, ${lat}]`);
    console.log(`Status: Online=${driver.isOnline}, LocationEnabled=${driver.isLocationEnabled}`);
    console.log('\n🔍 Test nearby drivers API with your current location');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setDriverLocation();
