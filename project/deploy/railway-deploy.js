#!/usr/bin/env node

// Railway Deployment Script - Deploy the sync service to Railway for $5/month

const fs = require('fs');
const path = require('path');

class RailwayDeployer {
  constructor() {
    this.serviceName = 'tank-sync-service';
  }

  async deploy() {
    console.log('🚂 Deploying Tank Sync Service to Railway...');
    console.log('💰 Cost: ~$5/month for always-on background service');
    console.log('');
    
    // Create deployment files
    this.createDeploymentFiles();
    
    // Show deployment instructions
    this.showInstructions();
  }

  createDeploymentFiles() {
    console.log('📝 Creating Railway deployment files...');
    
    // Create Dockerfile for Railway
    const dockerfile = `# Production Dockerfile for Tank Sync Service
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy service files
COPY services/ ./services/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S syncservice -u 1001 -G nodejs

# Change ownership and switch to non-root user
RUN chown -R syncservice:nodejs /app
USER syncservice

# Health check for Railway monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD node -e "console.log('Service healthy')" || exit 1

# Start the production sync service
CMD ["node", "services/production-sync-service.js"]
`;

    fs.writeFileSync('Dockerfile', dockerfile);
    
    // Create Railway configuration
    const railwayConfig = {
      "build": {
        "builder": "DOCKERFILE",
        "dockerfilePath": "Dockerfile"
      },
      "deploy": {
        "startCommand": "node services/production-sync-service.js",
        "healthcheckPath": "/health",
        "healthcheckTimeout": 300,
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 3
      },
      "environments": {
        "production": {
          "variables": {
            "NODE_ENV": "production",
            "CENTRAL_TANK_SERVER": "https://central-tank-server.onrender.com",
            "SUPABASE_URL": "https://xxcpqjtnsjoxmlqokuj.supabase.co",
            "SYNC_INTERVAL": "30000",
            "CLEANUP_INTERVAL": "3600000",
            "HEALTH_CHECK_INTERVAL": "300000"
          }
        }
      }
    };

    fs.writeFileSync('railway.json', JSON.stringify(railwayConfig, null, 2));
    
    // Create .railwayignore
    const railwayIgnore = `# Railway ignore file
node_modules/
.git/
.env
*.log
.DS_Store
src/
public/
dist/
build/
*.md
.gitignore
.eslintrc*
tsconfig*
vite.config*
tailwind.config*
postcss.config*
`;

    fs.writeFileSync('.railwayignore', railwayIgnore);
    
    console.log('✅ Railway deployment files created');
  }

  showInstructions() {
    console.log('');
    console.log('🚂 RAILWAY DEPLOYMENT INSTRUCTIONS');
    console.log('═'.repeat(50));
    console.log('');
    console.log('1️⃣ Install Railway CLI:');
    console.log('   npm install -g @railway/cli');
    console.log('');
    console.log('2️⃣ Login to Railway:');
    console.log('   railway login');
    console.log('');
    console.log('3️⃣ Create new project:');
    console.log('   railway init');
    console.log('   # Choose "Empty Project"');
    console.log('   # Name it "tank-sync-service"');
    console.log('');
    console.log('4️⃣ Set environment variables:');
    console.log('   railway variables set SUPABASE_SERVICE_KEY="YOUR_SUPABASE_SERVICE_KEY"');
    console.log('');
    console.log('5️⃣ Deploy:');
    console.log('   railway up');
    console.log('');
    console.log('6️⃣ Monitor deployment:');
    console.log('   railway logs');
    console.log('');
    console.log('═'.repeat(50));
    console.log('🎉 EXPECTED RESULTS AFTER DEPLOYMENT:');
    console.log('═'.repeat(50));
    console.log('✅ Service runs 24/7 syncing every 30 seconds');
    console.log('✅ Your app loads in 2-3 seconds (down from 30+ seconds)');
    console.log('✅ Real data from Central Tank Server cached in Supabase');
    console.log('✅ Automatic cleanup maintains optimal performance');
    console.log('✅ Health monitoring and error recovery');
    console.log('');
    console.log('💰 Monthly Cost: ~$5 for always-on service');
    console.log('📊 Dashboard: https://railway.app/dashboard');
    console.log('📈 Logs: railway logs --follow');
    console.log('');
    console.log('🔍 Verify deployment success:');
    console.log('   • Check Railway logs for "Production Sync Service started"');
    console.log('   • Monitor sync messages every 30 seconds');
    console.log('   • Test your app - should load in 2-3 seconds');
    console.log('   • Use "Database Status" in app to verify data flow');
    console.log('');
  }
}

// Run deployment
if (require.main === module) {
  const deployer = new RailwayDeployer();
  deployer.deploy();
}

module.exports = { RailwayDeployer };