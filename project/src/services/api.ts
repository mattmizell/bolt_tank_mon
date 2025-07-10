// Enhanced API service for Central Tank Server

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://central-tank-server.onrender.com';

// Request cache for API responses
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for API cache

export class ApiService {
  private static initialized = false;

  // Initialize API service
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return; // Already initialized
    }

    console.log('🔄 Initializing Central Tank Server API...');
    this.initialized = true;
  }

  private static async request<T>(endpoint: string, options?: RequestInit & { cacheKey?: string; cacheDuration?: number }): Promise<T> {
    try {
      const cacheKey = options?.cacheKey || endpoint;
      const cacheDuration = options?.cacheDuration || CACHE_DURATION;
      
      // Check cache first
      if (requestCache.has(cacheKey)) {
        const cached = requestCache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < cacheDuration) {
          return cached.data;
        }
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
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
      console.error('API request failed:', error);
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
    
    console.log('📊 Fetching from Central Tank Server...');
    return this.request('/stores/full', {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      cacheKey: 'stores-full',
      cacheDuration: 60 * 1000,
    });
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