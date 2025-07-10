#!/usr/bin/env node

// Render Deployment Helper - Creates deployment files for Render

const fs = require('fs');
const path = require('path');

class RenderDeployer {
  constructor() {
    this.serviceName = 'tank-sync-service';
  }

  async deploy() {
    console.log('🎨 Preparing Tank Sync Service for Render deployment...');
    console.log('💰 Cost: $7/month for always-on background worker');
    console.log('');
    
    // Create deployment files
    this.createDeploymentFiles();
    
    // Show deployment instructions
    this.showInstructions();
  }

  createDeploymentFiles() {
    console.log('📝 Creating Render deployment files...');
    
    // Create render.yaml for automatic deployment
    const renderConfig = `services:
  - type: worker
    name: tank-sync-service
    env: node
    buildCommand: npm ci --only=production
    startCommand: node services/production-sync-service.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: CENTRAL_TANK_SERVER
        value: https://central-tank-server.onrender.com
      - key: SUPABASE_URL
        value: https://xxcpqjtnsjoxmlqokuj.supabase.co
      - key: SUPABASE_SERVICE_KEY
        sync: false  # Set manually in Render dashboard for security
      - key: SYNC_INTERVAL
        value: 30000
      - key: CLEANUP_INTERVAL
        value: 3600000
      - key: HEALTH_CHECK_INTERVAL
        value: 300000
    plan: starter  # $7/month
    region: oregon  # Choose closest to your location
    scaling:
      minInstances: 1
      maxInstances: 1
`;

    fs.writeFileSync('render.yaml', renderConfig);
    
    // Create .renderignore
    const renderIgnore = `# Render ignore file
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
README.md
DEPLOYMENT_GUIDE.md
SCALING_ARCHITECTURE.md
DATABASE_SCALING_PLAN.md
`;

    fs.writeFileSync('.renderignore', renderIgnore);
    
    // Create package.json for production (if needed)
    const packageJson = {
      "name": "tank-sync-service",
      "version": "1.0.0",
      "description": "Background sync service for tank monitoring",
      "main": "services/production-sync-service.js",
      "scripts": {
        "start": "node services/production-sync-service.js",
        "health": "node services/production-sync-service.js health"
      },
      "dependencies": {
        "@supabase/supabase-js": "^2.50.2"
      },
      "engines": {
        "node": ">=18.0.0"
      }
    };

    // Only create if package.json doesn't exist
    if (!fs.existsSync('package.json')) {
      fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    }
    
    console.log('✅ Render deployment files created');
  }

  showInstructions() {
    console.log('');
    console.log('🎨 RENDER DEPLOYMENT INSTRUCTIONS');
    console.log('═'.repeat(50));
    console.log('');
    console.log('🚀 QUICK DEPLOYMENT (Recommended):');
    console.log('');
    console.log('1️⃣ Go to Render Dashboard:');
    console.log('   https://dashboard.render.com');
    console.log('');
    console.log('2️⃣ Click "New +" → "Background Worker"');
    console.log('');
    console.log('3️⃣ Connect your GitHub repository');
    console.log('   (or upload project files manually)');
    console.log('');
    console.log('4️⃣ Configure the service:');
    console.log('   • Name: tank-sync-service');
    console.log('   • Environment: Node');
    console.log('   • Build Command: npm ci');
    console.log('   • Start Command: node services/production-sync-service.js');
    console.log('');
    console.log('5️⃣ Add Environment Variables:');
    console.log('   SUPABASE_SERVICE_KEY=YOUR_SUPABASE_SERVICE_KEY');
    console.log('   CENTRAL_TANK_SERVER=https://central-tank-server.onrender.com');
    console.log('   SUPABASE_URL=https://xxcpqjtnsjoxmlqokuj.supabase.co');
    console.log('   NODE_ENV=production');
    console.log('');
    console.log('6️⃣ Click "Create Background Worker"');
    console.log('');
    console.log('═'.repeat(50));
    console.log('📊 EXPECTED DEPLOYMENT LOGS:');
    console.log('═'.repeat(50));
    console.log('🚀 Starting Production Background Sync Service...');
    console.log('📊 Central Tank Server: https://central-tank-server.onrender.com');
    console.log('💾 Supabase URL: https://xxcpqjtnsjoxmlqokuj.supabase.co');
    console.log('✅ Central Tank Server connection successful');
    console.log('✅ Supabase connection successful');
    console.log('✅ Production Sync Service started successfully');
    console.log('🔄 Continuous sync active - your app will have sub-3 second load times!');
    console.log('✅ Sync #1 completed in 1250ms - 2 stores, 8 tanks');
    console.log('');
    console.log('═'.repeat(50));
    console.log('🎉 RESULTS AFTER DEPLOYMENT:');
    console.log('═'.repeat(50));
    console.log('✅ Service runs 24/7 syncing every 30 seconds');
    console.log('✅ Your app loads in 2-3 seconds (down from 30+ seconds)');
    console.log('✅ Real data from Central Tank Server cached in Supabase');
    console.log('✅ Automatic cleanup maintains optimal performance');
    console.log('✅ Health monitoring and error recovery');
    console.log('');
    console.log('💰 Monthly Cost: $7 for always-on background worker');
    console.log('📊 Dashboard: https://dashboard.render.com');
    console.log('📈 Logs: Available in Render dashboard');
    console.log('');
    console.log('🔍 VERIFY DEPLOYMENT SUCCESS:');
    console.log('• Check Render logs for "Production Sync Service started"');
    console.log('• Monitor sync messages every 30 seconds');
    console.log('• Test your app - should load in 2-3 seconds');
    console.log('• Use "Database Status" in app to verify data flow');
    console.log('');
    console.log('🚨 TROUBLESHOOTING:');
    console.log('• Service won\'t start: Check environment variables');
    console.log('• No data in app: Verify Supabase migration ran');
    console.log('• Slow performance: Check service logs for errors');
    console.log('');
  }
}

// Run deployment helper
if (require.main === module) {
  const deployer = new RenderDeployer();
  deployer.deploy();
}

module.exports = { RenderDeployer };