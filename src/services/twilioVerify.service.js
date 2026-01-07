const { twilioVerifyClient } = require('../config/twilio');
const { BadRequestError } = require('../utils/errors');

class TwilioVerifyService {
    /**
     * Send OTP using Twilio Verify API
     */
    async sendOTP(phoneNumber, channel = 'sms') {
        try {
            // Ensure phone number has country code
            let formattedPhone = phoneNumber;
            if (!formattedPhone.startsWith('+')) {
                // If no country code, assume Qatar
                formattedPhone = `+974${phoneNumber}`;
            }

            console.log(`📤 Sending OTP via Twilio Verify API to: ${formattedPhone}`);

            // Check if Twilio Verify client is initialized
            if (!twilioVerifyClient) {
                console.warn('⚠️  Twilio Verify client not initialized - running in development mode');
                console.log(`📱 Phone: ${formattedPhone}`);
                console.log(`🔢 OTP will be sent when Twilio Verify is configured`);
                console.log(`⏰ Valid for 10 minutes (Twilio default)\n`);

                // Return mock response for development
                return {
                    success: true,
                    sid: 'dev-mode-verification',
                    status: 'pending',
                    channel: channel
                };
            }

            // Send verification using Twilio Verify API
            const verification = await twilioVerifyClient.verifications.create({
                to: formattedPhone,
                channel: channel // 'sms', 'call', or 'email'
            });

            console.log(`✅ OTP sent successfully via Twilio Verify!`);
            console.log(`   📱 To: ${formattedPhone}`);
            console.log(`   🆔 SID: ${verification.sid}`);
            console.log(`   📊 Status: ${verification.status}`);
            console.log(`   📡 Channel: ${verification.channel}`);

            return {
                success: true,
                sid: verification.sid,
                status: verification.status,
                channel: verification.channel,
                to: formattedPhone
            };
        } catch (error) {
            console.error('❌ Twilio Verify OTP sending failed:', error.message);
            console.error('Error code:', error.code);
            console.error('Error details:', error);

            // In development, don't throw error to allow testing without Twilio
            if (process.env.NODE_ENV === 'development') {
                console.log(`\n⚠️  DEV MODE - OTP Failed but continuing...`);
                console.log(`📱 Phone: ${phoneNumber}`);
                console.log(`⏰ Valid for 10 minutes\n`);
                return {
                    success: true,
                    sid: 'dev-mode-verification',
                    status: 'pending',
                    channel: channel
                };
            }

            throw new BadRequestError(`Failed to send OTP: ${error.message}`);
        }
    }

    /**
     * Verify OTP using Twilio Verify API
     */
    async verifyOTP(phoneNumber, otpCode) {
        try {
            // Ensure phone number has country code
            let formattedPhone = phoneNumber;
            if (!formattedPhone.startsWith('+')) {
                // If no country code, assume Qatar
                formattedPhone = `+974${phoneNumber}`;
            }

            console.log(`🔐 Verifying OTP via Twilio Verify API`);
            console.log(`   📱 Phone: ${formattedPhone}`);
            console.log(`   🔢 Code: ${otpCode}`);

            // Check if Twilio Verify client is initialized
            if (!twilioVerifyClient) {
                console.warn('⚠️  Twilio Verify client not initialized - running in development mode');
                console.log(`✅ DEV MODE - OTP verification bypassed\n`);

                // In development, accept any 6-digit code
                if (otpCode && otpCode.length === 6) {
                    return {
                        success: true,
                        status: 'approved',
                        valid: true
                    };
                } else {
                    throw new BadRequestError('Invalid OTP format');
                }
            }

            // Verify OTP using Twilio Verify API
            const verificationCheck = await twilioVerifyClient.verificationChecks.create({
                to: formattedPhone,
                code: otpCode
            });

            console.log(`🔍 Verification result:`);
            console.log(`   📊 Status: ${verificationCheck.status}`);
            console.log(`   ✅ Valid: ${verificationCheck.valid}`);

            if (verificationCheck.status === 'approved' && verificationCheck.valid) {
                console.log(`✅ OTP verified successfully!`);
                return {
                    success: true,
                    status: verificationCheck.status,
                    valid: verificationCheck.valid,
                    sid: verificationCheck.sid
                };
            } else {
                console.log(`❌ OTP verification failed - Status: ${verificationCheck.status}`);
                throw new BadRequestError('Invalid or expired OTP');
            }
        } catch (error) {
            console.error('❌ Twilio Verify OTP verification failed:', error.message);
            console.error('Error code:', error.code);

            // In development, accept any 6-digit code
            if (process.env.NODE_ENV === 'development' && otpCode && otpCode.length === 6) {
                console.log(`✅ DEV MODE - OTP verification bypassed\n`);
                return {
                    success: true,
                    status: 'approved',
                    valid: true
                };
            }

            // Handle specific Twilio errors
            if (error.code === 20404) {
                throw new BadRequestError('OTP has expired or does not exist');
            } else if (error.code === 60200) {
                throw new BadRequestError('Invalid OTP code');
            } else if (error.code === 60202) {
                throw new BadRequestError('Maximum verification attempts reached');
            }

            throw new BadRequestError(`OTP verification failed: ${error.message}`);
        }
    }

    /**
     * Check verification status
     */
    async checkVerificationStatus(phoneNumber) {
        try {
            let formattedPhone = phoneNumber;
            if (!formattedPhone.startsWith('+')) {
                formattedPhone = `+974${phoneNumber}`;
            }

            if (!twilioVerifyClient) {
                return { status: 'dev-mode', valid: false };
            }

            // Note: Twilio Verify doesn't provide a direct status check endpoint
            // You can only verify with a code
            console.log('ℹ️  Twilio Verify API does not support status checks without verification code');
            return { status: 'pending', valid: false };
        } catch (error) {
            console.error('Error checking verification status:', error.message);
            return { status: 'error', valid: false };
        }
    }
}

module.exports = new TwilioVerifyService();
