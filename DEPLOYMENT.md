# RESQ Backend - Deployment Guide

## 🚀 Production Deployment Guide

This guide covers deploying the RESQ backend to production environments.

---

## Pre-Deployment Checklist

### 1. Code Completion
- [ ] All controllers implemented
- [ ] All routes connected
- [ ] End-to-end testing completed
- [ ] Error handling verified
- [ ] Security audit performed

### 2. Environment Configuration
- [ ] Production MongoDB database set up
- [ ] Strong JWT secrets generated
- [ ] Third-party API keys configured (Twilio, Google Maps, Al Fatoorah)
- [ ] CORS origin set to production domain
- [ ] File upload limits configured
- [ ] Rate limits adjusted for production load

### 3. Third-Party Services
- [ ] Twilio production account activated
- [ ] Google Maps billing enabled
- [ ] Al Fatoorah production credentials obtained
- [ ] Domain and SSL certificate ready

---

## Environment Setup

### Generate Strong Secrets

```bash
# Generate JWT Access Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate JWT Refresh Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Production .env Configuration

```env
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/resq-production?retryWrites=true&w=majority

# JWT (use generated secrets)
JWT_ACCESS_SECRET=<generated_access_secret>
JWT_REFRESH_SECRET=<generated_refresh_secret>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Twilio (Production)
TWILIO_ACCOUNT_SID=<production_account_sid>
TWILIO_AUTH_TOKEN=<production_auth_token>
TWILIO_PHONE_NUMBER=<qatar_phone_number>

# Google Maps
GOOGLE_MAPS_API_KEY=<production_api_key>

# Al Fatoorah (Production)
AL_FATOORAH_API_KEY=<production_api_key>
AL_FATOORAH_BASE_URL=https://api.myfatoorah.com
AL_FATOORAH_SUCCESS_URL=https://yourdomain.com/api/v1/user/booking/payment/success
AL_FATOORAH_ERROR_URL=https://yourdomain.com/api/v1/user/booking/payment/error

# CORS
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
FILE_UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# Business Logic
DEFAULT_SEARCH_RADIUS=10
BOOKING_REQUEST_TIMEOUT=60
PAYMENT_TIMEOUT=300
PLATFORM_COMMISSION_PERCENTAGE=20
```

---

## Deployment Options

## Option 1: Deploy to AWS EC2

### Step 1: Launch EC2 Instance

1. Launch Ubuntu Server 22.04 LTS
2. Instance type: t3.medium or larger
3. Configure security group:
   - SSH (22) from your IP
   - HTTP (80) from anywhere
   - HTTPS (443) from anywhere
   - Custom TCP (5000) from anywhere (temporary)

### Step 2: Connect and Set Up Server

```bash
# Connect to instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB (or use MongoDB Atlas)
# For Atlas, skip this step

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### Step 3: Deploy Application

```bash
# Create app directory
sudo mkdir -p /var/www/resq-backend
sudo chown -R ubuntu:ubuntu /var/www/resq-backend

# Clone or upload your code
cd /var/www/resq-backend
# Upload your code here (via git, scp, or other method)

# Install dependencies
npm install --production

# Create .env file
nano .env
# Paste production environment variables

# Create uploads directory
mkdir uploads

# Seed database
npm run seed

# Create admin user
npm run create-admin
```

### Step 4: Configure PM2

```bash
# Start application with PM2
pm2 start src/app.js --name resq-backend

# Configure PM2 to start on boot
pm2 startup
pm2 save

# Monitor application
pm2 status
pm2 logs resq-backend
pm2 monit
```

### Step 5: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/resq-backend

# Add the following configuration:
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve uploaded files
    location /uploads {
        alias /var/www/resq-backend/uploads;
        expires 30d;
        access_log off;
    }

    client_max_body_size 10M;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/resq-backend /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 6: Set Up SSL

```bash
# Obtain SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is set up automatically
# Test renewal:
sudo certbot renew --dry-run
```

---

## Option 2: Deploy to DigitalOcean

