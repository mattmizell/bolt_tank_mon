#!/usr/bin/env node

// Background Sync Service - Continuously syncs real data from Central Tank Server to Supabase
// This service can be deployed to run 24/7 and keep your cache updated

const { createClient } = require('@supabase/supabase-js');

// Configuration from environment variables
const CENTRAL_TANK_SERVER = process.env.CENTRAL_TANK_SERVER || 'https://central-tank-server.onrender.com';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xxcpqjtnsjoxmlqokuj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_KEY';
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL) || 30000; // 30 seconds
const CLEANUP_INTERVAL = parseInt(process.env.CLEANUP_INTERVAL) || 3600000; // 1 hour

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

class BackgroundSyncService {
  constructor() {
    this.isRunning = false;
    this.syncCount = 0;
    this.lastSyncTime = null;
    this.errors = [];
    this.startTime = new Date();
  }

  async start() {
    console.log('🚀 Starting Background Sync Service...');
    console.log(`📊 Central Tank Server: ${CENTRAL_TANK_SERVER}`);
    console.log(`💾 Supabase URL: ${SUPABASE_URL}`);
    console.log(`⏱️ Sync Interval: ${SYNC_INTERVAL / 1000} seconds`);
    
    try {
      // Test connections
      await this.testConnections();
      
      // Initial sync
      await this.syncAllData();
      
      // Set up continuous sync
      setInterval(async () => {
        if (!this.isRunning) {
          await this.syncAllData();
        }
      }, SYNC_INTERVAL);
      
      // Set up periodic cleanup
      setInterval(async () => {
        await this.cleanupOldData();
      }, CLEANUP_INTERVAL);
      
      // Set up health monitoring
      setInterval(() => {
        this.logHealthStatus();
      }, 300000); // Every 5 minutes
      
      console.log('✅ Background Sync Service started successfully');
      console.log('🔄 Continuous sync active - your app will have sub-3 second load times!');
      
      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\n🛑 Gracefully shutting down Background Sync Service...');
        this.logFinalStats();
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Failed to start Background Sync Service:', error);
      process.exit(1);
    }
  }

