const admin = require('firebase-admin');
const path = require('path');

class FirebaseConfig {
  constructor() {
    this.admin = null;
    this.messaging = null;
    this.initialized = false;
  }

  initialize() {
    try {
      // Method 1: Try to use service account JSON string from environment variable (RECOMMENDED for production)
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        console.log('🔥 Firebase: Initializing from FIREBASE_SERVICE_ACCOUNT_JSON env variable...');
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

        console.log(`    📋 Firebase Project: ${serviceAccount.project_id}`);
        console.log(`    📧 Service Account: ${serviceAccount.client_email}`);

        this.admin = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });

        this.messaging = admin.messaging();
        this.initialized = true;
        console.log('    ✅ Firebase Admin SDK initialized successfully!');
        console.log('    ✅ Firebase Messaging ready for push notifications');
        return;
      }

      // Method 2: Try to use individual environment variables
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        console.log('🔥 Initializing Firebase from individual env variables...');

        this.admin = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          }),
          projectId: process.env.FIREBASE_PROJECT_ID
        });

        this.messaging = admin.messaging();
        this.initialized = true;
        console.log('✅ Firebase Admin SDK initialized successfully (from individual vars)');
        return;
      }

      // Method 3: Try to load from file path (for local development)
      if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        console.log('🔥 Initializing Firebase from file path...');
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

        // Resolve the absolute path
        const absolutePath = path.isAbsolute(serviceAccountPath)
          ? serviceAccountPath
          : path.resolve(process.cwd(), serviceAccountPath);

        const serviceAccount = require(absolutePath);

        this.admin = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });

        this.messaging = admin.messaging();
        this.initialized = true;
        console.log('✅ Firebase Admin SDK initialized successfully (from file)');
        return;
      }

      // No Firebase configuration found
      console.warn('⚠️  Firebase not configured - Push notifications disabled');
      console.warn('⚠️  Set FIREBASE_SERVICE_ACCOUNT_JSON or individual Firebase env vars');
      this.initialized = false;
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error.message);
      console.warn('⚠️  Push notifications will not be available');
      this.initialized = false;
    }
  }

  getMessaging() {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }
    return this.messaging;
  }

  isInitialized() {
    return this.initialized;
  }
}

const firebaseConfig = new FirebaseConfig();
firebaseConfig.initialize();

module.exports = firebaseConfig;
