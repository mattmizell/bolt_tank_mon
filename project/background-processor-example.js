// Enhanced Background Processor for Tank Monitoring
// This service runs alongside your Central Tank Server

const cron = require('node-cron');
const Redis = require('redis');
const { Pool } = require('pg');

class TankMonitoringProcessor {
  constructor() {
    // Database connection
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    
    // Redis cache connection
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.isProcessing = false;
    this.lastProcessTime = null;
  }

  async start() {
    console.log('🚀 Starting Tank Monitoring Background Processor...');
    
    // Connect to Redis
    await this.redis.connect();
    
    // Initial processing
    await this.processAllStores();
    
    // Process every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
      if (!this.isProcessing) {
        await this.processAllStores();
      }
    });

    // Daily cleanup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldData();
    });

    // Health check every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.healthCheck();
    });

    console.log('✅ Background processor started successfully');
  }

  async processAllStores() {
    const startTime = Date.now();
    this.isProcessing = true;
    
    try {
      console.log('🔄 Processing all stores for cache update...');
      
      // Get all stores with their latest data
      const stores = await this.getAllStoresFromDB();
      const processedStores = [];
      
      for (const store of stores) {
        const processedStore = await this.processStore(store);
        processedStores.push(processedStore);
        
        // Cache individual store
        await this.cacheStore(processedStore);
      }
      
      // Cache all stores together
      await this.redis.setEx(
        'all_stores_processed',
        300, // 5 minute expiration
        JSON.stringify({
          stores: processedStores,
          last_updated: new Date().toISOString(),
          processing_time_ms: Date.now() - startTime
        })
      );
      
      this.lastProcessTime = new Date();
      const duration = Date.now() - startTime;
      console.log(`✅ Processed ${stores.length} stores in ${duration}ms`);
      
    } catch (error) {
      console.error('❌ Error processing stores:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processStore(store) {
    const processedTanks = [];
    
    for (const tank of store.tanks) {
      try {
        // Get last 5 days of data for this tank (optimized query)
        const logs = await this.getTankLogs(store.store_name, tank.tank_id, 5);
        
        // Calculate metrics using optimized algorithms
        const metrics = this.calculateTankMetrics(logs, tank);
        
        processedTanks.push({
          tank_id: tank.tank_id,
          tank_name: tank.tank_name || `Tank ${tank.tank_id}`,
          product: tank.product || 'Unknown',
          latest_log: tank.latest_log,
          ...metrics
        });
        
      } catch (error) {
        console.error(`Error processing tank ${tank.tank_id}:`, error);
        
        // Add tank with safe defaults
        processedTanks.push({
          tank_id: tank.tank_id,
          tank_name: tank.tank_name || `Tank ${tank.tank_id}`,
          product: tank.product || 'Unknown',
          latest_log: tank.latest_log,
          run_rate: 0.5,
          hours_to_10_inches: 0,
          status: 'normal',
          capacity_percentage: 0,
          predicted_time: null
        });
      }
    }

    return {
      store_name: store.store_name,
      tanks: processedTanks,
      last_updated: new Date().toISOString(),
      processing_stats: {
        tanks_processed: processedTanks.length,
        tanks_with_data: processedTanks.filter(t => t.run_rate > 0).length
      }
    };
  }

  async getTankLogs(storeName, tankId, days = 5) {
    // Optimized query - only get what we need for calculations
    const query = `
      SELECT tc_volume, height, timestamp, temp, water
      FROM tank_logs 
      WHERE store_name = $1 AND tank_id = $2 
      AND timestamp > NOW() - INTERVAL '${days} days'
      AND tc_volume > 0 AND height > 0
      ORDER BY timestamp ASC
    `;
    
    const result = await this.db.query(query, [storeName, tankId]);
    return result.rows;
  }

  calculateTankMetrics(logs, tank) {
    if (!logs || logs.length < 5) {
      return {
        run_rate: 0.5,
        hours_to_10_inches: 0,
        status: 'normal',
        capacity_percentage: 0,
        predicted_time: null
      };
    }

    // Fast run rate calculation (business hours only)
    const runRate = this.calculateRunRate(logs);
    
    // Current height from latest log
    const currentHeight = tank.latest_log?.height || 0;
    
    // Hours to critical level
    const hoursTo10 = this.calculateHoursTo10Inches(currentHeight, runRate);
    
    // Tank status
    const status = this.getTankStatus(currentHeight, hoursTo10);
    
    // Capacity percentage
    const capacityPercentage = this.calculateCapacityPercentage(
      tank.latest_log?.tc_volume || 0
    );
    
    // Predicted time to reach 10 inches
    const predictedTime = hoursTo10 > 0 ? 
      this.predictDepletionTime(hoursTo10) : null;

    return {
      run_rate: runRate,
      hours_to_10_inches: hoursTo10,
      status: status,
      capacity_percentage: capacityPercentage,
      predicted_time: predictedTime
    };
  }

  calculateRunRate(logs) {
    try {
      // Filter to business hours (5 AM - 11 PM)
      const businessLogs = logs.filter(log => {
        const hour = new Date(log.timestamp).getHours();
        return hour >= 5 && hour < 23;
      });

      if (businessLogs.length < 5) return 0.5;

      // Use last 50 readings for speed
      const recentLogs = businessLogs.slice(-50);
      
      // Remove obvious refills
      const cleanLogs = this.removeRefills(recentLogs);
      
      if (cleanLogs.length < 3) return 0.5;

      // Simple linear regression
      const timeSpan = (
        new Date(cleanLogs[cleanLogs.length - 1].timestamp) - 
        new Date(cleanLogs[0].timestamp)
      ) / (1000 * 60 * 60); // hours

      const volumeChange = cleanLogs[0].tc_volume - cleanLogs[cleanLogs.length - 1].tc_volume;

      if (timeSpan > 0 && volumeChange > 0) {
        const rate = volumeChange / timeSpan;
        return Math.max(0.1, Math.min(150, rate)); // Clamp to reasonable range
      }

      return 0.5;
    } catch (error) {
      console.error('Error calculating run rate:', error);
      return 0.5;
    }
  }

  removeRefills(logs) {
    const cleaned = [logs[0]];
    
    for (let i = 1; i < logs.length; i++) {
      const current = logs[i];
      const previous = logs[i - 1];
      
      const volumeDelta = current.tc_volume - previous.tc_volume;
      const timeDelta = (new Date(current.timestamp) - new Date(previous.timestamp)) / (1000 * 60 * 60);
      
      // Skip obvious refills (large increase in short time)
      if (volumeDelta > 1500 && timeDelta < 2) {
        continue;
      }
      
      cleaned.push(current);
    }
    
    return cleaned;
  }

  calculateHoursTo10Inches(currentHeight, runRate) {
    if (!currentHeight || runRate <= 0 || currentHeight <= 10) {
      return 0;
    }

    // Simplified calculation for 96" diameter tank
    const currentGallons = this.gallonsAtDepth(currentHeight, 96, 319.3);
    const gallonsAt10 = this.gallonsAtDepth(10, 96, 319.3);
    const gallonsUntil10 = currentGallons - gallonsAt10;

    return gallonsUntil10 > 0 ? gallonsUntil10 / runRate : 0;
  }

  gallonsAtDepth(depthInches, diameterInches, lengthInches) {
    const r = diameterInches / 2;
    const h = depthInches;
    const L = lengthInches;
    
    if (h <= 0 || h > diameterInches) return 0;
    
    const theta = Math.acos((r - h) / r);
    const segmentArea = (r ** 2) * (theta - Math.sin(2 * theta) / 2);
    const volumeCubicInches = segmentArea * L;
    
    return volumeCubicInches / 231; // Convert to gallons
  }

  getTankStatus(height, hoursTo10) {
    if (height <= 10 || (hoursTo10 > 0 && hoursTo10 < 24)) {
      return 'critical';
    }
    if (height <= 20 || (hoursTo10 > 0 && hoursTo10 < 48)) {
      return 'warning';
    }
    return 'normal';
  }

  calculateCapacityPercentage(currentVolume) {
    const maxCapacity = 8000; // Typical tank capacity
    return currentVolume > 0 ? Math.min(100, (currentVolume / maxCapacity) * 100) : 0;
  }

  predictDepletionTime(hoursTo10) {
    if (hoursTo10 <= 0) return null;
    
    const now = new Date();
    const futureTime = new Date(now.getTime() + (hoursTo10 * 60 * 60 * 1000));
    return futureTime.toISOString();
  }

  async cacheStore(processedStore) {
    const cacheKey = `store:${processedStore.store_name}`;
    await this.redis.setEx(
      cacheKey,
      600, // 10 minute expiration
      JSON.stringify(processedStore)
    );
  }

  async getAllStoresFromDB() {
    // Get all stores with their latest tank data
    const query = `
      SELECT DISTINCT 
        tl.store_name,
        tl.tank_id,
        tl.product,
        tl.tc_volume,
        tl.height,
        tl.temp,
        tl.water,
        tl.timestamp
      FROM tank_logs tl
      INNER JOIN (
        SELECT store_name, tank_id, MAX(timestamp) as max_timestamp
        FROM tank_logs
        WHERE timestamp > NOW() - INTERVAL '1 day'
        GROUP BY store_name, tank_id
      ) latest ON tl.store_name = latest.store_name 
                AND tl.tank_id = latest.tank_id 
                AND tl.timestamp = latest.max_timestamp
      ORDER BY tl.store_name, tl.tank_id
    `;

    const result = await this.db.query(query);
    
    // Group by store
    const storesMap = new Map();
    
    for (const row of result.rows) {
      if (!storesMap.has(row.store_name)) {
        storesMap.set(row.store_name, {
          store_name: row.store_name,
          tanks: []
        });
      }
      
      storesMap.get(row.store_name).tanks.push({
        tank_id: row.tank_id,
        tank_name: `Tank ${row.tank_id}`,
        product: row.product,
        latest_log: {
          tc_volume: row.tc_volume,
          height: row.height,
          temp: row.temp,
          water: row.water,
          timestamp: row.timestamp
        }
      });
    }
    
    return Array.from(storesMap.values());
  }

  async cleanupOldData() {
    console.log('🧹 Starting daily data cleanup...');
    
    try {
      // Delete raw data older than 5 days
      const deleteResult = await this.db.query(`
        DELETE FROM tank_logs 
        WHERE timestamp < NOW() - INTERVAL '5 days'
      `);
      
      console.log(`✅ Deleted ${deleteResult.rowCount} old records`);
      
      // Create hourly aggregates for deleted data (if table exists)
      try {
        await this.db.query(`
          INSERT INTO tank_logs_hourly (store_name, tank_id, hour, avg_volume, avg_height, min_volume, max_volume, reading_count)
          SELECT 
            store_name,
            tank_id,
            DATE_TRUNC('hour', timestamp) as hour,
            AVG(tc_volume) as avg_volume,
            AVG(height) as avg_height,
            MIN(tc_volume) as min_volume,
            MAX(tc_volume) as max_volume,
            COUNT(*) as reading_count
          FROM tank_logs 
          WHERE timestamp BETWEEN NOW() - INTERVAL '6 days' AND NOW() - INTERVAL '5 days'
          GROUP BY store_name, tank_id, DATE_TRUNC('hour', timestamp)
          ON CONFLICT (store_name, tank_id, hour) DO NOTHING
        `);
        
        console.log('✅ Created hourly aggregates for historical data');
      } catch (aggregateError) {
        console.log('ℹ️ Hourly aggregates table not found, skipping aggregation');
      }
      
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }

  async healthCheck() {
    try {
      // Check database connection
      await this.db.query('SELECT 1');
      
      // Check Redis connection
      await this.redis.ping();
      
      // Check if processing is working
      const timeSinceLastProcess = this.lastProcessTime ? 
        Date.now() - this.lastProcessTime.getTime() : Infinity;
      
      if (timeSinceLastProcess > 120000) { // 2 minutes
        console.warn('⚠️ Background processing may be stuck');
      }
      
      // Store health status in Redis
      await this.redis.setEx('health_check', 300, JSON.stringify({
        status: 'healthy',
        last_process: this.lastProcessTime,
        timestamp: new Date().toISOString()
      }));
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      
      await this.redis.setEx('health_check', 300, JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  }

  // API endpoint for getting processed data
  async getProcessedStores() {
    try {
      const cached = await this.redis.get('all_stores_processed');
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Fallback: process on demand (slower)
      console.log('⚠️ Cache miss, processing on demand...');
      await this.processAllStores();
      
      const freshData = await this.redis.get('all_stores_processed');
      return freshData ? JSON.parse(freshData) : { stores: [], error: 'No data available' };
      
    } catch (error) {
      console.error('Error getting processed stores:', error);
      return { stores: [], error: error.message };
    }
  }

  async getProcessedStore(storeName) {
    try {
      const cached = await this.redis.get(`store:${storeName}`);
      if (cached) {
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting processed store ${storeName}:`, error);
      return null;
    }
  }
}

// Usage example
const processor = new TankMonitoringProcessor();

// Start the background processor
processor.start().catch(console.error);

// Export for use in your main server
module.exports = { TankMonitoringProcessor };

// Example integration with Express server:
/*
const express = require('express');
const app = express();

// Add new endpoint for processed data
app.get('/stores/processed', async (req, res) => {
  try {
    const data = await processor.getProcessedStores();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/stores/:storeName/processed', async (req, res) => {
  try {
    const data = await processor.getProcessedStore(req.params.storeName);
    if (data) {
      res.json(data);
    } else {
      res.status(404).json({ error: 'Store not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
*/