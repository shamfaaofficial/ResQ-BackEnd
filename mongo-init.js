// MongoDB initialization script for Docker
// This script runs when the MongoDB container is first created

// Switch to the resq-platform database
db = db.getSiblingDB('resq-platform');

// Create the application user with read/write permissions
db.createUser({
  user: 'dbuser',
  pwd: 'pass123',
  roles: [
    {
      role: 'readWrite',
      db: 'resq-platform'
    }
  ]
});

console.log('✅ MongoDB user "dbuser" created successfully');

// Create collections (optional - Mongoose will create them, but this ensures they exist)
db.createCollection('users');
db.createCollection('drivers');
db.createCollection('bookings');
db.createCollection('transactions');
db.createCollection('otps');
db.createCollection('notifications');
db.createCollection('pricingconfigs');
db.createCollection('adminsettings');
db.createCollection('driverwithdrawals');

console.log('✅ Collections created successfully');

// Create indexes for better performance
db.drivers.createIndex({ "currentLocation.coordinates": "2dsphere" });
db.bookings.createIndex({ "pickupLocation.coordinates": "2dsphere" });
db.bookings.createIndex({ bookingNumber: 1 }, { unique: true });
db.users.createIndex({ phoneNumber: 1 }, { unique: true });
db.drivers.createIndex({ phoneNumber: 1 }, { unique: true });
db.otps.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 }); // Auto-delete OTPs after 5 minutes

console.log('✅ Indexes created successfully');
console.log('🎉 MongoDB initialization complete!');
