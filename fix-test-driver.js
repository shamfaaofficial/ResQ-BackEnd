require('dotenv').config();
const mongoose = require('mongoose');
const Driver = require('./src/models/Driver');
const User = require('./src/models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  // Find all drivers
  const drivers = await Driver.find({'wallet.balance': {$gt: 0}});
  console.log(`Found ${drivers.length} drivers with wallet balance`);

  for (const driver of drivers) {
    const user = await User.findById(driver.userId);
    if (user) {
      console.log(`✅ Valid driver: ${driver._id}, User: ${user.phoneNumber}, Balance: ${driver.wallet.balance}`);
      process.exit(0);
      return;
    }
  }

  console.log('❌ No valid driver found. Creating one...');

  // Find any user with driver role
  const anyUser = await User.findOne({ role: 'driver' });
  if (anyUser) {
    // Find or create driver profile
    let driver = await Driver.findOne({ userId: anyUser._id });
    if (!driver) {
      driver = await Driver.create({
        userId: anyUser._id,
        vehicleDetails: {
          vehicleType: 'sedan'
        },
        wallet: {
          balance: 100,
          pendingAmount: 0
        }
      });
    } else {
      driver.wallet = { balance: 100, pendingAmount: 0 };
      await driver.save();
    }
    console.log(`✅ Created/Updated driver with wallet balance: ${driver._id}`);
  }

  process.exit(0);
});
