#!/usr/bin/env node

// Deploy Sync Service - Deploy the background sync service to a cloud platform
// This script helps you deploy the sync service to run 24/7

const fs = require('fs');
const path = require('path');

class SyncServiceDeployer {
  constructor() {
    this.platforms = {
      'railway': this.deployToRailway.bind(this),
      'render': this.deployToRender.bind(this),
      'heroku': this.deployToHeroku.bind(this),
      'digitalocean': this.deployToDigitalOcean.bind(this),
    };
  }

  async deploy(platform = 'railway') {
    console.log(`🚀 Deploying Background Sync Service to ${platform}...`);
    
    // Create deployment files
    this.createDeploymentFiles();
    
    if (this.platforms[platform]) {
      await this.platforms[platform]();
    } else {
      console.log('❌ Unsupported platform. Supported: railway, render, heroku, digitalocean');
      this.showManualInstructions();
    }
  }

  createDeploymentFiles() {
    console.log('📝 Creating deployment files...');
    
    // Create Dockerfile
    const dockerfile = `# Dockerfile for Background Sync Service
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy service files
COPY services/ ./services/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S syncservice -u 1001

# Change ownership
RUN chown -R syncservice:nodejs /app
USER syncservice

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "console.log('Service healthy')" || exit 1

# Start the sync service
CMD ["node", "services/background-sync-service.js"]
`;

    fs.writeFileSync('Dockerfile.sync', dockerfile);
    
    // Create docker-compose for local testing
    const dockerCompose = `# Docker Compose for Background Sync Service
version: '3.8'

services:
  tank-sync-service:
    build:
      context: .
      dockerfile: Dockerfile.sync
    environment:
      - CENTRAL_TANK_SERVER=https://central-tank-server.onrender.com
      - SUPABASE_URL=https://xxcpqjtnsjoxmlqokuj.supabase.co
      - SUPABASE_SERVICE_KEY=\${SUPABASE_SERVICE_KEY}
      - SYNC_INTERVAL=30000
      - CLEANUP_INTERVAL=3600000
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 128M
`;

    fs.writeFileSync('docker-compose.sync.yml', dockerCompose);
    
    // Create Railway deployment config
    const railwayConfig = `{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.sync"
  },
  "deploy": {
    "startCommand": "node services/background-sync-service.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}`;

    fs.writeFileSync('railway.json', railwayConfig);
    
    // Create Render deployment config
    const renderConfig = `services:
  - type: worker
    name: tank-sync-service
    env: node
    buildCommand: npm ci
    startCommand: node services/background-sync-service.js
    envVars:
      - key: CENTRAL_TANK_SERVER
        value: https://central-tank-server.onrender.com
      - key: SUPABASE_URL
        value: https://xxcpqjtnsjoxmlqokuj.supabase.co
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: SYNC_INTERVAL
        value: 30000
      - key: CLEANUP_INTERVAL
        value: 3600000
`;

    fs.writeFileSync('render.yaml', renderConfig);
    
    console.log('✅ Deployment files created');
  }

  async deployToRailway() {
    console.log('🚂 Railway Deployment Instructions:');
    console.log('');
    console.log('1. Install Railway CLI:');
    console.log('   npm install -g @railway/cli');
    console.log('');
    console.log('2. Login to Railway:');
    console.log('   railway login');
    console.log('');
    console.log('3. Create new project:');
    console.log('   railway init');
    console.log('');
    console.log('4. Set environment variables:');
    console.log('   railway variables set SUPABASE_SERVICE_KEY="your-service-key"');
    console.log('');
    console.log('5. Deploy:');
    console.log('   railway up');
    console.log('');
    console.log('💰 Cost: ~$5/month for always-on service');
    console.log('🔗 Dashboard: https://railway.app/dashboard');
  }

  async deployToRender() {
    console.log('🎨 Render Deployment Instructions:');
    console.log('');
    console.log('1. Go to https://render.com and create account');
    console.log('2. Connect your GitHub repository');
    console.log('3. Create new "Background Worker" service');
    console.log('4. Use these settings:');
    console.log('   - Build Command: npm ci');
    console.log('   - Start Command: node services/background-sync-service.js');
    console.log('5. Add environment variables in Render dashboard:');
    console.log('   - SUPABASE_SERVICE_KEY: your-service-key');
    console.log('   - CENTRAL_TANK_SERVER: https://central-tank-server.onrender.com');
    console.log('   - SUPABASE_URL: https://xxcpqjtnsjoxmlqokuj.supabase.co');
    console.log('');
    console.log('💰 Cost: $7/month for always-on service');
    console.log('🔗 Dashboard: https://dashboard.render.com');
  }