### Using DigitalOcean App Platform

1. **Create App**
   - Go to DigitalOcean App Platform
   - Connect your GitHub repository
   - Select branch to deploy

2. **Configure Environment**
   - Add all environment variables from `.env`
   - Set `NODE_ENV=production`

3. **Configure Build**
   - Build Command: `npm install`
   - Run Command: `npm start`

4. **Add MongoDB**
   - Use DigitalOcean Managed MongoDB
   - Or connect to MongoDB Atlas

5. **Deploy**
   - Click "Create Resources"
   - DigitalOcean handles SSL automatically

---

## Option 3: Deploy to Heroku

```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login
heroku login

# Create app
heroku create resq-backend

# Add MongoDB
heroku addons:create mongolab:sandbox

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_ACCESS_SECRET=<your_secret>
heroku config:set JWT_REFRESH_SECRET=<your_secret>
heroku config:set TWILIO_ACCOUNT_SID=<your_sid>
# ... set all other variables

# Deploy
git push heroku main

# Run database seed
heroku run npm run seed

# Create admin user
heroku run npm run create-admin

# View logs
heroku logs --tail
```

---

## Option 4: Deploy with Docker

### Dockerfile

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "src/app.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/resq-platform
    env_file:
      - .env
    depends_on:
      - mongo
    volumes:
      - ./uploads:/app/uploads
    restart: unless-stopped

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

volumes:
  mongo-data:
```

### Deploy with Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Seed database
docker-compose exec app npm run seed

# Create admin
docker-compose exec app npm run create-admin

# Stop
docker-compose down
```

---

## Database Configuration

### MongoDB Atlas (Recommended)

1. **Create Cluster**
   - Go to mongodb.com/cloud/atlas
   - Create free or paid cluster in Qatar region (if available)

2. **Configure Network Access**
   - Add your server IP
   - Or allow access from anywhere (0.0.0.0/0) with strong password

3. **Create Database User**
   - Strong username and password
   - Read/Write permissions

4. **Get Connection String**
   ```
   mongodb+srv://username:password@cluster.mongodb.net/resq-production
   ```

5. **Test Connection**
   ```bash
   mongosh "mongodb+srv://username:password@cluster.mongodb.net/resq-production"
   ```

### Self-Hosted MongoDB

```bash
# Install MongoDB
sudo apt install -y mongodb-org

# Enable and start
sudo systemctl enable mongod
sudo systemctl start mongod

# Create admin user
mongosh
use admin
db.createUser({
  user: "resqadmin",
  pwd: "strong_password",
  roles: ["root"]
})

# Enable authentication
sudo nano /etc/mongod.conf
# Add:
# security:
#   authorization: enabled

# Restart
sudo systemctl restart mongod
```

---

## Monitoring & Logging

### PM2 Monitoring

```bash
# Monitor in real-time
pm2 monit

# View logs
pm2 logs resq-backend --lines 100

# View specific logs
pm2 logs resq-backend --err  # Error logs
pm2 logs resq-backend --out  # Output logs
```

### Set Up PM2 Plus (Optional)

```bash
# Link to PM2 Plus
pm2 link <secret_key> <public_key>

# View in web dashboard
# https://app.pm2.io/
```

### Application Logging

Add Winston for production logging:

```bash
npm install winston
```

---

## Backup Strategy

### Database Backups

#### Automated MongoDB Atlas Backups
- MongoDB Atlas provides automatic backups
- Configure backup schedule in Atlas dashboard

#### Manual Backups

```bash
# Backup
mongodump --uri="mongodb+srv://username:password@cluster.mongodb.net/resq-production" --out=/backups/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb+srv://username:password@cluster.mongodb.net/resq-production" /backups/20240101
```

### File Backups

```bash
# Backup uploads directory
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/

# Upload to S3 (optional)
aws s3 cp uploads-backup-$(date +%Y%m%d).tar.gz s3://your-bucket/backups/
```

---

## Security Hardening

### Server Security

