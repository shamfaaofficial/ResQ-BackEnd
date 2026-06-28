require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Driver = require('../src/models/Driver');
const { hashPassword } = require('../src/utils/helpers');

const dummyDrivers = [
  {
    phoneNumber: '+97433810384',
    password: 'Jeseem@123',
    name: 'Comfort Tow Driver',
    vehicleType: 'comfort_tow',
    vehicleNumber: '987654',
    vehicleMake: 'Chevrolet',
    vehicleModel: 'Silverado',
    vehicleYear: 2023,
    vehicleColor: 'Black',
    coordinates: [74.8812000, 12.8860000],
    address: 'Bikarnakatte Kaikamba, Mangaluru (Comfort)'
  },
  {
    phoneNumber: '+97433810385',
    password: 'Jeseem@123',
    name: 'Luxury Transport Driver',
    vehicleType: 'luxury_transport',
    vehicleNumber: '456789',
    vehicleMake: 'Mercedes-Benz',
    vehicleModel: 'Actros',
    vehicleYear: 2024,
    vehicleColor: 'Silver',
    coordinates: [74.8805000, 12.8855000],
    address: 'Bikarnakatte Kaikamba, Mangaluru (Luxury)'
  }
];

async function seedDummyDrivers() {
  try {
    // If not connected, connect using MONGODB_URI
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to MongoDB');
    }

    for (const data of dummyDrivers) {
      // 1. Check if user already exists
      let user = await User.findOne({ phoneNumber: data.phoneNumber });
      if (user) {
        console.log(`Driver user with phone ${data.phoneNumber} already exists. Updating existing profile...`);
      } else {
        const hashedPassword = await hashPassword(data.password);
        user = await User.create({
          phoneNumber: data.phoneNumber,
          password: hashedPassword,
          role: 'driver',
          isVerified: true,
          isActive: true,
          profile: {
            firstName: data.name,
            lastName: '',
            profileImage: null
          }
        });
        console.log(`Created User for ${data.name}`);
      }

      // 2. Check if driver profile exists
      let driver = await Driver.findOne({ userId: user._id });
      if (!driver) {
        driver = new Driver({
          userId: user._id
        });
      }

      // Update driver profile fields
      driver.approvalStatus = 'approved';
      driver.isOnline = true;
      driver.isBusy = false;
      driver.isLocationEnabled = true;
      
      driver.currentLocation = {
        type: 'Point',
        coordinates: data.coordinates,
        address: data.address,
        lastUpdated: new Date()
      };

      driver.vehicleDetails = {
        vehicleType: data.vehicleType,
        vehicleNumber: data.vehicleNumber,
        vehicleMake: data.vehicleMake,
        vehicleModel: data.vehicleModel,
        vehicleYear: data.vehicleYear,
        vehicleColor: data.vehicleColor,
        vehicleImages: []
      };

      driver.rating = {
        average: 5,
        totalRatings: 1,
        professionalism: 5,
        serviceQuality: 5,
        timeliness: 5,
        vehicleHandling: 5,
        fiveStars: 1,
        fourStars: 0,
        threeStars: 0,
        twoStars: 0,
        oneStar: 0
      };

      await driver.save();
      console.log(`✅ Seeded driver profile for ${data.name} (${data.vehicleType})`);
    }

    console.log('\n🎉 Successfully seeded 2 dummy drivers!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding drivers:', error);
    process.exit(1);
  }
}

seedDummyDrivers();
