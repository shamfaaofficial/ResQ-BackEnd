# Twilio SMS Setup for Qatar - Production Guide

This guide provides step-by-step instructions for setting up Twilio SMS for Qatar phone numbers in production.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Twilio Account Setup](#twilio-account-setup)
3. [Code Configuration](#code-configuration)
4. [Testing](#testing)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)
7. [Cost Optimization](#cost-optimization)

---

## Prerequisites

- Twilio account (sign up at https://www.twilio.com)
- Valid credit card for Twilio billing
- Access to a Qatar phone number for testing

---

## Twilio Account Setup

### Step 1: Upgrade to Paid Account

1. Log in to [Twilio Console](https://console.twilio.com)
2. Go to **Billing** → **Upgrade**
3. Add your credit card details
4. Add initial balance ($20-50 recommended for testing)

### Step 2: Buy a Phone Number

1. Navigate to **Phone Numbers** → **Buy a Number**
2. Select **United States** or **United Kingdom** (recommended)
   - Why not Qatar? Qatar numbers are expensive and often don't support SMS
   - US/UK numbers work globally and are cheaper
3. Filter by **SMS** capability
4. Click **Buy** on any available number
5. **Copy the phone number** (format: +1234567890)

### Step 3: Enable Qatar Geographic Permissions

⚠️ **CRITICAL STEP** - Without this, SMS to Qatar will fail!

1. Go to **Messaging** → **Settings** → **Geo Permissions**
2. Scroll down and find **Qatar**
3. **Check the box** to enable SMS sending to Qatar
4. Click **Save**
5. **Wait 5-10 minutes** for changes to propagate

### Step 4: Create a Messaging Service (Recommended)

Messaging Services provide better deliverability and support for international SMS.

1. Go to **Messaging** → **Services**
2. Click **Create Messaging Service**
3. Enter details:
   - **Friendly Name**: `RESQ-Production`
   - **Use Case**: Select "Notify my users"
4. Click **Create**

5. **Add Sender Pool**:
   - Click **Add Senders**
   - Select **Phone Number**
   - Choose the number you bought in Step 2
   - Click **Add Phone Numbers**

6. **Configure Alpha Sender** (Optional - shows "RESQ" instead of number):
   - Under **Sender Pool** → **Alpha Sender**
   - Add sender ID: **RESQ**
   - Click **Add**

7. **Copy the Messaging Service SID**
   - Starts with `MG...`
   - You'll need this for your `.env` file

8. **Copy your credentials**:
   - Go back to Twilio Console home
   - Find **Account Info** section
   - Copy **Account SID** (starts with `AC...`)
   - Copy **Auth Token** (click "Show" to reveal)

---

## Code Configuration

### Step 5: Update Environment Variables

Create or update your `.env` file:

```bash
# Node Environment
NODE_ENV=production

# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Optional: Keep phone number as backup
TWILIO_PHONE_NUMBER=+1234567890
```

**How it works:**
- If `TWILIO_MESSAGING_SERVICE_SID` is set, it will be used (RECOMMENDED)
- Otherwise, falls back to `TWILIO_PHONE_NUMBER`
- At least one must be configured

### Environment Variables Explained

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `TWILIO_ACCOUNT_SID` | ✅ Yes | Your Twilio account identifier | `AC1234...` |
| `TWILIO_AUTH_TOKEN` | ✅ Yes | Your Twilio authentication token | `abc123...` |
| `TWILIO_MESSAGING_SERVICE_SID` | Recommended | Messaging Service for better delivery | `MG5678...` |
| `TWILIO_PHONE_NUMBER` | Optional | Fallback phone number | `+1234567890` |

---

## Testing

### Step 6: Test SMS Functionality

We've created a test script to verify your setup:

```bash
# Test with your Qatar phone number
node test-qatar-sms.js +97431234567

# Or just run with default (update the script with your number first)
node test-qatar-sms.js
```

**What to expect:**
- ✅ Console shows: "SMS sent successfully!"
- ✅ You receive an SMS with OTP code: "123456"
- ✅ Sender shows as "RESQ" (if Alpha Sender configured) or the phone number

### Step 7: Test API Endpoint

Start your server and test the signup endpoint:

```bash
# Start server
npm run dev

# Test user signup
curl -X POST http://localhost:5000/api/v1/auth/user/signup \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+97431234567"}'

# Expected response:
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "phoneNumber": "+97431234567",
    "expiresIn": 300
  }
}
```

### Verify in Twilio Console

1. Go to **Monitor** → **Logs** → **Messaging**
2. You should see your sent message with status "delivered"
3. Click on the message to see full details

---

## Production Deployment

### Step 8: Production Environment Setup

When deploying to production:

#### Update Environment Variables

```bash
NODE_ENV=production
TWILIO_ACCOUNT_SID=AC... (your production credentials)
TWILIO_AUTH_TOKEN=... (your production credentials)
TWILIO_MESSAGING_SERVICE_SID=MG... (your production Messaging Service)
```

#### Security Checklist

- [ ] Never commit `.env` file to version control
- [ ] Use environment variables or secrets manager in production
- [ ] Rotate Auth Token every 90 days
- [ ] Enable Twilio's two-factor authentication
- [ ] Set up IP whitelisting in Twilio (if applicable)

#### Monitoring Setup

1. **Set up billing alerts**:
   - Twilio Console → **Billing** → **Alerts**
   - Create alerts at: $50, $100, $200

2. **Enable fraud protection**:
   - Twilio Console → **Account** → **Security**
   - Enable fraud detection features

3. **Monitor SMS logs**:
   - Check **Monitor** → **Logs** → **Messaging** daily
   - Look for failed deliveries or unusual patterns

---

## Troubleshooting

### Common Errors and Solutions

#### Error 21408: Permission to send an SMS has not been enabled

**Cause:** Qatar is not enabled in Geo Permissions

**Solution:**
1. Go to Messaging → Settings → Geo Permissions
2. Enable Qatar
3. Wait 5-10 minutes
4. Try again

#### Error 21211: Invalid 'To' Phone Number

**Cause:** Phone number format is incorrect

**Solution:**
- Ensure format is: `+974XXXXXXXX` (12 digits total)
- First digit after 974 must be 3, 5, 6, or 7
- Valid example: `+97431234567`
- Invalid examples: `+9741234567`, `+97421234567`

#### Error 21614: 'To' number is not a valid mobile number

**Cause:** Number doesn't exist or is a landline

**Solution:**
- Verify it's a mobile number (starts with 3, 5, 6, or 7)
- Test with a different Qatar mobile number

#### Error 21606: The "From" phone number is not a valid

**Cause:** Messaging Service has no phone numbers in sender pool

**Solution:**
1. Go to Messaging → Services → Your service
2. Click "Add Senders"
3. Add your purchased phone number

#### SMS not received but no error

**Possible causes:**
1. **Carrier blocking**: Some carriers block automated SMS
2. **Spam filters**: Message flagged as spam
3. **Network delays**: Can take 1-2 minutes in some cases

**Solutions:**
- Wait 5 minutes and check again
- Try a different phone number
- Check Twilio logs for delivery status
- Contact Twilio support if persistent

### Development Mode Behavior

When `NODE_ENV=development`:
- SMS failures won't crash the application
- OTP code will be logged to console
- You can test without spending SMS credits

Console output in dev mode:
```
⚠️  DEV MODE - SMS Failed but continuing...
📱 Phone: +97431234567
🔢 OTP Code: 123456
⏰ Valid for 5 minutes
```

---

## Cost Optimization

### SMS Pricing for Qatar

| Item | Cost |
|------|------|
| Phone number (US/UK) | $1-2/month |
| SMS to Qatar | $0.06-0.10 per message |
| Messaging Service | Free |

### Budget Estimates

| Monthly SMS Volume | Estimated Cost |
|-------------------|----------------|
| 100 messages | $6-10 |
| 1,000 messages | $60-100 |
| 10,000 messages | $600-1,000 |
| 100,000 messages | $6,000-10,000 |

### Cost Saving Tips

1. **Use Messaging Service**: Better deliverability = fewer retries
2. **Implement rate limiting**: Prevent abuse and unnecessary SMS
3. **Use longer OTP expiry**: Reduce resend requests (current: 5 minutes)
4. **Monitor and block spam**: Check for automated attacks
5. **Consider alternative verification**: Email for non-critical operations

### Current Rate Limiting

The app already has rate limiting configured:
- **100 requests per 15 minutes** per IP address
- Helps prevent SMS bombing attacks
- Configured in `src/middlewares/rateLimiter.js`

---

## Phone Number Format Reference

### Valid Qatar Phone Numbers

Qatar mobile numbers follow this format:
- **Country code**: +974 (or 974)
- **Length**: 8 digits after country code
- **First digit**: Must be 3, 5, 6, or 7
- **Total length**: 12 digits including country code

### Examples

✅ **Valid formats:**
- `+97431234567` (preferred)
- `97431234567` (auto-formatted to +974)
- `31234567` (auto-formatted to +97431234567)

❌ **Invalid formats:**
- `+9741234567` (only 7 digits after country code)
- `+97421234567` (starts with 2, not a mobile)
- `974 3123 4567` (contains spaces)
- `+974-3123-4567` (contains hyphens)

### Auto-Formatting

The code automatically formats phone numbers:
- Removes spaces, hyphens, and special characters
- Adds +974 if missing
- Validates format using regex: `/^\+?974[3567]\d{7}$/`

See `src/utils/helpers.js` functions:
- `formatQatarPhone()` - Auto-formats to +974 format
- `isValidQatarPhone()` - Validates Qatar number format
- `cleanPhoneNumber()` - Removes Unicode and whitespace

---

## Support and Resources

### Twilio Resources
- [Twilio Console](https://console.twilio.com)
- [SMS Logs](https://console.twilio.com/monitor/logs/sms)
- [Geo Permissions](https://console.twilio.com/us1/develop/sms/settings/geo-permissions)
- [Twilio Support](https://support.twilio.com)

### Documentation
- [Twilio SMS API Docs](https://www.twilio.com/docs/sms)
- [Messaging Services](https://www.twilio.com/docs/messaging/services)
- [International SMS](https://www.twilio.com/docs/sms/pricing)
- [Error Codes](https://www.twilio.com/docs/api/errors)

### Project Files
- SMS Service: `src/services/sms.service.js`
- Phone Validators: `src/utils/validators.js`
- Phone Helpers: `src/utils/helpers.js`
- Test Script: `test-qatar-sms.js`

---

## Quick Checklist

Before going live, verify:

- [ ] Twilio account upgraded to paid
- [ ] Phone number purchased and verified
- [ ] Qatar enabled in Geo Permissions (waited 10 minutes)
- [ ] Messaging Service created with phone number in sender pool
- [ ] Environment variables set correctly in `.env`
- [ ] Test script passes successfully
- [ ] API endpoint tested with real Qatar number
- [ ] SMS received on test phone
- [ ] Billing alerts configured
- [ ] Production credentials secured
- [ ] Monitoring set up

---

**Last Updated:** 2025-12-29
**Twilio API Version:** 2010-04-01
