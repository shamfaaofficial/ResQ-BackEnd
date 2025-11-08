require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const phoneNumber = process.argv[2] || '+919019464861';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const user = await User.findOne({ phoneNumber });
  console.log('User found:', user ? {
    id: user._id,
    phone: user.phoneNumber,
    role: user.role,
    hasPassword: !!user.password,
    isVerified: user.isVerified,
    isActive: user.isActive
  } : 'NOT FOUND');

  await mongoose.disconnect();
}).catch(err => console.error('Error:', err.message));