  async testConnections() {
    console.log('🔍 Testing connections...');
    
    // Test Central Tank Server
    try {
      const response = await fetch(`${CENTRAL_TANK_SERVER}/stores`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      console.log('✅ Central Tank Server connection successful');
    } catch (error) {
      throw new Error(`Central Tank Server connection failed: ${error.message}`);
    }
    
    // Test Supabase
    try {
      const { data, error } = await supabase.from('tank_logs').select('count').limit(1);
      if (error) throw error;
      console.log('✅ Supabase connection successful');
    } catch (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
  }

  async syncAllData() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      // Fetch all stores data from Central Tank Server
      const response = await fetch(`${CENTRAL_TANK_SERVER}/stores/full`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: HTTP ${response.status}`);
      }
      
      const stores = await response.json();
      
      let totalTanks = 0;
      let syncedLogs = 0;
      let syncedProcessed = 0;
      
      for (const store of stores) {
        totalTanks += store.tanks.length;
        
        for (const tank of store.tanks) {
          // Sync latest log data
          if (tank.latest_log) {
            await this.syncTankLog(store.store_name, tank);
            syncedLogs++;
          }
          
          // Sync processed data (run rates, predictions, etc.)
          await this.syncProcessedData(store.store_name, tank);
          syncedProcessed++;
        }
      }
      
      const duration = Date.now() - startTime;
      this.syncCount++;
      this.lastSyncTime = new Date();
      
      console.log(`✅ Sync #${this.syncCount} completed in ${duration}ms - ${stores.length} stores, ${totalTanks} tanks`);
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.errors.push({
        timestamp: new Date(),
        error: error.message
      });
      
      // Keep only last 10 errors
      if (this.errors.length > 10) {
        this.errors = this.errors.slice(-10);
      }
    } finally {
      this.isRunning = false;
    }
  }

  async syncTankLog(storeName, tank) {
    try {
      const log = tank.latest_log;
      
      // Insert tank log (will be automatically cleaned up after 5 days)
      const { error } = await supabase
        .from('tank_logs')
        .insert({
          store_name: storeName,
          tank_id: tank.tank_id,
          product: tank.product || log.product || 'Unknown',
          volume: log.volume || 0,
          tc_volume: log.tc_volume || 0,
          ullage: log.ullage || 0,
          height: log.height || 0,
          water: log.water || 0,
          temp: log.temp || 70,
          recorded_at: log.timestamp || new Date().toISOString(),
        });
      
      if (error && !error.message.includes('duplicate')) {
        console.error(`Error syncing tank log for ${storeName} Tank ${tank.tank_id}:`, error);
      }
      
    } catch (error) {
      console.error(`Failed to sync tank log for ${storeName} Tank ${tank.tank_id}:`, error);
    }
  }

  async syncProcessedData(storeName, tank) {
    try {
      // Use the upsert function we created in the migration
      const { error } = await supabase.rpc('upsert_processed_tank_data', {
        p_store_name: storeName,
        p_tank_id: tank.tank_id,
        p_run_rate: tank.run_rate || 0.5,
        p_hours_to_10_inches: tank.hours_to_10_inches || 0,
        p_status: tank.status || 'normal',
        p_capacity_percentage: tank.capacity_percentage || 0,
        p_predicted_time: tank.predicted_time || null,
        p_data_quality_score: 1.0
      });
      
      if (error) {
        console.error(`Error syncing processed data for ${storeName} Tank ${tank.tank_id}:`, error);
      }
      
    } catch (error) {
      console.error(`Failed to sync processed data for ${storeName} Tank ${tank.tank_id}:`, error);
    }
  }

  async cleanupOldData() {
    try {
      console.log('🧹 Running automatic data cleanup...');
      
      const { error } = await supabase.rpc('cleanup_old_tank_data');
      
      if (error) {
        console.error('Cleanup error:', error);
      } else {
        console.log('✅ Data cleanup completed');
      }
      
    } catch (error) {
      console.error('Failed to run cleanup:', error);
    }
  }

  logHealthStatus() {
    const uptime = Math.round((Date.now() - this.startTime.getTime()) / 1000 / 60); // minutes
    const lastSync = this.lastSyncTime ? 
      Math.round((Date.now() - this.lastSyncTime.getTime()) / 1000) : 'Never';
    
    console.log(`💚 Health Check - Uptime: ${uptime}m, Syncs: ${this.syncCount}, Last: ${lastSync}s ago, Errors: ${this.errors.length}`);
    
    // Log recent errors if any
    if (this.errors.length > 0) {
      console.log('⚠️ Recent errors:', this.errors.slice(-3).map(e => e.error));
    }
  }

  logFinalStats() {
    const uptime = Math.round((Date.now() - this.startTime.getTime()) / 1000 / 60);
    console.log(`📊 Final Stats - Uptime: ${uptime} minutes, Total Syncs: ${this.syncCount}, Errors: ${this.errors.length}`);
  }

  // Method to sync historical data (run once to populate cache)
  async syncHistoricalData(days = 5) {
    console.log(`🕐 Syncing ${days} days of historical data...`);
    
    try {
      const stores = await fetch(`${CENTRAL_TANK_SERVER}/stores`).then(r => r.json());
      
      for (const storeName of stores) {
        console.log(`📊 Syncing historical data for ${storeName}...`);
        
        // Get store data to find tank IDs
        const storeData = await fetch(`${CENTRAL_TANK_SERVER}/stores/${encodeURIComponent(storeName)}/full`)
          .then(r => r.json());
        
        for (const tank of storeData.tanks) {
          try {
            // Fetch historical logs
            const logs = await fetch(
              `${CENTRAL_TANK_SERVER}/stores/${encodeURIComponent(storeName)}/tanks/${tank.tank_id}/logs?days=${days}`
            ).then(r => r.json());
            
            console.log(`📈 Syncing ${logs.length} historical logs for ${storeName} Tank ${tank.tank_id}`);
            
            // Batch insert historical logs
            const batchSize = 100;
            for (let i = 0; i < logs.length; i += batchSize) {
              const batch = logs.slice(i, i + batchSize).map(log => ({
                store_name: storeName,
                tank_id: tank.tank_id,
                product: log.product || tank.product || 'Unknown',
                volume: log.volume || 0,
                tc_volume: log.tc_volume || 0,
                ullage: log.ullage || 0,
                height: log.height || 0,
                water: log.water || 0,
                temp: log.temp || 70,
                recorded_at: log.timestamp,
              }));
              
              const { error } = await supabase
                .from('tank_logs')
                .insert(batch);
              
              if (error && !error.message.includes('duplicate')) {
                console.error(`Error inserting batch for ${storeName} Tank ${tank.tank_id}:`, error);
              }
            }
            
          } catch (error) {
            console.error(`Failed to sync historical data for ${storeName} Tank ${tank.tank_id}:`, error);
          }
        }
      }
      
      console.log('✅ Historical data sync completed');
      
    } catch (error) {
      console.error('❌ Historical data sync failed:', error);
    }
  }
}

// CLI interface
if (require.main === module) {
  const service = new BackgroundSyncService();
  
  const command = process.argv[2];
  
  if (command === 'historical') {
    const days = parseInt(process.argv[3]) || 5;
    service.syncHistoricalData(days).then(() => {
      console.log('Historical sync completed. Exiting...');
      process.exit(0);
    });
  } else {
    // Start continuous sync service
    service.start();
  }
}

module.exports = { BackgroundSyncService };