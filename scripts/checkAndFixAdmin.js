require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

// Allow passing MONGODB_URI as env var inline:
// MONGODB_URI="mongodb+srv://..." node scripts/checkAndFixAdmin.js [--fix]
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set.');
  console.error('Usage: MONGODB_URI="your_mongo_uri" node scripts/checkAndFixAdmin.js [--fix]');
  process.exit(1);
}

async function checkAndFixAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Show ALL admin records
    const admins = await User.find({ role: 'admin' });
    console.log(`Found ${admins.length} admin(s):\n`);
    admins.forEach((a, i) => {
      console.log(`Admin #${i + 1}:`);
      console.log('  _id        :', a._id);
      console.log('  username   :', a.username);
      console.log('  phoneNumber:', a.phoneNumber);
      console.log('  isActive   :', a.isActive);
      console.log('  isVerified :', a.isVerified);
      console.log('');
    });

    // The phone number the login sends after normalization
    const targetPhone = '+97477148777';

    const match = admins.find(a => a.phoneNumber === targetPhone);
    if (match) {
      console.log(`✅ Admin with phone ${targetPhone} already exists — no fix needed.`);
      console.log('   The issue is elsewhere (account inactive or a different error).');
    } else {
      console.log(`❌ No admin found with phone ${targetPhone}`);

      if (process.argv.includes('--fix')) {
        if (admins.length === 0) {
          console.log('\n⚠️  No admins exist at all. Cannot fix — please create an admin first.');
        } else {
          const adminToFix = admins[0];
          const oldPhone = adminToFix.phoneNumber;
          adminToFix.phoneNumber = targetPhone;
          await adminToFix.save();
          console.log(`\n✅ Updated admin "${adminToFix.username}" phone:`);
          console.log(`   ${oldPhone}  →  ${targetPhone}`);
          console.log('\nYou can now login with phone number: 77148777 or +97477148777');
        }
      } else {
        console.log('\nTo update the admin phone number to match, run with --fix flag:');
        console.log(`  MONGODB_URI="..." node scripts/checkAndFixAdmin.js --fix`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

checkAndFixAdmin();
