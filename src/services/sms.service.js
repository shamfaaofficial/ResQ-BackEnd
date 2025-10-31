const twilioClient = require('../config/twilio');
const { formatQatarPhone } = require('../utils/helpers');

class SMSService {
  /**
   * Send OTP via SMS
   */
  async sendOTP(phoneNumber, otp, purpose) {
    try {
      // Use phone number as-is (don't force Qatar format for testing)
      const formattedPhone = phoneNumber;

      const messageBody = this.getOTPMessage(otp, purpose);

      // Send SMS via Twilio
      const message = await twilioClient.messages.create({
        body: messageBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone
      });

      console.log(`SMS sent to ${formattedPhone}: ${message.sid}`);
      return { success: true, messageSid: message.sid };
    } catch (error) {
      console.error('SMS sending failed:', error.message);
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

      const sms = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone
      });

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

      const sms = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone
      });

      return { success: true, messageSid: sms.sid };
    } catch (error) {
      console.error('Custom SMS failed:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }
}

module.exports = new SMSService();
