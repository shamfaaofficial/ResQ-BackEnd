const { twilioClient } = require('../config/twilio');
const { formatQatarPhone } = require('../utils/helpers');

class SMSService {
  /**
   * Send OTP via SMS
   */
  async sendOTP(phoneNumber, otp, purpose) {
    try {
      // Ensure phone number has country code
      let formattedPhone = phoneNumber;
      if (!formattedPhone.startsWith('+')) {
        // If no country code, assume Qatar
        formattedPhone = `+974${phoneNumber}`;
      }

      const messageBody = this.getOTPMessage(otp, purpose);

      console.log(`📤 Attempting to send SMS to: ${formattedPhone}`);

      // Check if Twilio client is initialized
      if (!twilioClient) {
        console.warn('⚠️  Twilio client not initialized - running in development mode');
        console.log(`📱 Phone: ${formattedPhone}`);
        console.log(`🔢 OTP Code: ${otp}`);
        console.log(`⏰ Valid for 5 minutes\n`);
        return { success: true, messageSid: 'dev-mode-no-twilio' };
      }

      // Send SMS via Twilio
      // Support both Messaging Service (recommended for production) and direct phone number
      const messageConfig = {
        body: messageBody,
        to: formattedPhone
      };

      // Use Messaging Service if configured (better for international SMS)
      if (process.env.TWILIO_MESSAGING_SERVICE_SID && process.env.TWILIO_MESSAGING_SERVICE_SID.startsWith('MG')) {
        messageConfig.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
        console.log(`📨 Using Messaging Service: ${process.env.TWILIO_MESSAGING_SERVICE_SID}`);
      } else if (process.env.TWILIO_PHONE_NUMBER && process.env.TWILIO_PHONE_NUMBER.startsWith('+')) {
        messageConfig.from = process.env.TWILIO_PHONE_NUMBER;
        console.log(`📞 Using Phone Number: ${process.env.TWILIO_PHONE_NUMBER}`);
      } else {
        throw new Error('Either TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER must be configured');
      }

      const message = await twilioClient.messages.create(messageConfig);

      console.log(`✅ SMS sent successfully!`);
      console.log(`   📱 To: ${formattedPhone}`);
      console.log(`   🆔 SID: ${message.sid}`);
      console.log(`   📊 Status: ${message.status}`);

      return { success: true, messageSid: message.sid };
    } catch (error) {
      console.error('❌ SMS sending failed:', error.message);
      console.error('Error code:', error.code);
      console.error('Error details:', error);

      // In development, don't throw error to allow testing without Twilio
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n⚠️  DEV MODE - SMS Failed but continuing...`);
        console.log(`📱 Phone: ${phoneNumber}`);
        console.log(`🔢 OTP Code: ${otp}`);
        console.log(`⏰ Valid for 5 minutes\n`);
        return { success: true, messageSid: 'dev-mode' };
      }
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Get OTP message based on purpose
   */
  getOTPMessage(otp, purpose) {
    const messages = {
      signup: `Your RESQ verification code is: ${otp}. Valid for 5 minutes.`,
      login: `Your RESQ login code is: ${otp}. Valid for 5 minutes.`,
      password_reset: `Your RESQ password reset code is: ${otp}. Valid for 5 minutes.`
    };

    return messages[purpose] || `Your RESQ verification code is: ${otp}`;
  }

  /**
   * Send booking notification SMS
   */
  async sendBookingNotification(phoneNumber, message) {
    try {
      const formattedPhone = formatQatarPhone(phoneNumber);

      const messageConfig = {
        body: message,
        to: formattedPhone
      };

      // Use Messaging Service if configured, otherwise use phone number
      if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
        messageConfig.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
      } else {
        messageConfig.from = process.env.TWILIO_PHONE_NUMBER;
      }

      const sms = await twilioClient.messages.create(messageConfig);

      return { success: true, messageSid: sms.sid };
    } catch (error) {
      console.error('Booking notification SMS failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send custom SMS
   */
  async sendCustomSMS(phoneNumber, message) {
    try {
      const formattedPhone = formatQatarPhone(phoneNumber);

      const messageConfig = {
        body: message,
        to: formattedPhone
      };

      // Use Messaging Service if configured, otherwise use phone number
      if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
        messageConfig.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
      } else {
        messageConfig.from = process.env.TWILIO_PHONE_NUMBER;
      }

      const sms = await twilioClient.messages.create(messageConfig);

      return { success: true, messageSid: sms.sid };
    } catch (error) {
      console.error('Custom SMS failed:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }
}

module.exports = new SMSService();
