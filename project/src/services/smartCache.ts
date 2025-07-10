// Smart Cache Service - Combines cached data with fresh server data intelligently
// Loads cached data instantly, then updates only what's needed from server

interface CachedStoreData {
  store_name: string;
  tanks: CachedTankData[];
  last_updated: string;
  cache_timestamp: number;
}

interface CachedTankData {
  tank_id: number;
  tank_name: string;
  product: string;
  latest_log?: any;
  logs?: any[]; // CRITICAL: Include historical logs in cache
  run_rate: number;
  hours_to_10_inches: number;
  status: string;
  capacity_percentage: number;
  predicted_time?: string;
  last_reading_timestamp?: string;
}

interface SmartCacheData {
  stores: CachedStoreData[];
  version: string;
  created_at: number;
  expires_at: number;
}

const CACHE_KEY = 'tank_monitoring_smart_cache_v1';
const CACHE_DURATION = 5 * 24 * 60 * 60 * 1000; // 5 days
const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes - when to fetch fresh data
const CACHE_VERSION = '1.0';

export class SmartCache {
  // Check if we have any cached data (even if stale)
  static hasCache(): boolean {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return false;

      const data: SmartCacheData = JSON.parse(cached);
      return data.version === CACHE_VERSION && 
             data.stores && 
             data.stores.length > 0 &&
             Date.now() < data.expires_at;
    } catch (error) {
      console.warn('Error checking cache:', error);
      return false;
    }
  }

  // Get cached data immediately (for instant loading)
  static getCachedStores(): CachedStoreData[] {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return [];

      const data: SmartCacheData = JSON.parse(cached);
      if (data.version === CACHE_VERSION && data.stores) {
        const age = Math.round((Date.now() - data.created_at) / (1000 * 60));
        const totalLogs = data.stores.reduce((sum, store) => 
          sum + store.tanks.reduce((tankSum, tank) => tankSum + (tank.logs?.length || 0), 0), 0);
        console.log(`⚡ Loading cached data instantly (age: ${age} minutes) with ${totalLogs} historical logs`);
        return data.stores;
      }
      
      return [];
    } catch (error) {
      console.error('Error reading cache:', error);
      return [];
    }
  }

  // Check which stores need fresh data from server
  static getStoresNeedingUpdate(cachedStores: CachedStoreData[]): string[] {
    const now = Date.now();
    const storeNames: string[] = [];

    for (const store of cachedStores) {
      const age = now - store.cache_timestamp;
      if (age > STALE_THRESHOLD) {
        storeNames.push(store.store_name);
      }
    }

    return storeNames;
  }

  // FIXED: Merge cached data with fresh server data intelligently - PRESERVE HISTORICAL LOGS
  static mergeData(cachedStores: CachedStoreData[], freshStores: any[]): CachedStoreData[] {
    console.log('🔄 Merging cached data with fresh server data...');
    const merged: CachedStoreData[] = [...cachedStores];
    const now = Date.now();

    // Update stores that we got fresh data for
    for (const freshStore of freshStores) {
      const existingIndex = merged.findIndex(s => s.store_name === freshStore.store_name);
      
      const updatedStore: CachedStoreData = {
        store_name: freshStore.store_name,
        tanks: freshStore.tanks.map((freshTank: any) => {
          // CRITICAL: Try to preserve historical logs from existing cache
          const existingStore = merged.find(s => s.store_name === freshStore.store_name);
          const existingTank = existingStore?.tanks.find(t => t.tank_id === freshTank.tank_id);
          const existingLogs = existingTank?.logs || [];
          
          console.log(`📊 Tank ${freshTank.tank_id}: Preserving ${existingLogs.length} cached logs + ${freshTank.logs?.length || 0} fresh logs`);
          
          // Combine existing cached logs with any new logs from fresh data
          let combinedLogs = [...existingLogs];
          if (freshTank.logs && freshTank.logs.length > 0) {
            // Add fresh logs, avoiding duplicates
            const existingTimestamps = new Set(existingLogs.map(log => log.timestamp));
            const newLogs = freshTank.logs.filter(log => !existingTimestamps.has(log.timestamp));
            combinedLogs = [...combinedLogs, ...newLogs];
            
            // Sort by timestamp and keep last 5 days worth
            combinedLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const fiveDaysAgo = now - (5 * 24 * 60 * 60 * 1000);
            combinedLogs = combinedLogs.filter(log => new Date(log.timestamp).getTime() > fiveDaysAgo);
            
            console.log(`✅ Tank ${freshTank.tank_id}: Combined to ${combinedLogs.length} total historical logs`);
          }

          return {
            tank_id: freshTank.tank_id,
            tank_name: freshTank.tank_name || `Tank ${freshTank.tank_id}`,
            product: freshTank.product || 'Unknown',
            latest_log: freshTank.latest_log,
            logs: combinedLogs, // CRITICAL: Preserve and combine historical logs
            run_rate: freshTank.run_rate || 0.5,
            hours_to_10_inches: freshTank.hours_to_10_inches || 0,
            status: freshTank.status || 'normal',
            capacity_percentage: freshTank.capacity_percentage || 0,
            predicted_time: freshTank.predicted_time,
            last_reading_timestamp: freshTank.latest_log?.timestamp,
          };
        }),
        last_updated: new Date().toISOString(),
        cache_timestamp: now,
      };

      if (existingIndex >= 0) {
        merged[existingIndex] = updatedStore;
      } else {
        merged.push(updatedStore);
      }
    }

    const totalLogs = merged.reduce((sum, store) => 
      sum + store.tanks.reduce((tankSum, tank) => tankSum + (tank.logs?.length || 0), 0), 0);
    console.log(`✅ Merge complete: ${merged.length} stores with ${totalLogs} total historical logs preserved`);

    return merged;
  }

  // Save merged data back to cache
  static saveToCache(stores: CachedStoreData[]): void {
    try {
      const now = Date.now();
      const cacheData: SmartCacheData = {
        stores: stores,
        version: CACHE_VERSION,
        created_at: now,
        expires_at: now + CACHE_DURATION,
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      
      const sizeKB = Math.round(JSON.stringify(cacheData).length / 1024);
      const freshStores = stores.filter(s => (now - s.cache_timestamp) < 60000).length;
      const totalLogs = stores.reduce((sum, store) => 
        sum + store.tanks.reduce((tankSum, tank) => tankSum + (tank.logs?.length || 0), 0), 0);
      
      console.log(`💾 Smart cache updated: ${stores.length} stores (${freshStores} fresh), ${sizeKB}KB, ${totalLogs} historical logs cached`);
    } catch (error) {
      console.error('Error saving to cache:', error);
      // Try to clear old data and retry
      this.clearCache();
      try {
        const cacheData: SmartCacheData = {
          stores: stores,
          version: CACHE_VERSION,
          created_at: Date.now(),
          expires_at: Date.now() + CACHE_DURATION,
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        console.log('✅ Cache saved after cleanup');
      } catch (retryError) {
        console.error('Failed to save cache even after cleanup:', retryError);
      }
    }
  }

  // Convert cached data to Store objects for the app - FIXED TO PRESERVE LOGS
  static convertToStores(cachedStores: CachedStoreData[]): any[] {
    console.log('🔄 Converting cached stores to Store objects...');
    
    const stores = cachedStores.map(cachedStore => {
      const tanks = cachedStore.tanks.map(cachedTank => {
        const logsCount = cachedTank.logs?.length || 0;
        console.log(`📊 Tank ${cachedTank.tank_id}: ${logsCount} historical logs available`);
        
        return {
          tank_id: cachedTank.tank_id,
          tank_name: cachedTank.tank_name,
          product: cachedTank.product,
          latest_log: cachedTank.latest_log,
          logs: cachedTank.logs || [], // CRITICAL: Include cached historical logs
          run_rate: cachedTank.run_rate,
          hours_to_10_inches: cachedTank.hours_to_10_inches,
          status: cachedTank.status,
          capacity_percentage: cachedTank.capacity_percentage,
          predicted_time: cachedTank.predicted_time,
          // Add profile for compatibility
          profile: {
            store_name: cachedStore.store_name,
            tank_id: cachedTank.tank_id,
            tank_name: cachedTank.tank_name,
            diameter_inches: 96,
            length_inches: 319.3,
            max_capacity_gallons: 10000,
            critical_height_inches: 10,
            warning_height_inches: 20,
          },
        };
      });

      const totalLogs = tanks.reduce((sum, tank) => sum + (tank.logs?.length || 0), 0);
      console.log(`✅ Store ${cachedStore.store_name}: ${tanks.length} tanks, ${totalLogs} total historical logs`);

      return {
        store_name: cachedStore.store_name,
        tanks: tanks,
        last_updated: cachedStore.last_updated,
      };
    });

    const grandTotalLogs = stores.reduce((sum, store) => 
      sum + store.tanks.reduce((tankSum: number, tank: any) => tankSum + (tank.logs?.length || 0), 0), 0);
    console.log(`🎉 Converted ${stores.length} stores with ${grandTotalLogs} total historical logs for charts`);

    return stores;
  }

  // Clear cache
  static clearCache(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
      // Clear old cache versions
      localStorage.removeItem('tank_monitoring_cache');
      localStorage.removeItem('tank_monitoring_cache_v1');
      localStorage.removeItem('tank_monitoring_cache_v2');
      console.log('🗑️ Smart cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Get cache statistics
  static getCacheInfo(): { 
    hasCache: boolean; 
    age: number; 
    size: number; 
    expires: string;
    staleStores: number;
    totalStores: number;
  } {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) {
        return { 
          hasCache: false, 
          age: 0, 
          size: 0, 
          expires: 'No cache',
          staleStores: 0,
          totalStores: 0,
        };
      }

      const data: SmartCacheData = JSON.parse(cached);
      const now = Date.now();
      const age = Math.round((now - data.created_at) / (1000 * 60));
      const size = Math.round(cached.length / 1024);
      const expires = new Date(data.expires_at).toLocaleString();
      
      const staleStores = data.stores.filter(store => 
        (now - store.cache_timestamp) > STALE_THRESHOLD
      ).length;

      return {
        hasCache: true,
        age,
        size,
        expires,
        staleStores,
        totalStores: data.stores.length,
      };
    } catch (error) {
      return { 
        hasCache: false, 
        age: 0, 
        size: 0, 
        expires: 'Error',
        staleStores: 0,
        totalStores: 0,
      };
    }
  }

  // Check if any stores need updating
  static needsUpdate(): boolean {
    const cachedStores = this.getCachedStores();
    const staleStores = this.getStoresNeedingUpdate(cachedStores);
    return staleStores.length > 0;
  }

  // Get list of stores that need fresh data
  static getStaleStoreNames(): string[] {
    const cachedStores = this.getCachedStores();
    return this.getStoresNeedingUpdate(cachedStores);
  }
}