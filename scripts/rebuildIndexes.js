/**
 * Script to rebuild MongoDB indexes
 * Run this after deploying to production to ensure geospatial indexes are created
 *
 * Usage: node scripts/rebuildIndexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Driver = require('../src/models/Driver');
const Booking = require('../src/models/Booking');

async function rebuildIndexes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Rebuild Driver indexes
    console.log('📍 Rebuilding Driver indexes...');
    await Driver.collection.dropIndexes();
    await Driver.ensureIndexes();
    const driverIndexes = await Driver.collection.getIndexes();
    console.log('✅ Driver indexes created:');
    console.log(JSON.stringify(driverIndexes, null, 2));
    console.log('');

    // Rebuild Booking indexes
    console.log('📍 Rebuilding Booking indexes...');
    await Booking.collection.dropIndexes();
    await Booking.ensureIndexes();
    const bookingIndexes = await Booking.collection.getIndexes();
    console.log('✅ Booking indexes created:');
    console.log(JSON.stringify(bookingIndexes, null, 2));
    console.log('');

    // Verify geospatial indexes
    console.log('🔍 Verifying geospatial indexes...');
    const has2dsphere = Object.values(driverIndexes).some(
      index => index.some && index.some(field => field[1] === '2dsphere')
    );

    if (has2dsphere) {
      console.log('✅ 2dsphere index verified on Driver.currentLocation');
    } else {
      console.log('❌ WARNING: 2dsphere index NOT found on Driver.currentLocation');
    }

    console.log('\n✅ Index rebuild complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error rebuilding indexes:', error);
    process.exit(1);
  }
}

rebuildIndexes();
