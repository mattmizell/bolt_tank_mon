// Enhanced API service for Central Tank Server
import { ConfigService } from './configService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://central-tank-server.onrender.com';

// Request cache for API responses
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for API cache

export class ApiService {
  private static initialized = false;

  // Initialize API service
  static async initialize(): Promise<void> {
    console.log(`🚀🔍 MASSIVE DEBUG ApiService.initialize START ===================`);
    console.log(`🔍 DEBUG this.initialized: ${this.initialized}`);
    
    if (this.initialized) {
      console.log(`🔍 DEBUG Already initialized, skipping`);
      return; // Already initialized
    }

    console.log('🔄 Initializing Central Tank Server API...');
    console.log(`🔍 DEBUG Setting initialized to true`);
    this.initialized = true;
    console.log(`🚀🔍 MASSIVE DEBUG ApiService.initialize END ===================`);
  }

  private static async request<T>(endpoint: string, options?: RequestInit & { cacheKey?: string; cacheDuration?: number }): Promise<T> {
    console.log(`🌐🔍 MASSIVE DEBUG API REQUEST START ===================`);
    console.log(`🔍 DEBUG endpoint: ${endpoint}`);
    console.log(`🔍 DEBUG full URL: ${API_BASE_URL}${endpoint}`);
    console.log(`🔍 DEBUG options:`, JSON.stringify(options, null, 2));
    
    try {
      const cacheKey = options?.cacheKey || endpoint;
      const cacheDuration = options?.cacheDuration || CACHE_DURATION;
      
      console.log(`🔍 DEBUG cacheKey: ${cacheKey}`);
      console.log(`🔍 DEBUG cacheDuration: ${cacheDuration}ms`);
      
      // Check cache first
      if (requestCache.has(cacheKey)) {
        const cached = requestCache.get(cacheKey)!;
        const age = Date.now() - cached.timestamp;
        console.log(`🔍 DEBUG cache found, age: ${age}ms (limit: ${cacheDuration}ms)`);
        if (age < cacheDuration) {
          console.log(`🔍 DEBUG using cached data for ${endpoint}`);
          return cached.data;
        } else {
          console.log(`🔍 DEBUG cache expired for ${endpoint}`);
        }
      } else {
        console.log(`🔍 DEBUG no cache for ${endpoint}`);
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(`❌ TIMEOUT: Request to ${endpoint} timed out after 15 seconds`);
        controller.abort();
      }, 15000);
      
      console.log(`🔍 DEBUG making HTTP request to: ${API_BASE_URL}${endpoint}`);
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log(`🔍 DEBUG response status: ${response.status}`);
      console.log(`🔍 DEBUG response statusText: ${response.statusText}`);
      console.log(`🔍 DEBUG response ok: ${response.ok}`);
      console.log(`🔍 DEBUG response headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        console.error(`❌ HTTP ERROR: ${response.status} ${response.statusText} for ${endpoint}`);
        const errorText = await response.text();
        console.error(`❌ Error response body:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const responseText = await response.text();
      console.log(`🔍 DEBUG raw response text length: ${responseText.length}`);
      console.log(`🔍 DEBUG raw response text (first 500 chars):`, responseText.substring(0, 500));
      
      let data: T;
      try {
        data = JSON.parse(responseText);
        console.log(`🔍 DEBUG parsed JSON data:`, JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.error(`❌ JSON PARSE ERROR for ${endpoint}:`, parseError);
        console.error(`❌ Response text that failed to parse:`, responseText);
        throw new Error(`Invalid JSON response from ${endpoint}: ${parseError}`);
      }
      
      // Cache the response
      requestCache.set(cacheKey, { data, timestamp: Date.now() });
      console.log(`🔍 DEBUG cached response for ${cacheKey}`);
      
      // Clean old cache entries periodically
      if (requestCache.size > 50) {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [key, value] of requestCache.entries()) {
          if (now - value.timestamp > cacheDuration * 2) {
            requestCache.delete(key);
            cleanedCount++;
          }
        }
        console.log(`🔍 DEBUG cleaned ${cleanedCount} old cache entries`);
      }
      
      console.log(`🌐🔍 MASSIVE DEBUG API REQUEST SUCCESS END ===================`);
      return data;
    } catch (error) {
      console.error(`❌ CRITICAL API REQUEST ERROR for ${endpoint}:`, error);
      console.error(`❌ Error type:`, typeof error);
      console.error(`❌ Error name:`, error instanceof Error ? error.name : 'Unknown');
      console.error(`❌ Error message:`, error instanceof Error ? error.message : error);
      console.error(`❌ Error stack:`, error instanceof Error ? error.stack : 'No stack');
      console.log(`🌐🔍 MASSIVE DEBUG API REQUEST ERROR END ===================`);
      throw error;
    }
  }