```bash
# Update firewall
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP
sudo ufw allow 443     # HTTPS
sudo ufw enable

# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Restart SSH
sudo systemctl restart sshd
```

### Application Security

1. **Use Environment Variables**
   - Never commit `.env` to git
   - Use secrets management (AWS Secrets Manager, etc.)

2. **Rate Limiting**
   - Already implemented in code
   - Monitor for abuse

3. **API Keys**
   - Rotate regularly
   - Use separate keys for dev/prod

4. **HTTPS Only**
   - Enforce SSL/TLS
   - Set up HSTS headers

---

## Performance Optimization

### 1. Database Indexes
Already configured in models. Verify:
```javascript
// Check indexes in MongoDB
db.users.getIndexes()
db.drivers.getIndexes()
db.bookings.getIndexes()
```

### 2. Caching (Optional)
Add Redis for caching:

```bash
# Install Redis
sudo apt install redis-server

# In your app
npm install ioredis
```

### 3. Load Balancing
For high traffic, use load balancer:
- AWS Elastic Load Balancer
- Nginx load balancer
- DigitalOcean Load Balancer

---

## Maintenance

### Update Application

```bash
# Pull latest code
cd /var/www/resq-backend
git pull origin main

# Install dependencies
npm install --production

# Restart with PM2
pm2 restart resq-backend

# Or with zero-downtime
pm2 reload resq-backend
```

### Monitor Resource Usage

```bash
# Check disk space
df -h

# Check memory
free -m

# Check CPU
top

# Check PM2 processes
pm2 status
```

### Clean Up Logs

```bash
# Rotate PM2 logs
pm2 flush

# Clean old logs
find /var/log -name "*.log" -mtime +30 -delete
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs resq-backend --lines 50

# Check Node version
node --version

# Check environment variables
pm2 env 0
```

### Database Connection Issues

```bash
# Test MongoDB connection
mongosh "your_connection_string"

# Check network access in Atlas
# Verify IP whitelist
```

### High Memory Usage

```bash
# Restart application
pm2 restart resq-backend

# Check for memory leaks
pm2 monit

# Increase server resources if needed
```

### 502 Bad Gateway

```bash
# Check if app is running
pm2 status

# Check Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Rollback Procedure

```bash
# If deployment fails, rollback:

# Stop current version
pm2 stop resq-backend

# Checkout previous version
git checkout <previous_commit_hash>

# Install dependencies
npm install --production

# Restart
pm2 restart resq-backend

# Verify
curl http://localhost:5000/health
```

---

## Post-Deployment Verification

### 1. Health Check
```bash
curl https://api.yourdomain.com/health
```

### 2. Test Authentication
```bash
curl -X POST https://api.yourdomain.com/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

### 3. Monitor Logs
```bash
pm2 logs resq-backend --lines 100
```

### 4. Check Background Jobs
Verify cron jobs are running (check logs for booking expiry job output)

### 5. Test Third-Party Integrations
- Send test OTP
- Test geocoding
- Test payment gateway (sandbox mode first)

---

## Support Contacts

- **Hosting Issues:** Contact your hosting provider
- **MongoDB Issues:** Check MongoDB Atlas support
- **Twilio Issues:** Check Twilio status page
- **Application Issues:** Check logs and error tracking

---

## Deployment Checklist Summary

- [ ] Production environment variables configured
- [ ] Strong secrets generated
- [ ] MongoDB production database set up
- [ ] Third-party services configured
- [ ] Server provisioned and secured
- [ ] SSL certificate installed
- [ ] Application deployed
- [ ] PM2 configured for auto-restart
- [ ] Nginx configured as reverse proxy
- [ ] Database seeded
- [ ] Admin user created
- [ ] Backups configured
- [ ] Monitoring set up
- [ ] Health check passing
- [ ] API endpoints tested
- [ ] Documentation updated with production URLs

---

**Your RESQ backend is now production-ready! 🎉**

For any deployment issues, refer to logs and troubleshooting section above.
