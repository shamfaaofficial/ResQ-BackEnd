require('dotenv').config();
const mongoose = require('mongoose');
const Driver = require('./src/models/Driver');
const User = require('./src/models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  // Find all drivers
  const drivers = await Driver.find({});
  console.log(`Found ${drivers.length} total drivers`);

  let deleted = 0;
  for (const driver of drivers) {
    const user = await User.findById(driver.userId);
    if (!user) {
      await Driver.deleteOne({ _id: driver._id });
      console.log(`Deleted driver ${driver._id} - user not found`);
      deleted++;
    }
  }

  console.log(`Deleted ${deleted} orphaned drivers`);

  // Find valid driver
  const validDriver = await Driver.findOne({'wallet.balance': {$gt: 0}});
  if (validDriver) {
    const user = await User.findById(validDriver.userId);
    console.log(`✅ Valid driver exists: ${validDriver._id}, User: ${user?.phoneNumber}`);
  } else {
    console.log('❌ No valid driver with balance > 0');
  }

  process.exit(0);
});
