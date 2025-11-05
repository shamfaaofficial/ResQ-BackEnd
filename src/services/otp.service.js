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
    console.log('🔐 [OTPService] verifyOTP called');
    console.log('🔐 [OTPService] phoneNumber:', phoneNumber);
    console.log('🔐 [OTPService] otpCode:', otpCode);
    console.log('🔐 [OTPService] purpose:', purpose);

    const hashedOTP = hashOTP(otpCode);
    console.log('🔐 [OTPService] hashedOTP:', hashedOTP);

    // Find OTP
    console.log('🔍 [OTPService] Searching for OTP in database...');
    const otp = await OTP.findOne({
      phoneNumber,
      purpose,
      otp: hashedOTP,
      isVerified: false
    });

    console.log('🔍 [OTPService] OTP found:', otp ? 'Yes' : 'No');
    if (otp) {
      console.log('🔍 [OTPService] OTP details:', {
        id: otp._id,
        phoneNumber: otp.phoneNumber,
        purpose: otp.purpose,
        attempts: otp.attempts,
        expiresAt: otp.expiresAt,
        isExpired: otp.isExpired()
      });
    }

    if (!otp) {
      console.log('❌ [OTPService] No matching OTP found in database');
      // Let's also check if there's any OTP for this phone number
      const anyOTP = await OTP.findOne({ phoneNumber, purpose });
      console.log('🔍 [OTPService] Any OTP for this phone number:', anyOTP ? 'Yes' : 'No');
      if (anyOTP) {
        console.log('🔍 [OTPService] Existing OTP:', {
          storedHash: anyOTP.otp,
          providedHash: hashedOTP,
          match: anyOTP.otp === hashedOTP
        });
      }
      throw new BadRequestError('Invalid OTP');
    }

    // Check if expired
    if (otp.isExpired()) {
      console.log('❌ [OTPService] OTP has expired');
      await OTP.deleteOne({ _id: otp._id });
      throw new BadRequestError('OTP has expired');
    }

    // Check attempts
    if (otp.attempts >= 3) {
      console.log('❌ [OTPService] Maximum attempts exceeded');
      await OTP.deleteOne({ _id: otp._id });
      throw new BadRequestError('Maximum OTP attempts exceeded');
    }

    // Mark as verified
    console.log('✅ [OTPService] OTP is valid, marking as verified');
    otp.isVerified = true;
    await otp.save();

    console.log('✅ [OTPService] OTP verified successfully');
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
   * Check if OTP is already verified
   */
  async isOTPVerified(phoneNumber, otpCode, purpose) {
    const hashedOTP = hashOTP(otpCode);

    const otp = await OTP.findOne({
      phoneNumber,
      purpose,
      otp: hashedOTP,
      isVerified: true
    });

    if (!otp) {
      return false;
    }

    // Check if expired
    if (otp.isExpired()) {
      return false;
    }

    return true;
  }

  /**
   * Delete OTP after successful verification
   */
  async deleteOTP(phoneNumber, purpose) {
    await OTP.deleteMany({ phoneNumber, purpose });
  }
}

module.exports = new OTPService();
