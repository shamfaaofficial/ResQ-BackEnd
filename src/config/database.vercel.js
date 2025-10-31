const mongoose = require('mongoose');

let cachedConnection = null;

const connectDatabase = async () => {
  // Check if MONGODB_URI is set
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set. Please configure it in Vercel dashboard.');
  }

  // If we have a cached connection and it's connected, return it
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('Using cached database connection');
    return cachedConnection;
  }

  try {
    console.log('Attempting to connect to MongoDB...');

    // Remove deprecated options
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    cachedConnection = conn;
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      cachedConnection = null;
    });

    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    cachedConnection = null;
    throw error; // Don't call process.exit in serverless
  }
};

module.exports = connectDatabase;
