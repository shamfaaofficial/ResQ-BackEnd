const mongoose = require('mongoose');
require('dotenv').config();

async function testVerificationCode() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Booking = require('./src/models/Booking');

    // Create a minimal test booking
    const testBooking = new Booking({
      bookingNumber: 'BK_TEST_' + Date.now(),
      userId: new mongoose.Types.ObjectId(),
      driverId: new mongoose.Types.ObjectId(),
      status: 'payment_completed',
      vehicleType: 'sedan',
      pickupLocation: {
        type: 'Point',
        coordinates: [74.84, 12.92],
        address: 'Test Pickup'
      },
      dropoffLocation: {
        type: 'Point',
        coordinates: [74.85, 12.93],
        address: 'Test Dropoff'
      },
      distance: { estimated: 5 },
      pricing: {
        basePrice: 110,
        perKmRate: 10,
        totalDistance: 5,
        distancePrice: 50,
        serviceFee: 0,
        totalAmount: 160,
        currency: 'QAR'
      },
      payment: {
        status: 'completed',
        method: 'Test',
        gateway: 'N/A',
        paidAmount: 160,
        paidAt: new Date()
      },
      requestExpiresAt: new Date(Date.now() + 60000)
    });

    console.log('📦 Test booking created in memory');
    console.log('Status:', testBooking.status);
    console.log('Verification code BEFORE setting:', testBooking.verificationCode);

    // Generate verification code (same logic as in acceptBooking controller)
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    testBooking.verificationCode = {
      code: verificationCode,
      generatedAt: new Date(),
      isVerified: false
    };

    console.log('\n🔢 Generated verification code:', verificationCode);
    console.log('✅ Verification code object set:', testBooking.verificationCode);

    // Save to database
    await testBooking.save();
    console.log('\n💾 Booking saved to database');

    // Retrieve it from database to verify persistence
    const savedBooking = await Booking.findById(testBooking._id).lean();

    console.log('\n📥 Retrieved from database:');
    console.log('Booking ID:', savedBooking._id);
    console.log('Status:', savedBooking.status);
    console.log('Payment status:', savedBooking.payment.status);
    console.log('\n🎯 VERIFICATION CODE DATA:');
    console.log(JSON.stringify(savedBooking.verificationCode, null, 2));

    if (savedBooking.verificationCode && savedBooking.verificationCode.code) {
      console.log('\n✅✅✅ SUCCESS! ✅✅✅');
      console.log('Verification code:', savedBooking.verificationCode.code);
      console.log('Code length:', savedBooking.verificationCode.code.length);
      console.log('Is 4 digits?', /^\d{4}$/.test(savedBooking.verificationCode.code));
      console.log('Generated at:', savedBooking.verificationCode.generatedAt);
      console.log('Is verified:', savedBooking.verificationCode.isVerified);
    } else {
      console.log('\n❌ FAILED! Verification code not found in saved booking');
    }

    // Clean up
    await Booking.deleteOne({ _id: testBooking._id });
    console.log('\n🧹 Test booking deleted');
    console.log('\n✅ Test completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testVerificationCode();
