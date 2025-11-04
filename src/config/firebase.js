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
      // Get service account path from environment or use default
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        './resq-7cd08-firebase-adminsdk-fbsvc-78361eb6c6.json';

      // Resolve the absolute path
      const absolutePath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.resolve(process.cwd(), serviceAccountPath);

      const serviceAccount = require(absolutePath);

      // Initialize Firebase Admin SDK
      this.admin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });

      this.messaging = admin.messaging();
      this.initialized = true;

      console.log('✅ Firebase Admin SDK initialized successfully');
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
