// Simple Local Cache Service - Stores last 5 days of data in localStorage
// First load will be slow, but subsequent loads will be instant

interface CacheData {
  stores: any[];
  timestamp: number;
  expiresAt: number;
  version: string;
}

const CACHE_KEY = 'tank_monitoring_cache_v2';
const CACHE_DURATION = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds
const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const CACHE_VERSION = '2.0';

export class LocalCache {
  // Check if we have valid cached data
  static hasValidCache(): boolean {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return false;

      const data: CacheData = JSON.parse(cached);
      const now = Date.now();
      
      // Check version compatibility and expiration
      return data.version === CACHE_VERSION && 
             data.expiresAt > now && 
             data.stores && 
             data.stores.length > 0;
    } catch (error) {
      console.warn('Error checking cache validity:', error);
      return false;
    }
  }

  // Get cached data
  static getCachedData(): any[] | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: CacheData = JSON.parse(cached);
      const now = Date.now();
      
      if (data.version === CACHE_VERSION && data.expiresAt > now && data.stores) {
        const cacheAge = Math.round((now - data.timestamp) / (1000 * 60)); // minutes
        console.log(`⚡ Using cached data (age: ${cacheAge} minutes) - INSTANT LOAD!`);
        return data.stores;
      }
      
      return null;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }

  // Store data in cache with full processing
  static setCachedData(stores: any[]): void {
    try {
      const now = Date.now();
      const cacheData: CacheData = {
        stores: stores,
        timestamp: now,
        expiresAt: now + CACHE_DURATION,
        version: CACHE_VERSION
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      
      const sizeKB = Math.round(JSON.stringify(cacheData).length / 1024);
      console.log(`💾 Cached ${stores.length} stores (${sizeKB}KB) - valid for 5 days`);
      console.log(`🎉 Next app load will be INSTANT (under 1 second)!`);
    } catch (error) {
      console.error('Error caching data:', error);
      // If storage is full, clear old cache and try again
      this.clearCache();
      try {
        const now = Date.now();
        const cacheData: CacheData = {
          stores: stores,
          timestamp: now,
          expiresAt: now + CACHE_DURATION,
          version: CACHE_VERSION
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        console.log('✅ Cache saved after cleanup');
      } catch (retryError) {
        console.error('Failed to cache data even after cleanup:', retryError);
      }
    }
  }

  // Check if cache needs refresh (older than 30 minutes)
  static needsRefresh(): boolean {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return true;

      const data: CacheData = JSON.parse(cached);
      const now = Date.now();
      const age = now - data.timestamp;
      
      return age > REFRESH_INTERVAL;
    } catch (error) {
      return true;
    }
  }

  // Clear cache
  static clearCache(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
      // Also clear any old cache versions
      localStorage.removeItem('tank_monitoring_cache');
      localStorage.removeItem('tank_monitoring_cache_v1');
      console.log('🗑️ Cache cleared - next load will be slow but will rebuild cache');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Get cache info for debugging
  static getCacheInfo(): { hasCache: boolean; age: number; size: number; expires: string } {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) {
        return { hasCache: false, age: 0, size: 0, expires: 'No cache' };
      }

      const data: CacheData = JSON.parse(cached);
      const now = Date.now();
      const age = Math.round((now - data.timestamp) / (1000 * 60)); // minutes
      const size = Math.round(cached.length / 1024); // KB
      const expires = new Date(data.expiresAt).toLocaleString();

      return { hasCache: true, age, size, expires };
    } catch (error) {
      return { hasCache: false, age: 0, size: 0, expires: 'Error' };
    }
  }

  // Background refresh (call this periodically)
  static async backgroundRefresh(fetchFunction: () => Promise<any[]>): Promise<void> {
    if (!this.needsRefresh()) {
      return; // Cache is still fresh
    }

    try {
      console.log('🔄 Background refresh starting...');
      const freshData = await fetchFunction();
      this.setCachedData(freshData);
      console.log('✅ Background refresh completed - cache updated');
    } catch (error) {
      console.warn('⚠️ Background refresh failed, keeping cached data:', error);
      // Keep using cached data if refresh fails
    }
  }

  // Get cache statistics
  static getCacheStats(): { 
    hasCache: boolean; 
    entries: number; 
    sizeKB: number; 
    age: string; 
    expires: string;
    version: string;
  } {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) {
        return { 
          hasCache: false, 
          entries: 0, 
          sizeKB: 0, 
          age: 'No cache', 
          expires: 'No cache',
          version: 'None'
        };
      }

      const data: CacheData = JSON.parse(cached);
      const now = Date.now();
      const ageMinutes = Math.round((now - data.timestamp) / (1000 * 60));
      const sizeKB = Math.round(cached.length / 1024);
      const totalTanks = data.stores.reduce((sum, store) => sum + store.tanks.length, 0);

      return {
        hasCache: true,
        entries: totalTanks,
        sizeKB: sizeKB,
        age: `${ageMinutes} minutes`,
        expires: new Date(data.expiresAt).toLocaleString(),
        version: data.version || '1.0'
      };
    } catch (error) {
      return { 
        hasCache: false, 
        entries: 0, 
        sizeKB: 0, 
        age: 'Error', 
        expires: 'Error',
        version: 'Error'
      };
    }
  }
}