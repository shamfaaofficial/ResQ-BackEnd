const mongoose = require('mongoose');
require('dotenv').config();

async function testVerificationCode() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Booking = require('./src/models/Booking');
    const User = require('./src/models/User');
    const Driver = require('./src/models/Driver');

    // Find a test user and driver
    const user = await User.findOne({ role: 'user' });
    let driver = await Driver.findOne({}).populate('userId');

    if (!user) {
      console.log('❌ Need at least one user in database');
      process.exit(1);
    }

    console.log('✅ Found user:', user.phoneNumber);

    // Create a driver if doesn't exist
    if (!driver) {
      console.log('⚠️ No driver found, creating test driver...');
      const driverUser = await User.create({
        phoneNumber: '+974' + Math.floor(10000000 + Math.random() * 90000000),
        role: 'driver',
        profile: { firstName: 'Test', lastName: 'Driver' }
      });

      driver = await Driver.create({
        userId: driverUser._id,
        vehicleDetails: {
          vehicleType: 'sedan',
          vehicleNumber: 'TEST123',
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry',
          vehicleColor: 'White',
          vehicleYear: 2020
        },
        currentLocation: {
          type: 'Point',
          coordinates: [74.84, 12.92]
        },
        approvalStatus: 'approved',
        isOnline: true
      });

      await driver.populate('userId');
      console.log('✅ Test driver created:', driver.userId.phoneNumber);
    } else {
      console.log('✅ Found driver:', driver.userId.phoneNumber);
    }

    // Create a test booking
    const booking = await Booking.create({
      bookingNumber: 'BK' + Date.now(),
      userId: user._id,
      driverId: driver._id,
      status: 'requested',
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
      requestExpiresAt: new Date(Date.now() + 60000)
    });

    console.log('\n📦 Test booking created:', booking.bookingNumber);
    console.log('Status:', booking.status);
    console.log('VerificationCode before acceptance:', booking.verificationCode);

    // Simulate acceptance with verification code generation
    booking.status = 'payment_completed';
    booking.timeline.acceptedAt = new Date();
    booking.timeline.paymentCompletedAt = new Date();
    booking.payment = {
      status: 'completed',
      method: 'Test',
      gateway: 'N/A',
      paidAmount: 160,
      paidAt: new Date()
    };

    // Generate verification code (same logic as in acceptBooking)
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    booking.verificationCode = {
      code: verificationCode,
      generatedAt: new Date(),
      isVerified: false
    };

    await booking.save();

    // Fetch it again to verify
    const savedBooking = await Booking.findById(booking._id);

    console.log('\n✅ Booking after acceptance:');
    console.log('Status:', savedBooking.status);
    console.log('Payment status:', savedBooking.payment.status);
    console.log('Verification code object:', JSON.stringify(savedBooking.verificationCode, null, 2));
    console.log('\n🎯 Verification code:', savedBooking.verificationCode.code);
    console.log('🔢 Code length:', savedBooking.verificationCode.code.length);
    console.log('📅 Generated at:', savedBooking.verificationCode.generatedAt);
    console.log('✅ Is verified:', savedBooking.verificationCode.isVerified);

    // Test: Fetch via active booking query
    console.log('\n🔍 Testing active booking query...');
    const activeBooking = await Booking.findOne({
      userId: user._id,
      status: { $in: ['payment_completed', 'in_progress', 'driver_arrived'] }
    });

    if (activeBooking) {
      console.log('✅ Active booking found');
      console.log('Verification code in active booking:', activeBooking.verificationCode);
    } else {
      console.log('❌ Active booking not found');
    }

    // Clean up
    await Booking.deleteOne({ _id: booking._id });
    console.log('\n🧹 Test booking deleted');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testVerificationCode();
