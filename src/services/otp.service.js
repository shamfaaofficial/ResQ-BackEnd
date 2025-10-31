const OTP = require('../models/OTP');
const { generateOTP, hashOTP } = require('../utils/helpers');
const { OTP_EXPIRY_MINUTES } = require('../config/constants');
const { BadRequestError } = require('../utils/errors');

class OTPService {
  /**
   * Generate and save OTP
   */
  async generateOTP(phoneNumber, purpose) {
    // Delete any existing OTPs for this phone and purpose
    await OTP.deleteMany({ phoneNumber, purpose, isVerified: false });

    // Generate new OTP
    const otpCode = generateOTP();
    const hashedOTP = hashOTP(otpCode);

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Save OTP to database
    const otp = await OTP.create({
      phoneNumber,
      otp: hashedOTP,
      purpose,
      expiresAt
    });

    return { otpCode, otpId: otp._id };
  }

  /**
   * Verify OTP
   */
  async verifyOTP(phoneNumber, otpCode, purpose) {
    const hashedOTP = hashOTP(otpCode);

    // Find OTP
    const otp = await OTP.findOne({
      phoneNumber,
      purpose,
      otp: hashedOTP,
      isVerified: false
    });

    if (!otp) {
      throw new BadRequestError('Invalid OTP');
    }

    // Check if expired
    if (otp.isExpired()) {
      await OTP.deleteOne({ _id: otp._id });
      throw new BadRequestError('OTP has expired');
    }

    // Check attempts
    if (otp.attempts >= 3) {
      await OTP.deleteOne({ _id: otp._id });
      throw new BadRequestError('Maximum OTP attempts exceeded');
    }

    // Mark as verified
    otp.isVerified = true;
    await otp.save();

    return true;
  }

  /**
   * Validate OTP without marking as verified (for checking)
   */
  async validateOTP(phoneNumber, otpCode, purpose) {
    const hashedOTP = hashOTP(otpCode);

    const otp = await OTP.findOne({
      phoneNumber,
      purpose,
      otp: hashedOTP,
      isVerified: false
    });

    if (!otp) {
      return false;
    }

    if (otp.isExpired()) {
      return false;
    }

    if (otp.attempts >= 3) {
      return false;
    }

    return true;
  }

  /**
   * Increment OTP attempts
   */
  async incrementAttempts(phoneNumber, purpose) {
    const otp = await OTP.findOne({
      phoneNumber,
      purpose,
      isVerified: false
    });

    if (otp) {
      await otp.incrementAttempts();
    }
  }

  /**
   * Check if OTP exists and is valid
   */
  async isOTPValid(phoneNumber, purpose) {
    const otp = await OTP.findOne({
      phoneNumber,
      purpose,
      isVerified: false
    });

    if (!otp) {
      return false;
    }

    return !otp.isExpired() && otp.attempts < 3;
  }

  /**
   * Delete OTP after successful verification
   */
  async deleteOTP(phoneNumber, purpose) {
    await OTP.deleteMany({ phoneNumber, purpose });
  }
}

module.exports = new OTPService();
