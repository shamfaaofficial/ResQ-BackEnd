require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Driver = require('./src/models/Driver');
const { hashPassword } = require('./src/utils/helpers');

const testDriver = {
  phoneNumber: '+974555666777',
  password: 'Test@12345'
};

async function createTestDriver() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if driver already exists
    const existing = await User.findOne({ phoneNumber: testDriver.phoneNumber });
    if (existing) {
      console.log('❌ Driver with this phone number already exists');
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(testDriver.password);

    // Create User with driver role
    const user = await User.create({
      phoneNumber: testDriver.phoneNumber,
      password: hashedPassword,
      role: 'driver',
      isVerified: true,
      isActive: true
    });

    console.log('✅ Created User:', {
      id: user._id,
      phone: user.phoneNumber,
      role: user.role
    });

    // Create Driver profile
    const driver = await Driver.create({
      userId: user._id,
      approvalStatus: 'approved', // Pre-approve for testing
    });

    console.log('✅ Created Driver profile:', {
      id: driver._id,
      userId: driver.userId,
      approved: driver.approvalStatus
    });

    console.log('\n🎉 Test driver created successfully!');
    console.log('Login credentials:');
    console.log('  Phone:', testDriver.phoneNumber);
    console.log('  Password:', testDriver.password);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestDriver();
