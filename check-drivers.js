require('dotenv').config();
const mongoose = require('mongoose');
const Driver = require('./src/models/Driver');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const drivers = await Driver.find({}).select('phoneNumber username email approvalStatus isActive createdAt');

  console.log('Total Drivers:', drivers.length);
  console.log('\n');

  drivers.forEach((d, i) => {
    console.log(`Driver ${i + 1}:`, {
      id: d._id.toString(),
      phone: d.phoneNumber,
      username: d.username,
      email: d.email,
      approved: d.approvalStatus,
      active: d.isActive,
      created: d.createdAt
    });
  });

  await mongoose.disconnect();
}).catch(err => console.error('Error:', err.message));
