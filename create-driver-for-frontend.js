require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Driver = require('./src/models/Driver');
const { hashPassword } = require('./src/utils/helpers');

const driverData = {
  phoneNumber: '+919019464861',
  password: 'OldPassword@123' // Current password (will be reset)
};

async function createDriver() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if already exists
    const existing = await User.findOne({ phoneNumber: driverData.phoneNumber });
    if (existing) {
      console.log('✅ Driver already exists:', {
        phone: existing.phoneNumber,
        role: existing.role,
        hasPassword: !!existing.password
      });
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(driverData.password);

    // Create User with driver role
    const user = await User.create({
      phoneNumber: driverData.phoneNumber,
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
      approvalStatus: 'approved',
    });

    console.log('✅ Created Driver profile');
    console.log('\n🎉 Driver created successfully!');
    console.log('Phone:', driverData.phoneNumber);
    console.log('Password:', driverData.password);
    console.log('\nNow you can test forgot password with this number!');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createDriver();
