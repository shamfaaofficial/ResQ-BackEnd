require('dotenv').config();
const mongoose = require('mongoose');
const PricingConfig = require('../src/models/PricingConfig');
const AdminSettings = require('../src/models/AdminSettings');
const { VEHICLE_TYPES } = require('../src/config/constants');

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    console.log('=== Seeding Database ===\n');

    // Seed pricing configurations
    console.log('Seeding pricing configurations...');
    const pricingData = [
      {
        vehicleType: VEHICLE_TYPES.SMALL_CAR,
        basePrice: 40,
        perKmRate: 3,
        minimumFare: 40,
        serviceFeePercentage: 10,
        driverCommissionPercentage: 80,
        isActive: true
      },
      {
        vehicleType: VEHICLE_TYPES.SEDAN,
        basePrice: 50,
        perKmRate: 5,
        minimumFare: 50,
        serviceFeePercentage: 10,
        driverCommissionPercentage: 80,
        isActive: true
      },
      {
        vehicleType: VEHICLE_TYPES.SUV,
        basePrice: 70,
        perKmRate: 7,
        minimumFare: 70,
        serviceFeePercentage: 10,
        driverCommissionPercentage: 80,
        isActive: true
      },
      {
        vehicleType: VEHICLE_TYPES.TRUCK,
        basePrice: 100,
        perKmRate: 10,
        minimumFare: 100,
        serviceFeePercentage: 10,
        driverCommissionPercentage: 80,
        isActive: true
      },
      {
        vehicleType: VEHICLE_TYPES.HEAVY_VEHICLE,
        basePrice: 150,
        perKmRate: 15,
        minimumFare: 150,
        serviceFeePercentage: 10,
        driverCommissionPercentage: 80,
        isActive: true
      }
    ];

    for (const pricing of pricingData) {
      await PricingConfig.findOneAndUpdate(
        { vehicleType: pricing.vehicleType },
        pricing,
        { upsert: true, new: true }
      );
      console.log(`  ✓ ${pricing.vehicleType}: QAR ${pricing.basePrice} + QAR ${pricing.perKmRate}/km`);
    }

    console.log('\n✅ Pricing configurations seeded\n');

    // Seed admin settings
    console.log('Seeding admin settings...');
    const settings = [
      {
        settingKey: 'DEFAULT_SEARCH_RADIUS',
        settingValue: 10,
        description: 'Default search radius for finding drivers (in kilometers)'
      },
      {
        settingKey: 'BOOKING_REQUEST_TIMEOUT',
        settingValue: 60,
        description: 'Time limit for driver to accept booking request (in seconds)'
      },
      {
        settingKey: 'PAYMENT_TIMEOUT',
        settingValue: 300,
        description: 'Time limit for user to complete payment (in seconds)'
      },
      {
        settingKey: 'PLATFORM_COMMISSION_PERCENTAGE',
        settingValue: 20,
        description: 'Platform commission percentage from total booking amount'
      },
      {
        settingKey: 'MINIMUM_WITHDRAWAL_AMOUNT',
        settingValue: 100,
        description: 'Minimum amount driver can withdraw (in QAR)'
      },
      {
        settingKey: 'COMPANY_NAME',
        settingValue: 'RESQ Towing Services',
        description: 'Company name'
      },
      {
        settingKey: 'COMPANY_EMAIL',
        settingValue: 'support@resq.qa',
        description: 'Company support email'
      },
      {
        settingKey: 'COMPANY_PHONE',
        settingValue: '+974XXXXXXXX',
        description: 'Company contact phone number'
      },
      {
        settingKey: 'COMPANY_ADDRESS',
        settingValue: 'Doha, Qatar',
        description: 'Company physical address'
      },
      {
        settingKey: 'MAX_SEARCH_RADIUS',
        settingValue: 50,
        description: 'Maximum search radius for finding drivers (in kilometers)'
      }
    ];

    for (const setting of settings) {
      await AdminSettings.findOneAndUpdate(
        { settingKey: setting.settingKey },
        setting,
        { upsert: true, new: true }
      );
      console.log(`  ✓ ${setting.settingKey}: ${setting.settingValue}`);
    }

    console.log('\n✅ Admin settings seeded\n');

    console.log('===========================');
    console.log('✅ Database seeded successfully!');
    console.log('===========================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

seedDatabase();
