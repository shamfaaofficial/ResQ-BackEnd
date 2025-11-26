/**
 * Script to drop the problematic TTL index from Booking collection
 * This TTL index was auto-deleting all bookings after 60 seconds, including active trips
 *
 * Run this script ONCE to remove the index from your database:
 * node scripts/dropTTLIndex.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../src/models/Booking');

async function dropTTLIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all indexes on the Booking collection
    const indexes = await Booking.collection.getIndexes();
    console.log('\nCurrent indexes on Booking collection:');
    console.log(JSON.stringify(indexes, null, 2));

    // Find and drop the TTL index on requestExpiresAt
    const ttlIndexName = 'requestExpiresAt_1';

    if (indexes[ttlIndexName]) {
      console.log(`\n🔍 Found TTL index: ${ttlIndexName}`);
      console.log('Index details:', indexes[ttlIndexName]);

      if (indexes[ttlIndexName].expireAfterSeconds !== undefined) {
        console.log(`\n⚠️  WARNING: This is a TTL index with expireAfterSeconds: ${indexes[ttlIndexName].expireAfterSeconds}`);
        console.log('This index was causing bookings to be auto-deleted by MongoDB!');

        console.log('\n🗑️  Dropping TTL index...');
        await Booking.collection.dropIndex(ttlIndexName);
        console.log('✅ TTL index dropped successfully!');

        // Rebuild the index WITHOUT TTL
        console.log('\n🔨 Rebuilding index without TTL...');
        await Booking.collection.createIndex({ requestExpiresAt: 1 });
        console.log('✅ Regular index created on requestExpiresAt (without TTL)');
      } else {
        console.log('ℹ️  Index exists but is not a TTL index. No action needed.');
      }
    } else {
      console.log(`\nℹ️  TTL index "${ttlIndexName}" not found. It may have already been dropped.`);
    }

    // Verify the current indexes
    console.log('\n📋 Final indexes on Booking collection:');
    const finalIndexes = await Booking.collection.getIndexes();
    console.log(JSON.stringify(finalIndexes, null, 2));

    console.log('\n✅ Script completed successfully!');
    console.log('\n📌 Next steps:');
    console.log('1. Restart your application server');
    console.log('2. The cron job in booking.job.js will now handle expiry logic');
    console.log('3. Active trips will no longer be auto-deleted by MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

dropTTLIndex();
