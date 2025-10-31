require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../src/models/User');
const { hashPassword } = require('../src/utils/helpers');
const { ROLES } = require('../src/config/constants');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdmin() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Get admin details
    console.log('=== Create Admin User ===\n');
    const username = await question('Enter admin username: ');
    const password = await question('Enter admin password (min 8 chars, 1 uppercase, 1 lowercase, 1 number): ');
    const firstName = await question('Enter first name: ');
    const lastName = await question('Enter last name: ');
    const phoneNumber = await question('Enter phone number (+974XXXXXXXX): ');
    const email = await question('Enter email: ');

    // Validate required fields
    if (!username || !password || !firstName || !lastName || !phoneNumber) {
      console.log('\n❌ All fields are required!');
      process.exit(1);
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ username });
    if (existingAdmin) {
      console.log('\n❌ Admin with this username already exists!');
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create admin user
    const admin = await User.create({
      username,
      password: hashedPassword,
      phoneNumber,
      role: ROLES.ADMIN,
      isVerified: true,
      isActive: true,
      profile: {
        firstName,
        lastName,
        email: email || undefined
      }
    });

    console.log('\n✅ Admin user created successfully!\n');
    console.log('----------------------------');
    console.log('Username:', admin.username);
    console.log('Role:', admin.role);
    console.log('Phone:', admin.phoneNumber);
    console.log('----------------------------\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.connection.close();
  }
}

createAdmin();
