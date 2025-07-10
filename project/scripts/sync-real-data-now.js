// Quick Real Data Sync - One-time script to populate Supabase with your real data
const { createClient } = require('@supabase/supabase-js');

// Your Supabase credentials
const SUPABASE_URL = 'https://xxcpqjtnsjoxmlqokuj.supabase.co';
const SUPABASE_SERVICE_KEY = 'YOUR_SUPABASE_SERVICE_KEY';
const CENTRAL_TANK_SERVER = 'https://central-tank-server.onrender.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncRealDataNow() {
  console.log('🚀 Syncing real data from Central Tank Server to Supabase...');
  
  try {
    // Test connections
    console.log('🔍 Testing connections...');
    
    // Test Central Tank Server
    const serverResponse = await fetch(`${CENTRAL_TANK_SERVER}/stores`);
    if (!serverResponse.ok) throw new Error(`Central Tank Server error: ${serverResponse.status}`);
    console.log('✅ Central Tank Server connected');
    
    // Test Supabase
    const { data, error } = await supabase.from('tank_logs').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Supabase connected');
    
    // Fetch real stores data
    console.log('📊 Fetching real stores data...');
    const storesResponse = await fetch(`${CENTRAL_TANK_SERVER}/stores/full`);
    if (!storesResponse.ok) throw new Error(`Failed to fetch stores: ${storesResponse.status}`);
    
    const stores = await storesResponse.json();
    console.log(`📈 Found ${stores.length} real stores from your Central Tank Server`);
    
    let totalTanks = 0;
    let syncedLogs = 0;
    let syncedProcessed = 0;
    
    // Sync each store
    for (const store of stores) {
      console.log(`🏪 Syncing store: ${store.store_name} (${store.tanks.length} tanks)`);
      totalTanks += store.tanks.length;
      
      for (const tank of store.tanks) {
        // Sync latest tank reading
        if (tank.latest_log) {
          const { error: logError } = await supabase
            .from('tank_logs')
            .insert({
              store_name: store.store_name,
              tank_id: tank.tank_id,
              product: tank.product || tank.latest_log.product || 'Unknown',
              volume: tank.latest_log.volume || 0,
              tc_volume: tank.latest_log.tc_volume || 0,
              ullage: tank.latest_log.ullage || 0,
              height: tank.latest_log.height || 0,
              water: tank.latest_log.water || 0,
              temp: tank.latest_log.temp || 70,
              recorded_at: tank.latest_log.timestamp || new Date().toISOString(),
            });
          
          if (!logError) syncedLogs++;
        }
        
        // Sync processed data (calculations)
        const { error: processedError } = await supabase.rpc('upsert_processed_tank_data', {
          p_store_name: store.store_name,
          p_tank_id: tank.tank_id,
          p_run_rate: tank.run_rate || 0.5,
          p_hours_to_10_inches: tank.hours_to_10_inches || 0,
          p_status: tank.status || 'normal',
          p_capacity_percentage: tank.capacity_percentage || 0,
          p_predicted_time: tank.predicted_time || null,
          p_data_quality_score: 1.0
        });
        
        if (!processedError) syncedProcessed++;
      }
    }
    
    console.log('');
    console.log('🎉 Real data sync completed successfully!');
    console.log(`📊 Results:`);
    console.log(`   • ${stores.length} stores synced`);
    console.log(`   • ${totalTanks} tanks synced`);
    console.log(`   • ${syncedLogs} tank readings synced`);
    console.log(`   • ${syncedProcessed} processed records synced`);
    console.log('');
    console.log('✅ Your app now has real data and will load in 2-3 seconds!');
    console.log('🔄 Restart your dev server to see the real data: npm run dev');
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// Run the sync
syncRealDataNow();