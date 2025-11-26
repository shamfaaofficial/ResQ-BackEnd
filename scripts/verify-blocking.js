const mongoose = require('mongoose');
const Driver = require('../src/models/Driver');
const User = require('../src/models/User');
const Booking = require('../src/models/Booking');
const { BOOKING_STATUS } = require('../src/config/constants');
require('dotenv').config();

async function verifyBlocking() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Setup Test Data
        console.log('\n1. Setting up test data...');
        const userPhone = '+97411112222';
        const driverPhone = '+97433334444';

        // Create/Get User
        let user = await User.findOne({ phoneNumber: userPhone });
        if (!user) {
            user = await User.create({
                phoneNumber: userPhone,
                role: 'user',
                password: 'password123',
                isVerified: true
            });
        }
        console.log('Test User ID:', user._id);

        // Create/Get Driver
        let driverUser = await User.findOne({ phoneNumber: driverPhone });
        if (!driverUser) {
            driverUser = await User.create({
                phoneNumber: driverPhone,
                role: 'driver',
                password: 'password123',
                isVerified: true
            });
        }

        let driver = await Driver.findOne({ userId: driverUser._id });
        if (!driver) {
            driver = await Driver.create({
                userId: driverUser._id,
                approvalStatus: 'approved',
                isOnline: true,
                isLocationEnabled: true,
                currentLocation: {
                    type: 'Point',
                    coordinates: [51.5, 25.3], // Doha
                    address: 'Test Location'
                },
                vehicleDetails: {
                    vehicleType: 'sedan',
                    vehicleNumber: 'TEST-123'
                }
            });
        } else {
            // Reset driver state
            driver.isOnline = true;
            driver.isBusy = false;
            driver.approvalStatus = 'approved';
            driver.isLocationEnabled = true;
            driver.currentLocation = {
                type: 'Point',
                coordinates: [51.5, 25.3],
                address: 'Test Location'
            };
            await driver.save();
        }
        console.log('Test Driver ID:', driver._id);

        // Clear any existing bookings
        await Booking.deleteMany({ userId: user._id });
        await Booking.deleteMany({ driverId: driver._id });
        console.log('Cleared existing bookings');

        // 2. Verify Driver Availability (Initial)
        console.log('\n2. Verifying Driver Availability (Initial)...');
        const initialDrivers = await Driver.find({
            isOnline: true,
            isBusy: false,
            isLocationEnabled: true,
            currentLocation: {
                $near: {
                    $geometry: { type: 'Point', coordinates: [51.5, 25.3] },
                    $maxDistance: 10000
                }
            }
        });
        const isDriverAvailable = initialDrivers.some(d => d._id.toString() === driver._id.toString());
        console.log('Is driver available in search?', isDriverAvailable);
        if (!isDriverAvailable) throw new Error('Driver should be available initially');

        // 3. Create Booking and Accept
        console.log('\n3. Creating and Accepting Booking...');
        const booking = await Booking.create({
            bookingNumber: `TEST-${Date.now()}`,
            userId: user._id,
            vehicleType: 'sedan',
            pickupLocation: { type: 'Point', coordinates: [51.5, 25.3], address: 'Pickup' },
            dropoffLocation: { type: 'Point', coordinates: [51.6, 25.4], address: 'Dropoff' },
            distance: { estimated: 10 },
            pricing: { basePrice: 10, perKmRate: 2, totalDistance: 10, distancePrice: 20, totalAmount: 30 },
            status: BOOKING_STATUS.ACCEPTED,
            driverId: driver._id,
            requestExpiresAt: new Date(Date.now() + 3600000)
        });

        // Manually trigger the "Accept" logic (since we created directly)
        // In real flow, controller does this. We simulate it here.
        driver.isBusy = true;
        await driver.save();
        console.log('Booking created and driver marked as busy');

        // 4. Verify Driver Blocked
        console.log('\n4. Verifying Driver Blocked...');
        const busyDrivers = await Driver.find({
            isOnline: true,
            isBusy: false,
            isLocationEnabled: true,
            currentLocation: {
                $near: {
                    $geometry: { type: 'Point', coordinates: [51.5, 25.3] },
                    $maxDistance: 10000
                }
            }
        });
        const isDriverVisible = busyDrivers.some(d => d._id.toString() === driver._id.toString());
        console.log('Is driver visible in search?', isDriverVisible);
        if (isDriverVisible) throw new Error('Driver should NOT be visible when busy');

        // 5. Verify User Blocked
        console.log('\n5. Verifying User Blocked...');
        const activeBooking = await Booking.findOne({
            userId: user._id,
            status: { $in: [BOOKING_STATUS.ACCEPTED, BOOKING_STATUS.IN_PROGRESS] }
        });
        console.log('User has active booking:', !!activeBooking);
        if (!activeBooking) throw new Error('User should have active booking');

        // 6. Complete Trip
        console.log('\n6. Completing Trip...');
        booking.status = BOOKING_STATUS.COMPLETED;
        await booking.save();

        // Manually trigger "Complete" logic
        driver.isBusy = false;
        await driver.save();
        console.log('Trip completed and driver marked as available');

        // 7. Verify Driver Available Again
        console.log('\n7. Verifying Driver Available Again...');
        const finalDrivers = await Driver.find({
            isOnline: true,
            isBusy: false,
            isLocationEnabled: true,
            currentLocation: {
                $near: {
                    $geometry: { type: 'Point', coordinates: [51.5, 25.3] },
                    $maxDistance: 10000
                }
            }
        });
        const isDriverBack = finalDrivers.some(d => d._id.toString() === driver._id.toString());
        console.log('Is driver back in search?', isDriverBack);
        if (!isDriverBack) throw new Error('Driver should be available after trip completion');

        console.log('\n✅ VERIFICATION SUCCESSFUL');

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

verifyBlocking();
