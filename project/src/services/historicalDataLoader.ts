// Historical Data Loader - Loads 10 days of data from Central Tank Server into cache
import { ApiService } from './api';
import { SupabaseService } from './supabaseClient';

export class HistoricalDataLoader {
  private static isLoading = false;
  private static loadProgress = 0;
  private static totalStores = 0;
  private static completedStores = 0;

  // Load 10 days of historical data for all stores
  static async loadHistoricalData(
    onProgress?: (progress: number, message: string) => void
  ): Promise<{ success: boolean; message: string; totalLogs: number }> {
    if (this.isLoading) {
      return { success: false, message: 'Already loading historical data', totalLogs: 0 };
    }

    this.isLoading = true;
    this.loadProgress = 0;
    this.completedStores = 0;
    let totalLogsLoaded = 0;

    try {
      console.log('🚀 Starting 10-day historical data load from Central Tank Server...');
      onProgress?.(5, 'Initializing API connection...');

      // Initialize API service
      await ApiService.initialize();
      
      onProgress?.(10, 'Fetching store list...');
      
      // Get all stores
      const stores = await ApiService.getAllStoresData();
      this.totalStores = stores.length;
      
      console.log(`📊 Found ${stores.length} stores, loading 10 days of historical data...`);
      onProgress?.(15, `Found ${stores.length} stores, starting historical data load...`);

      for (let storeIndex = 0; storeIndex < stores.length; storeIndex++) {
        const store = stores[storeIndex];
        const storeProgress = 15 + (storeIndex / stores.length) * 70; // 15% to 85%
        
        onProgress?.(storeProgress, `Loading ${store.store_name} historical data...`);
        console.log(`📈 Loading 10 days of data for ${store.store_name} (${store.tanks.length} tanks)...`);

        for (const tank of store.tanks) {
          try {
            // Load 10 days (240 hours) of historical data
            const logs = await ApiService.getTankLogs(store.store_name, tank.tank_id, 240);
            
            if (logs.length > 0) {
              console.log(`✅ Loaded ${logs.length} logs for ${store.store_name} Tank ${tank.tank_id}`);
              
              // If using Supabase, insert the historical data
              if (await SupabaseService.testConnection()) {
                await this.insertHistoricalLogs(store.store_name, tank.tank_id, logs);
              }
              
              totalLogsLoaded += logs.length;
            } else {
              console.warn(`⚠️ No historical data found for ${store.store_name} Tank ${tank.tank_id}`);
            }
            
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.error(`❌ Failed to load data for ${store.store_name} Tank ${tank.tank_id}:`, error);
          }
        }
        
        this.completedStores++;
        console.log(`✅ Completed ${store.store_name} (${this.completedStores}/${this.totalStores})`);
      }

      onProgress?.(90, 'Finalizing cache...');
      
      // Force a cache refresh to include the new historical data
      console.log('🔄 Refreshing cache with new historical data...');
      
      onProgress?.(100, `Complete! Loaded ${totalLogsLoaded} historical records`);
      
      console.log(`🎉 Historical data load complete: ${totalLogsLoaded} total logs loaded`);
      
      return { 
        success: true, 
        message: `Successfully loaded ${totalLogsLoaded} historical records from ${stores.length} stores`, 
        totalLogs: totalLogsLoaded 
      };

    } catch (error) {
      console.error('❌ Historical data load failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.(0, `Failed: ${errorMessage}`);
      
      return { 
        success: false, 
        message: `Failed to load historical data: ${errorMessage}`, 
        totalLogs: totalLogsLoaded 
      };
    } finally {
      this.isLoading = false;
    }
  }

  // Insert historical logs into Supabase (if available)
  private static async insertHistoricalLogs(storeName: string, tankId: number, logs: any[]): Promise<void> {
    try {
      // Batch insert in chunks of 100 to avoid overwhelming Supabase
      const batchSize = 100;
      for (let i = 0; i < logs.length; i += batchSize) {
        const batch = logs.slice(i, i + batchSize);
        
        const formattedLogs = batch.map(log => ({
          store_name: storeName,
          tank_id: tankId,
          product: log.product || 'Unknown',
          volume: log.volume || 0,
          tc_volume: log.tc_volume || 0,
          ullage: log.ullage || 0,
          height: log.height || 0,
          water: log.water || 0,
          temp: log.temp || 70,
          recorded_at: log.timestamp || new Date().toISOString(),
        }));

        await SupabaseService.insertTankLog(formattedLogs);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log(`✅ Inserted ${logs.length} historical logs for ${storeName} Tank ${tankId} into Supabase`);
    } catch (error) {
      console.warn(`⚠️ Failed to insert historical logs into Supabase for ${storeName} Tank ${tankId}:`, error);
    }
  }

  // Check if historical data load is in progress
  static isLoadingHistoricalData(): boolean {
    return this.isLoading;
  }

  // Get current load progress
  static getLoadProgress(): { progress: number; completed: number; total: number } {
    return {
      progress: this.loadProgress,
      completed: this.completedStores,
      total: this.totalStores,
    };
  }

  // Quick check if we have sufficient historical data
  static async checkHistoricalDataAvailability(): Promise<{
    hasData: boolean;
    totalLogs: number;
    oldestRecord: string | null;
    newestRecord: string | null;
    recommendation: string;
  }> {
    try {
      if (await SupabaseService.testConnection()) {
        const stats = await SupabaseService.getDatabaseStats();
        const tankLogsStats = stats.find(stat => stat.table_name === 'tank_logs');
        
        if (tankLogsStats) {
          const hasData = tankLogsStats.row_count > 50; // Need at least 50 logs for decent charts
          const recommendation = hasData 
            ? 'Sufficient historical data available for charts'
            : 'Insufficient historical data - recommend loading 10 days of data';
            
          return {
            hasData,
            totalLogs: tankLogsStats.row_count,
            oldestRecord: tankLogsStats.oldest_record,
            newestRecord: tankLogsStats.newest_record,
            recommendation,
          };
        }
      }
      
      return {
        hasData: false,
        totalLogs: 0,
        oldestRecord: null,
        newestRecord: null,
        recommendation: 'No database connection - using API mode',
      };
    } catch (error) {
      return {
        hasData: false,
        totalLogs: 0,
        oldestRecord: null,
        newestRecord: null,
        recommendation: 'Error checking data availability',
      };
    }
  }
}