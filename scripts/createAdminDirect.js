require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { hashPassword } = require('../src/utils/helpers');
const { ROLES } = require('../src/config/constants');

async function createAdminDirect() {
  try {
    // Connect to database
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Admin details
    const adminData = {
      username: 'resq_admin',
      password: 'Shamshu@9019',
      firstName: 'Shamshu',
      lastName: 'shaash',
      phoneNumber: '+919019464861',
      email: '' // Optional
    };

    console.log('=== Creating Admin User ===\n');
    console.log('Username:', adminData.username);
    console.log('Phone:', adminData.phoneNumber);
    console.log('Name:', adminData.firstName, adminData.lastName);
    console.log('');

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      $or: [
        { username: adminData.username },
        { phoneNumber: adminData.phoneNumber }
      ]
    });

    if (existingAdmin) {
      console.log('\n❌ Admin already exists!');
      console.log('Existing admin details:');
      console.log('  Username:', existingAdmin.username);
      console.log('  Phone:', existingAdmin.phoneNumber);
      console.log('  Role:', existingAdmin.role);
      console.log('\nIf you want to create a new admin, use different username/phone number.');
      process.exit(1);
    }

    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await hashPassword(adminData.password);

    // Create admin user
    console.log('Creating admin in database...');
    const admin = await User.create({
      username: adminData.username,
      password: hashedPassword,
      phoneNumber: adminData.phoneNumber,
      role: ROLES.ADMIN,
      isVerified: true,
      isActive: true,
      profile: {
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        email: adminData.email || undefined
      }
    });

    console.log('\n✅ Admin user created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ID:', admin._id);
    console.log('Username:', admin.username);
    console.log('Phone Number:', admin.phoneNumber);
    console.log('Role:', admin.role);
    console.log('Name:', admin.profile.firstName, admin.profile.lastName);
    console.log('Status: Active ✓');
    console.log('Verified: Yes ✓');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🔐 Admin can now login using:');
    console.log('   Phone: +919019464861');
    console.log('   OTP will be sent to this number\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

createAdminDirect();
