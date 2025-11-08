// Quick script to check if a user exists in the database
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const testPhoneNumber = process.argv[2] || '+919961052060';

async function checkUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const user = await User.findOne({ phoneNumber: testPhoneNumber });

    if (user) {
      console.log(`\n✅ User EXISTS with phone number: ${testPhoneNumber}`);
      console.log('User details:', {
        _id: user._id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
        createdAt: user.createdAt
      });
    } else {
      console.log(`\n❌ No user found with phone number: ${testPhoneNumber}`);
      console.log('\nTrying to find all users...');
      const allUsers = await User.find({}).limit(5);
      console.log(`Found ${allUsers.length} users in database:`);
      allUsers.forEach(u => {
        console.log(`  - ${u.phoneNumber} (${u.role})`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUser();