  static async getStores(): Promise<string[]> {
    // Ensure initialization
    await this.initialize();
    
    return this.request<string[]>('/stores', {
      cacheKey: 'stores-list',
      cacheDuration: 5 * 60 * 1000,
    });
  }

  static async getStoreData(storeName: string): Promise<any> {
    // Ensure initialization
    await this.initialize();
    
    const allStores = await this.getAllStoresData();
    return allStores.find(store => store.store_name === storeName) || null;
  }

  // Primary method for getting all stores data
  static async getAllStoresData(): Promise<any[]> {
    // Ensure initialization
    await this.initialize();
    
    console.log('🚀🔍 MASSIVE DEBUG getAllStoresData START ===================');
    console.log('🔍 DEBUG: API_BASE_URL:', API_BASE_URL);
    
    try {
      console.log('🔍 DEBUG: Attempting /dashboard/stores endpoint...');
      
      // Use dashboard API for better performance and analytics
      const stores = await this.request('/dashboard/stores', {
        cacheKey: 'dashboard-stores',
        cacheDuration: 2 * 60 * 1000, // 2 minutes
      });
      
      console.log('🔍 DEBUG: /dashboard/stores response:', JSON.stringify(stores, null, 2));
      console.log('🔍 DEBUG: stores array length:', stores?.length);
      
      if (!stores || !Array.isArray(stores)) {
        console.error('❌ CRITICAL: /dashboard/stores did not return an array');
        console.error('❌ Response type:', typeof stores);
        console.error('❌ Response value:', stores);
        throw new Error('Invalid response from /dashboard/stores - not an array');
      }
      
      // Filter to only visible stores before fetching detailed data
      const visibleStoreNames = ConfigService.getVisibleStores();
      const visibleStores = stores.filter(store => 
        visibleStoreNames.length === 0 || visibleStoreNames.includes(store.store_name)
      );
      
      const skippedStores = stores.filter(s => !visibleStores.includes(s));
      console.log('🔍 DEBUG: Store visibility filtering:', {
        totalStores: stores.length,
        visibleStoreNames,
        visibleStores: visibleStores.map(s => s.store_name),
        skippedStores: skippedStores.map(s => s.store_name)
      });
      
      if (skippedStores.length > 0) {
        console.log(`⚡ PERFORMANCE: Skipping ${skippedStores.length} invisible stores - saved ${skippedStores.length} API calls!`);
      }
      
      // Get detailed data only for visible stores
      const detailedStores = [];
      for (let i = 0; i < visibleStores.length; i++) {
        const store = visibleStores[i];
        console.log(`🔍 DEBUG: Processing visible store ${i + 1}/${visibleStores.length}: ${store.store_name}`);
        
        const storeDetailUrl = `/dashboard/stores/${store.store_name}`;
        console.log(`🔍 DEBUG: Fetching store details from: ${storeDetailUrl}`);
        
        const storeData = await this.request(storeDetailUrl, {
          cacheKey: `store-${store.store_name}`,
          cacheDuration: 2 * 60 * 1000,
        });
        
        console.log(`🔍 DEBUG: Store ${store.store_name} response:`, JSON.stringify(storeData, null, 2));
        console.log(`🔍 DEBUG: Store ${store.store_name} tanks count:`, storeData?.tanks?.length);
        
        if (storeData?.tanks) {
          storeData.tanks.forEach((tank: any, tankIndex: number) => {
            console.log(`🔍 DEBUG: Tank ${tankIndex + 1} in ${store.store_name}:`);
            console.log(`🔍 DEBUG:   tank_id: ${tank.tank_id}`);
            console.log(`🔍 DEBUG:   tank_name: ${tank.tank_name}`);
            console.log(`🔍 DEBUG:   configuration: ${JSON.stringify(tank.configuration)}`);
            console.log(`🔍 DEBUG:   analytics: ${JSON.stringify(tank.analytics)}`);
            console.log(`🔍 DEBUG:   latest_reading: ${JSON.stringify(tank.latest_reading)}`);
            console.log(`🔍 DEBUG:   current_status: ${tank.current_status}`);
          });
        }
        
        detailedStores.push(storeData);
      }
      
      console.log(`🔍 DEBUG: Final detailedStores array:`, JSON.stringify(detailedStores, null, 2));
      console.log(`✅ Fetched ${detailedStores.length} stores with server analytics`);
      console.log('🚀🔍 MASSIVE DEBUG getAllStoresData END ===================');
      return detailedStores;
    } catch (error) {
      console.error('❌ CRITICAL API ERROR in getAllStoresData:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      // NO FALLBACK - LET ERROR BUBBLE UP
      throw new Error(`Dashboard API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enhanced tank logs method - CRITICAL for charts
  static async getTankLogs(storeName: string, tankId: number, hours: number = 48): Promise<any[]> {
    // Ensure initialization
    await this.initialize();
    
    const cacheKey = `logs-${storeName}-${tankId}-${hours}h`;
    
    try {
      console.log(`📊 Fetching ${hours}h of tank logs from Central Tank Server for ${storeName} Tank ${tankId}`);
      
      // Try different endpoint formats for better compatibility
      let endpoint = '';
      let logs: any[] = [];
      
      // First try: hours-based endpoint
      try {
        endpoint = `/stores/${encodeURIComponent(storeName)}/tanks/${tankId}/logs?hours=${hours}`;
        logs = await this.request(endpoint, {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          cacheKey,
          cacheDuration: 5 * 60 * 1000,
        });
        console.log(`✅ Retrieved ${logs.length} logs using hours endpoint`);
      } catch (hoursError) {
        console.warn('Hours endpoint failed, trying days endpoint:', hoursError);
        
        // Second try: days-based endpoint
        const days = Math.ceil(hours / 24);
        endpoint = `/stores/${encodeURIComponent(storeName)}/tanks/${tankId}/logs?days=${days}`;
        logs = await this.request(endpoint, {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          cacheKey: `${cacheKey}-days`,
          cacheDuration: 5 * 60 * 1000,
        });
        console.log(`✅ Retrieved ${logs.length} logs using days endpoint`);
      }
      
      // Filter logs to the requested time range if we got more than needed
      if (logs.length > 0) {
        const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
        const filteredLogs = logs.filter(log => {
          try {
            const logTime = new Date(log.timestamp || log.recorded_at);
            return logTime >= cutoffTime;
          } catch {
            return true; // Keep logs with invalid timestamps
          }
        });
        
        console.log(`📊 Filtered to ${filteredLogs.length} logs within ${hours}h timeframe`);
        return filteredLogs;
      }
      
      return logs;
      
    } catch (error) {
      console.error(`❌ Failed to fetch tank logs for ${storeName} Tank ${tankId}:`, error);
      
      // Final fallback: try to get any recent data
      try {
        console.log('🔄 Attempting fallback with basic logs endpoint...');
        const fallbackEndpoint = `/stores/${encodeURIComponent(storeName)}/tanks/${tankId}/logs`;
        const fallbackLogs = await this.request(fallbackEndpoint, {
          cacheKey: `${cacheKey}-fallback`,
          cacheDuration: 2 * 60 * 1000,
        });
        
        console.log(`📊 Fallback retrieved ${fallbackLogs.length} logs`);
        return fallbackLogs.slice(-100); // Take last 100 readings
      } catch (fallbackError) {
        console.error('All attempts to fetch tank logs failed:', fallbackError);
        throw new Error(`Unable to fetch tank logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // Historical data method
  static async getTankHistoricalLogs(storeName: string, tankId: number, weeks: number = 2): Promise<any[]> {
    // Ensure initialization
    await this.initialize();
    
    const cacheKey = `historical-${storeName}-${tankId}-${weeks}w`;
    
    try {
      // Try weeks-based endpoint first
      try {
        return await this.request(`/stores/${encodeURIComponent(storeName)}/tanks/${tankId}/logs?weeks=${Math.min(weeks, 12)}`, {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          cacheKey,
          cacheDuration: 15 * 60 * 1000,
        });
      } catch (weeksError) {
        // Fallback to days-based request
        const days = weeks * 7;
        return await this.request(`/stores/${encodeURIComponent(storeName)}/tanks/${tankId}/logs?days=${Math.min(days, 180)}`, {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          cacheKey: `${cacheKey}-days`,
          cacheDuration: 15 * 60 * 1000,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch historical data for ${storeName} Tank ${tankId}:`, error);
      
      // Final fallback: try to get recent data
      try {
        return await this.getTankLogs(storeName, tankId, 72); // 3 days
      } catch (fallbackError) {
        console.error(`All attempts failed for ${storeName} Tank ${tankId}:`, fallbackError);
        throw new Error(`Unable to fetch historical data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // Health check
  static async checkServerHealth(): Promise<boolean> {
    // Ensure initialization
    await this.initialize();
    
    try {
      await this.request('/health', {
        headers: {
          'Accept': 'application/json',
        },
        cacheKey: 'health-check',
        cacheDuration: 30 * 1000,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get database statistics
  static async getDatabaseStats(): Promise<any> {
    // Ensure initialization
    await this.initialize();
    
    return { message: 'Database stats not available' };
  }

  // Clear API cache
  static clearCache(): void {
    requestCache.clear();
    this.initialized = false; // Force re-initialization
    console.log('🗑️ Cleared API request cache');
  }

  // Get cache statistics
  static getCacheStats(): { entries: number; totalSize: number; dataSource: string } {
    let totalSize = 0;
    for (const [key, value] of requestCache.entries()) {
      totalSize += JSON.stringify(value.data).length;
    }
    return {
      entries: requestCache.size,
      totalSize: Math.round(totalSize / 1024), // KB
      dataSource: 'Central Tank Server',
    };
  }

  // OPTIMIZED: Get sampled tank data for charts - much faster than raw logs
  static async getSampledTankData(storeName: string, tankId: number, days: number = 5, sampleRate: 'hourly' | '2hourly' | '4hourly' = 'hourly'): Promise<any[]> {
    // Ensure initialization
    await this.initialize();
    
    const cacheKey = `sampled-${storeName}-${tankId}-${days}d-${sampleRate}`;
    
    try {
      console.log(`📊 Fetching ${days}d sampled data (${sampleRate}) for ${storeName} Tank ${tankId} - FAST endpoint`);
      
      const endpoint = `/dashboard/stores/${encodeURIComponent(storeName)}/tanks/${tankId}/sampled?days=${days}&sample_rate=${sampleRate}`;
      
      const sampledData = await this.request(endpoint, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        cacheKey,
        cacheDuration: 5 * 60 * 1000, // 5 minutes cache for sampled data
      });
      
      console.log(`✅ Fast sampled data: ${sampledData.length} hourly points (${sampleRate})`);
      return sampledData;
      
    } catch (error) {
      console.error(`❌ Failed to fetch sampled data for ${storeName} Tank ${tankId}:`, error);
      
      // Fallback to regular logs method if sampled endpoint fails
      console.log('🔄 Falling back to regular getTankLogs...');
      return this.getTankLogs(storeName, tankId, days * 24);
    }
  }
}

// Tank dimension and name mappings (unchanged)
export const STORE_TANK_NAMES: Record<string, Record<number, string>> = {
  "Mascoutah": {
    1: "UNLEADED",
    2: "PREMIUM", 
    3: "DIESEL"
  },
  "North City": {
    1: "UNL T1",
    2: "UNL T2", 
    3: "UNL T3",
    4: "PREM",
    5: "K1"
  },
};

export const STORE_TANK_DIMENSIONS: Record<string, Record<number, [number, number]>> = {
  "Mascoutah": {
    1: [96, 319.3],
    2: [96, 319.3],
    3: [96, 319.3],
  },
  "North City": {
    1: [96, 319.3],
    2: [96, 319.3],
    3: [96, 319.3],
    4: [96, 319.3],
    5: [96, 319.3],
  },
};

export const DEFAULT_DIAMETER = 96;
export const DEFAULT_LENGTH = 319.3;

export function gallonsAtDepth(depthIn: number, diameterIn: number, lengthIn: number): number {
  const r = diameterIn / 2;
  const h = depthIn;
  const L = lengthIn;
  
  if (h <= 0 || h > diameterIn) {
    return 0;
  }
  
  const theta = Math.acos((r - h) / r);
  const segmentArea = (r ** 2) * (theta - Math.sin(2 * theta) / 2);
  const volumeCubicIn = segmentArea * L;
  return volumeCubicIn / 231;
}

export function getTankDimensions(storeName: string, tankId: number): [number, number] {
  return STORE_TANK_DIMENSIONS[storeName]?.[tankId] || [DEFAULT_DIAMETER, DEFAULT_LENGTH];
}

export function getTankName(storeName: string, tankId: number): string {
  return STORE_TANK_NAMES[storeName]?.[tankId] || `Tank ${tankId}`;
}