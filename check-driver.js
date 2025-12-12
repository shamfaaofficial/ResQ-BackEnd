require('dotenv').config();
const mongoose = require('mongoose');
const Driver = require('./src/models/Driver');
const User = require('./src/models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const driver = await Driver.findOne({'wallet.balance': {$gt: 0}});
  console.log('Driver ID:', driver?._id);
  console.log('UserId field:', driver?.userId);

  if (driver?.userId) {
    const user = await User.findById(driver.userId);
    console.log('User found:', user?._id, user?.phoneNumber);
  }

  process.exit(0);
});
