const mongoose = require('mongoose');

const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Auto-sync indexes on startup (ensures geospatial indexes exist)
    // Run in background to avoid blocking server startup
    mongoose.connection.syncIndexes().then(() => {
      console.log('✅ Database indexes synced');
    }).catch((err) => {
      console.error('⚠️  Index sync failed (non-critical):', err.message);
    });

    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    console.error(`   Connection string: ${process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') : 'Not set'}`);

    // In development, allow server to start without MongoDB for testing
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Running in DEVELOPMENT mode without MongoDB');
      console.warn('   Most API endpoints will fail. Please start MongoDB:');
      console.warn('   - Install: brew install mongodb-community');
      console.warn('   - Start: brew services start mongodb-community');
      console.warn('   - Or use MongoDB Atlas: https://www.mongodb.com/atlas\n');
      return; // Don't exit, allow server to start
    }

    // In production, MongoDB is required
    process.exit(1);
  }
};

module.exports = connectDatabase;
