// Real Data Sync Script - Populate Supabase Cache with Live Data
// This script fetches real data from Central Tank Server and populates Supabase

const { createClient } = require('@supabase/supabase-js');

// Configuration
const CENTRAL_TANK_SERVER = 'https://central-tank-server.onrender.com';
const SUPABASE_URL = 'https://xxcpqjtnsjoxmlqokuj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_KEY_HERE';

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

class RealDataSync {
  constructor() {
    this.isRunning = false;
  }

  async start() {
    console.log('🚀 Starting Real Data Sync from Central Tank Server...');
    
    try {
      // Test connections
      await this.testConnections();
      
      // Initial sync
      await this.syncAllData();
      
      // Set up continuous sync every 30 seconds
      setInterval(async () => {
        if (!this.isRunning) {
          await this.syncAllData();
        }
      }, 30000);
      
      console.log('✅ Real data sync started successfully');
      console.log('📊 Syncing every 30 seconds from Central Tank Server');
      
    } catch (error) {
      console.error('❌ Failed to start real data sync:', error);
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
      console.log('🔄 Syncing real data from Central Tank Server...');
      
      // Fetch all stores data from Central Tank Server
      const response = await fetch(`${CENTRAL_TANK_SERVER}/stores/full`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: HTTP ${response.status}`);
      }
      
      const stores = await response.json();
      console.log(`📊 Retrieved ${stores.length} stores from Central Tank Server`);
      
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
      console.log(`✅ Sync completed in ${duration}ms`);
      console.log(`📈 Synced: ${syncedLogs} tank logs, ${syncedProcessed} processed records`);
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async syncTankLog(storeName, tank) {
    try {
      const log = tank.latest_log;
      
      // Insert/update tank log
      const { error } = await supabase
        .from('tank_logs')
        .upsert({
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
        }, {
          onConflict: 'store_name,tank_id,recorded_at'
        });
      
      if (error) {
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
                .upsert(batch, { onConflict: 'store_name,tank_id,recorded_at' });
              
              if (error) {
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
  const sync = new RealDataSync();
  
  const command = process.argv[2];
  
  if (command === 'historical') {
    const days = parseInt(process.argv[3]) || 5;
    sync.syncHistoricalData(days).then(() => {
      console.log('Historical sync completed. Exiting...');
      process.exit(0);
    });
  } else {
    // Start continuous sync
    sync.start();
  }
}

module.exports = { RealDataSync };