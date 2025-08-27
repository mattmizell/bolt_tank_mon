// Enhanced API service for Central Tank Server
import { ConfigService } from './configService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://central-tank-server.onrender.com';

// Request cache for API responses
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for API cache

export class ApiService {
  private static initialized = false;
  private static warmupInterval: number | null = null;

  // Initialize API service
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return; // Already initialized
    }

    // Silently warm up the server on initialization
    this.warmupServer();
    
    // Schedule periodic silent warmups every 5 minutes to prevent cold starts
    this.warmupInterval = window.setInterval(() => {
      this.warmupServer();
    }, 5 * 60 * 1000);

    this.initialized = true;
  }
  
  // Silently warm up the server to prevent cold starts
  private static async warmupServer(): Promise<void> {
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      const elapsed = Date.now() - startTime;
      const data = await response.json();
      
      // Log warmup success with timing
      console.log(`🔥 Server warmup successful in ${elapsed}ms - Status: ${data.status}, DB: ${data.database}`);
    } catch (error) {
      // Log warmup failure (might indicate cold start)
      console.log('❄️ Server warmup failed (server may be cold starting):', error);
    }
  }

  private static async request<T>(endpoint: string, options?: RequestInit & { cacheKey?: string; cacheDuration?: number }): Promise<T> {
    try {
      const cacheKey = options?.cacheKey || endpoint;
      const cacheDuration = options?.cacheDuration || CACHE_DURATION;
      
      // Check cache first
      if (requestCache.has(cacheKey)) {
        const cached = requestCache.get(cacheKey)!;
        const age = Date.now() - cached.timestamp;
        if (age < cacheDuration) {
          return cached.data;
        }
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(`❌ TIMEOUT: Request to ${endpoint} timed out after 15 seconds`);
        controller.abort();
      }, 15000);
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`❌ HTTP ERROR: ${response.status} ${response.statusText} for ${endpoint}`);
        const errorText = await response.text();
        console.error(`❌ Error response body:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const responseText = await response.text();
      
      let data: T;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ JSON PARSE ERROR for ${endpoint}:`, parseError);
        console.error(`❌ Response text that failed to parse:`, responseText);
        throw new Error(`Invalid JSON response from ${endpoint}: ${parseError}`);
      }
      
      // Cache the response
      requestCache.set(cacheKey, { data, timestamp: Date.now() });
      
      // Clean old cache entries periodically
      if (requestCache.size > 50) {
        const now = Date.now();
        for (const [key, value] of requestCache.entries()) {
          if (now - value.timestamp > cacheDuration * 2) {
            requestCache.delete(key);
          }
        }
      }
      
      return data;
    } catch (error) {
      console.error(`❌ API REQUEST ERROR for ${endpoint}:`, error);
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
    
    try {
      // Use dashboard API for better performance and analytics
      const stores = await this.request('/dashboard/stores', {
        cacheKey: 'dashboard-stores',
        cacheDuration: 2 * 60 * 1000, // 2 minutes
      });
      
      if (!stores || !Array.isArray(stores)) {
        console.error('❌ CRITICAL: /dashboard/stores did not return an array');
        throw new Error('Invalid response from /dashboard/stores - not an array');
      }
      
      // Filter to only visible stores before fetching detailed data
      const visibleStoreNames = ConfigService.getVisibleStores();
      
      // Always include key stores even if not in config yet (note: Gibbs-Biggsville has a hyphen!)
      const alwaysInclude = ['Mascoutah', 'North City', 'Pleasant Hill', 'Gibbs-Biggsville'];
      const visibleStores = stores.filter(store => 
        alwaysInclude.includes(store.store_name) ||
        visibleStoreNames.length === 0 || 
        visibleStoreNames.includes(store.store_name)
      );
      
      // Get detailed data only for visible stores
      const detailedStores = [];
      for (let i = 0; i < visibleStores.length; i++) {
        const store = visibleStores[i];
        const storeDetailUrl = `/dashboard/stores/${store.store_name}`;
        
        const storeData = await this.request(storeDetailUrl, {
          cacheKey: `store-${store.store_name}`,
          cacheDuration: 2 * 60 * 1000,
        });
        
        detailedStores.push(storeData);
      }
      
      return detailedStores;
    } catch (error) {
      console.error('❌ API ERROR in getAllStoresData:', error);
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