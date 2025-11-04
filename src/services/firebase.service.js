const firebaseConfig = require('../config/firebase');
const Driver = require('../models/Driver');
const User = require('../models/User');

class FirebaseService {
  /**
   * Send push notification to a single device
   */
  async sendPushNotification(fcmToken, title, body, data = {}, dataOnly = false) {
    if (!firebaseConfig.isInitialized()) {
      console.warn('⚠️  Firebase not initialized. Skipping push notification.');
      return { success: false, error: 'Firebase not initialized' };
    }

    if (!fcmToken) {
      console.warn('⚠️  No FCM token provided. Skipping push notification.');
      return { success: false, error: 'No FCM token' };
    }

    try {
      const messaging = firebaseConfig.getMessaging();

      const message = {
        data: {
          ...data,
          title,
          body,
          // Convert all data values to strings (FCM requirement)
          timestamp: new Date().toISOString()
        },
        token: fcmToken,
        android: {
          priority: 'high'
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true
            }
          }
        }
      };

      // Only add notification field if not data-only mode
      if (!dataOnly) {
        message.notification = {
          title,
          body
        };
        message.android.notification = {
          sound: 'default',
          channelId: 'booking_notifications'
        };
      }

      const response = await messaging.send(message);
      console.log('✅ Push notification sent successfully:', response);

      return { success: true, messageId: response };
    } catch (error) {
      console.error('❌ Failed to send push notification:', error.message);

      // Handle invalid or expired tokens
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        console.warn('⚠️  Invalid FCM token. Token may need to be updated.');
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to a specific driver
   */
  async sendPushToDriver(driverId, title, body, data = {}, dataOnly = false) {
    try {
      const driver = await Driver.findById(driverId).populate('userId', 'fcmToken');

      if (!driver) {
        console.warn('⚠️  Driver not found:', driverId);
        return { success: false, error: 'Driver not found' };
      }

      const fcmToken = driver.fcmToken || driver.userId?.fcmToken;

      if (!fcmToken) {
        console.warn('⚠️  Driver has no FCM token:', driverId);
        return { success: false, error: 'No FCM token for driver' };
      }

      return await this.sendPushNotification(fcmToken, title, body, {
        ...data,
        recipientType: 'driver',
        driverId: driverId.toString()
      }, dataOnly);
    } catch (error) {
      console.error('❌ Failed to send push to driver:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to a specific user
   */
  async sendPushToUser(userId, title, body, data = {}) {
    try {
      const user = await User.findById(userId).select('fcmToken');

      if (!user) {
        console.warn('⚠️  User not found:', userId);
        return { success: false, error: 'User not found' };
      }

      if (!user.fcmToken) {
        console.warn('⚠️  User has no FCM token:', userId);
        return { success: false, error: 'No FCM token for user' };
      }

      return await this.sendPushNotification(user.fcmToken, title, body, {
        ...data,
        recipientType: 'user',
        userId: userId.toString()
      });
    } catch (error) {
      console.error('❌ Failed to send push to user:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to multiple devices (multicast)
   */
  async sendMulticastNotification(fcmTokens, title, body, data = {}) {
    if (!firebaseConfig.isInitialized()) {
      console.warn('⚠️  Firebase not initialized. Skipping multicast notification.');
      return { success: false, error: 'Firebase not initialized' };
    }

    if (!fcmTokens || fcmTokens.length === 0) {
      console.warn('⚠️  No FCM tokens provided for multicast.');
      return { success: false, error: 'No FCM tokens' };
    }

    try {
      const messaging = firebaseConfig.getMessaging();

      const message = {
        notification: {
          title,
          body
        },
        data: {
          ...data,
          timestamp: new Date().toISOString()
        },
        tokens: fcmTokens,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'booking_notifications'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await messaging.sendEachForMulticast(message);
      console.log(`✅ Multicast notification sent: ${response.successCount}/${fcmTokens.length} successful`);

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses
      };
    } catch (error) {
      console.error('❌ Failed to send multicast notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate FCM token
   */
  async validateToken(fcmToken) {
    if (!firebaseConfig.isInitialized()) {
      return false;
    }

    try {
      const messaging = firebaseConfig.getMessaging();
      // Send a dry-run message to validate token
      await messaging.send({
        token: fcmToken,
        data: { test: 'validation' }
      }, true); // dry run

      return true;
    } catch (error) {
      console.error('❌ Token validation failed:', error.message);
      return false;
    }
  }
}

module.exports = new FirebaseService();