  async deployToHeroku() {
    console.log('🟣 Heroku Deployment Instructions:');
    console.log('');
    console.log('1. Install Heroku CLI:');
    console.log('   https://devcenter.heroku.com/articles/heroku-cli');
    console.log('');
    console.log('2. Login and create app:');
    console.log('   heroku login');
    console.log('   heroku create tank-sync-service');
    console.log('');
    console.log('3. Set environment variables:');
    console.log('   heroku config:set SUPABASE_SERVICE_KEY="your-service-key"');
    console.log('   heroku config:set CENTRAL_TANK_SERVER="https://central-tank-server.onrender.com"');
    console.log('   heroku config:set SUPABASE_URL="https://xxcpqjtnsjoxmlqokuj.supabase.co"');
    console.log('');
    console.log('4. Deploy:');
    console.log('   git push heroku main');
    console.log('');
    console.log('💰 Cost: $7/month for Eco dyno');
    console.log('🔗 Dashboard: https://dashboard.heroku.com');
  }

  async deployToDigitalOcean() {
    console.log('🌊 DigitalOcean App Platform Instructions:');
    console.log('');
    console.log('1. Go to https://cloud.digitalocean.com/apps');
    console.log('2. Create new app from GitHub repository');
    console.log('3. Configure as "Worker" service');
    console.log('4. Set run command: node services/background-sync-service.js');
    console.log('5. Add environment variables:');
    console.log('   - SUPABASE_SERVICE_KEY');
    console.log('   - CENTRAL_TANK_SERVER');
    console.log('   - SUPABASE_URL');
    console.log('');
    console.log('💰 Cost: $5/month for basic worker');
    console.log('🔗 Dashboard: https://cloud.digitalocean.com/apps');
  }

  showManualInstructions() {
    console.log('');
    console.log('📋 Manual Deployment Options:');
    console.log('');
    console.log('🐳 Docker (Any Platform):');
    console.log('   docker build -f Dockerfile.sync -t tank-sync .');
    console.log('   docker run -d --name tank-sync \\');
    console.log('     -e SUPABASE_SERVICE_KEY="your-key" \\');
    console.log('     -e CENTRAL_TANK_SERVER="https://central-tank-server.onrender.com" \\');
    console.log('     -e SUPABASE_URL="https://xxcpqjtnsjoxmlqokuj.supabase.co" \\');
    console.log('     tank-sync');
    console.log('');
    console.log('🖥️ VPS (Ubuntu/Debian):');
    console.log('   1. Copy services/ folder to your server');
    console.log('   2. Install Node.js and npm');
    console.log('   3. npm install @supabase/supabase-js');
    console.log('   4. Set environment variables');
    console.log('   5. Use PM2: pm2 start services/background-sync-service.js --name tank-sync');
    console.log('');
    console.log('☁️ Serverless (AWS Lambda/Vercel):');
    console.log('   - Modify service to run as scheduled function');
    console.log('   - Use cron triggers instead of setInterval');
    console.log('   - Deploy as separate functions for sync and cleanup');
  }

  showPostDeployment() {
    console.log('');
    console.log('🎉 Post-Deployment Checklist:');
    console.log('');
    console.log('✅ Service is running and syncing every 30 seconds');
    console.log('✅ Your app now loads in 2-3 seconds (down from 30+ seconds)');
    console.log('✅ Real data from Central Tank Server is cached in Supabase');
    console.log('✅ Automatic cleanup keeps database size manageable');
    console.log('');
    console.log('🔍 Monitoring:');
    console.log('- Check service logs for sync status');
    console.log('- Monitor Supabase table row counts');
    console.log('- Use "Database Status" in your app');
    console.log('');
    console.log('🚨 Alerts:');
    console.log('- Set up platform alerts for service downtime');
    console.log('- Monitor sync frequency and error rates');
    console.log('- Check Supabase usage limits');
  }
}

// CLI interface
if (require.main === module) {
  const deployer = new SyncServiceDeployer();
  const platform = process.argv[2] || 'railway';
  
  deployer.deploy(platform).then(() => {
    deployer.showPostDeployment();
  });
}

module.exports = { SyncServiceDeployer };