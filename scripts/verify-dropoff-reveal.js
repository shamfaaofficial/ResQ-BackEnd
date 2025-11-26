const mongoose = require('mongoose');
const Driver = require('../src/models/Driver');
const User = require('../src/models/User');
const Booking = require('../src/models/Booking');
const { BOOKING_STATUS } = require('../src/config/constants');
const bookingController = require('../src/controllers/booking.controller');
require('dotenv').config();

// Mock Express Request/Response
const mockReq = (body = {}, params = {}, userId = null) => ({
    body,
    params,
    userId
});

const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

async function verifyDropoffReveal() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Setup Test Data
        console.log('\n1. Setting up test data...');
        const userPhone = '+97411112222';
        const driverPhone = '+97433334444';

        // Get User & Driver (Reuse existing if possible)
        const user = await User.findOne({ phoneNumber: userPhone });
        const driverUser = await User.findOne({ phoneNumber: driverPhone });
        const driver = await Driver.findOne({ userId: driverUser._id });

        if (!user || !driver) {
            throw new Error('Run verify-blocking.js first to setup users');
        }

        // Clear existing bookings
        await Booking.deleteMany({ userId: user._id });
        await Booking.deleteMany({ driverId: driver._id });

        // 2. Create Booking (Payment Completed state to allow verification)
        console.log('\n2. Creating Booking (Payment Completed)...');
        const verificationCode = '1234';
        const booking = await Booking.create({
            bookingNumber: `TEST-REVEAL-${Date.now()}`,
            userId: user._id,
            vehicleType: 'sedan',
            pickupLocation: { type: 'Point', coordinates: [51.5, 25.3], address: 'Pickup' },
            dropoffLocation: { type: 'Point', coordinates: [51.6, 25.4], address: 'Secret Dropoff' }, // This should be revealed
            distance: { estimated: 10 },
            pricing: { basePrice: 10, perKmRate: 2, totalDistance: 10, distancePrice: 20, totalAmount: 30 },
            status: BOOKING_STATUS.PAYMENT_COMPLETED,
            driverId: driver._id,
            requestExpiresAt: new Date(Date.now() + 3600000),
            verificationCode: {
                code: verificationCode,
                generatedAt: new Date(),
                isVerified: false
            }
        });

        // 3. Verify Pickup Code
        console.log('\n3. Verifying Pickup Code...');
        const req = mockReq({ verificationCode }, { bookingId: booking._id }, driverUser._id.toString());
        const res = mockRes();

        // Call the controller directly
        await bookingController.verifyPickupCode(req, res);

        // 4. Check Response
        console.log('\n4. Checking Response...');
        if (res.statusCode !== 200) {
            throw new Error(`Expected status 200, got ${res.statusCode}`);
        }

        const responseData = res.data;
        console.log('Response Data:', JSON.stringify(responseData, null, 2));

        if (!responseData.data.booking.dropoffLocation) {
            throw new Error('❌ Dropoff location MISSING in response!');
        }

        if (responseData.data.booking.dropoffLocation.address !== 'Secret Dropoff') {
            throw new Error('❌ Dropoff location address mismatch!');
        }

        console.log('✅ Dropoff location successfully revealed:', responseData.data.booking.dropoffLocation);

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

verifyDropoffReveal();
