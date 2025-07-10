// Production-Only Dashboard API Service - Fixed Connection
const API_BASE_URL = import.meta.env.VITE_REACT_APP_API_URL || 'https://central-tank-server.onrender.com';

export class ApiService {
  private static retryCount = 0;
  private static maxRetries = 3;
  private static baseDelay = 3000; // Increased to 3 seconds
  private static isServerDown = false;
  private static lastServerCheck = 0;
  private static serverCheckInterval = 60000;
  private static connectionAttempts = 0;
  private static lastSuccessfulConnection = 0;

  // Production fetch with enhanced debugging
  private static async fetchWithRetry(url: string, options: RequestInit = {}, retryAttempt = 0): Promise<Response> {
    const controller = new AbortController();
    
    // Increased timeout for production API to prevent premature aborts
    const timeoutDuration = 120000; // 120 seconds (increased from 90 seconds)
    const requestStart = Date.now();
    
    const timeoutId = setTimeout(() => {
      console.log(`⏰ Request timeout after ${timeoutDuration}ms for: ${url}`);
      controller.abort();
    }, timeoutDuration);

    try {
      console.log(`🌐 Production API Call #${this.connectionAttempts + 1}: ${url}`);
      console.log(`📡 Request options:`, { 
        method: options.method || 'GET',
        timeout: `${timeoutDuration}ms`,
        attempt: `${retryAttempt + 1}/${this.maxRetries + 1}`
      });
      
      this.connectionAttempts++;

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'User-Agent': 'TankMonitor/1.0',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      const requestTime = Date.now() - requestStart;

      console.log(`📊 Response received in ${requestTime}ms:`, {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        url: response.url
      });

      if (!response.ok) {
        let errorText = 'No error details available';
        try {
          errorText = await response.text();
        } catch (textError) {
          console.warn('Could not read error response text:', textError);
        }
        
        console.error(`❌ HTTP Error ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      // Validate content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn(`⚠️ Unexpected content type: ${contentType}`);
      }

      // Reset counters on success
      this.retryCount = 0;
      this.isServerDown = false;
      this.lastSuccessfulConnection = Date.now();
      
      console.log(`✅ Production API Success: ${url} (${requestTime}ms)`);
      return response;

    } catch (error) {
      clearTimeout(timeoutId);
      const requestTime = Date.now() - requestStart;
      
      console.error(`❌ Production API Error:`, {
        url,
        error: error.message,
        name: error.name,
        attempt: retryAttempt + 1,
        maxRetries: this.maxRetries,
        requestTime: `${requestTime}ms`
      });

      const isNetworkError = error instanceof Error && (
        error.name === 'AbortError' ||
        error.name === 'TypeError' ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('signal is aborted') ||
        error.message.includes('timeout') ||
        error.message.includes('ERR_NETWORK') ||
        error.message.includes('ERR_INTERNET_DISCONNECTED')
      );

      if (isNetworkError && retryAttempt < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, retryAttempt); // 3s, 6s, 12s
        console.log(`🔄 Network error detected, retrying in ${delay}ms...`);
        console.log(`   Retry ${retryAttempt + 1}/${this.maxRetries} for: ${url}`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retryAttempt + 1);
      }

      // Mark server as down after max retries
      if (retryAttempt >= this.maxRetries) {
        this.isServerDown = true;
        this.lastServerCheck = Date.now();
        console.error(`🚨 Server marked as DOWN after ${this.maxRetries} retries`);
      }

      throw error;
    }
  }

  // Enhanced health check with detailed logging
  static async checkServerHealth(): Promise<{ 
    isHealthy: boolean; 
    responseTime?: number; 
    error?: string; 
    connectionQuality?: string;
    endpoint?: string;
  }> {
    const startTime = Date.now();
    const healthEndpoint = `${API_BASE_URL}/dashboard/stores`;
    
    console.log(`🏥 Health check starting for: ${healthEndpoint}`);
    
    try {
      const response = await this.fetchWithRetry(healthEndpoint, {
        method: 'GET',
        cache: 'no-cache'
      }, 0);
      
      const responseTime = Date.now() - startTime;
      
      // Try to parse response to ensure it's valid
      const data = await response.json();
      console.log(`🏥 Health check data:`, { 
        dataType: typeof data,
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : 'N/A',
        sample: Array.isArray(data) && data.length > 0 ? data[0] : data
      });
      
      this.isServerDown = false;
      this.lastSuccessfulConnection = Date.now();
      
      let connectionQuality = 'excellent';
      if (responseTime > 15000) connectionQuality = 'poor';
      else if (responseTime > 10000) connectionQuality = 'fair';
      else if (responseTime > 5000) connectionQuality = 'good';
      
      console.log(`✅ Health check passed: ${responseTime}ms (${connectionQuality})`);
      
      return { 
        isHealthy: true, 
        responseTime,
        connectionQuality,
        endpoint: healthEndpoint
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.isServerDown = true;
      this.lastServerCheck = Date.now();
      
      console.error(`❌ Health check failed:`, {
        endpoint: healthEndpoint,
        error: error.message,
        responseTime: `${responseTime}ms`,
        errorType: error.name
      });
      
      return { 
        isHealthy: false, 
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionQuality: 'disconnected',
        endpoint: healthEndpoint
      };
    }
  }

  // Get store overview with enhanced error handling
  static async getStoreOverview(): Promise<any[]> {
    console.log(`🏪 Getting store overview from: ${API_BASE_URL}/dashboard/stores`);
    
    try {
      const response = await this.fetchWithRetry(`${API_BASE_URL}/dashboard/stores`);
      
      // Check if response is valid before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error(`❌ Invalid content type. Expected JSON, got: ${contentType}`);
        console.error(`Response text:`, responseText.substring(0, 500));
        throw new Error(`Invalid response format: expected JSON, got ${contentType}`);
      }
      
      const stores = await response.json();
      
      console.log(`📋 Raw store overview response:`, {
        type: typeof stores,
        isArray: Array.isArray(stores),
        length: Array.isArray(stores) ? stores.length : 'N/A',
        data: stores
      });
      
      if (!Array.isArray(stores)) {
        console.error(`❌ Expected array, got:`, typeof stores, stores);
        throw new Error(`Invalid response format: expected array, got ${typeof stores}`);
      }

      if (stores.length === 0) {
        console.warn(`⚠️ No stores found in API response`);
        throw new Error('No stores found in Tank API');
      }
      
      const processedStores = stores.map((store, index) => {
        console.log(`🏪 Processing store ${index + 1}:`, store);
        return {
          store_name: store.store_name || store.name || `Store ${index + 1}`,
          tank_count: store.tank_count || store.tanks?.length || 0,
          alerts: store.alerts || 0,
          last_updated: store.last_updated || new Date().toISOString()
        };
      });
      
      console.log(`✅ Store overview processed: ${processedStores.length} stores`);
      return processedStores;
      
    } catch (error) {
      console.error('❌ Store overview failed:', error);
      throw new Error(`Failed to get store overview: ${error.message}`);
    }
  }

  // Get store data with enhanced debugging
  static async getStoreData(storeName: string, days: number = 5): Promise<any> {
    const storeUrl = `${API_BASE_URL}/dashboard/stores/${encodeURIComponent(storeName)}?days=${days}`;
    console.log(`🔍 Getting store data: ${storeUrl}`);
    
    try {
      const response = await this.fetchWithRetry(storeUrl);
      
      // Validate content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error(`❌ Invalid content type for ${storeName}. Expected JSON, got: ${contentType}`);
        console.error(`Response text:`, responseText.substring(0, 500));
        throw new Error(`Invalid response format for ${storeName}: expected JSON, got ${contentType}`);
      }
      
      const storeData = await response.json();
      
      console.log(`🏪 Raw store data for ${storeName}:`, {
        hasStoreName: !!storeData.store_name,
        hasTanks: !!storeData.tanks,
        tankCount: Array.isArray(storeData.tanks) ? storeData.tanks.length : 'N/A',
        data: storeData
      });
      
      // Validate and fix response
      if (!storeData || typeof storeData !== 'object') {
        throw new Error(`Invalid store data format for ${storeName}`);
      }

      if (!storeData.store_name) {
        storeData.store_name = storeName;
        console.log(`🔧 Fixed missing store_name for ${storeName}`);
      }

      if (!Array.isArray(storeData.tanks)) {
        console.error(`❌ Invalid tanks data for ${storeName}:`, storeData.tanks);
        throw new Error(`No tank data found for store ${storeName}`);
      }

      console.log(`✅ Store data validated for ${storeName}: ${storeData.tanks.length} tanks`);
      return storeData;
      
    } catch (error) {
      console.error(`❌ Store data failed for ${storeName}:`, error);
      throw new Error(`Failed to get data for ${storeName}: ${error.message}`);
    }
  }

  // Get all stores data with comprehensive error handling
  static async getAllStoresData(days: number = 5): Promise<any[]> {
    console.log(`🚀 Starting complete data fetch for all stores (${days} days)`);
    
    try {
      // Step 1: Get store overview
      console.log(`📋 Step 1: Getting store overview...`);
      const storeOverview = await this.getStoreOverview();
      
      console.log(`📊 Store overview result:`, {
        count: storeOverview.length,
        stores: storeOverview.map(s => s.store_name)
      });
      
      // Step 2: Get detailed data for each store
      console.log(`📋 Step 2: Getting detailed data for ${storeOverview.length} stores...`);
      
      const storeDataPromises = storeOverview.map(async (store, index) => {
        try {
          console.log(`🔍 Fetching detailed data for store ${index + 1}/${storeOverview.length}: ${store.store_name}`);
          const storeData = await this.getStoreData(store.store_name, days);
          
          return {
            ...storeData,
            store_name: store.store_name,
            last_updated: new Date().toISOString()
          };
        } catch (error) {
          console.error(`❌ Failed to get detailed data for ${store.store_name}:`, error);
          throw new Error(`Failed to load ${store.store_name}: ${error.message}`);
        }
      });
      
      console.log(`⏳ Waiting for all ${storeDataPromises.length} store data requests...`);
      const allStoresData = await Promise.all(storeDataPromises);
      console.log(`✅ All store data requests completed`);
      
      // Step 3: Validate all data
      console.log(`📋 Step 3: Validating all store data...`);
      const validStores = allStoresData.filter((store, index) => {
        const isValid = store && 
          store.store_name && 
          Array.isArray(store.tanks) &&
          store.tanks.length > 0;
          
        if (!isValid) {
          console.warn(`⚠️ Invalid store data at index ${index}:`, store);
        } else {
          console.log(`✅ Valid store data: ${store.store_name} (${store.tanks.length} tanks)`);
        }
        
        return isValid;
      });
      
      if (validStores.length === 0) {
        throw new Error('No valid store data received from Tank API');
      }
      
      console.log(`✅ All stores data complete:`, {
        totalStores: validStores.length,
        totalTanks: validStores.reduce((sum, store) => sum + store.tanks.length, 0),
        stores: validStores.map(s => ({ name: s.store_name, tanks: s.tanks.length }))
      });
      
      return validStores;
      
    } catch (error) {
      console.error('❌ Complete data fetch failed:', error);
      throw new Error(`Tank API system failure: ${error.message}`);
    }
  }

  // Get connection status with more details
  static getConnectionStatus(): { 
    isConnected: boolean; 
    isServerDown: boolean; 
    lastCheck: number; 
    connectionAttempts: number;
    lastSuccessfulConnection: number;
    timeSinceLastSuccess: number;
    apiEndpoint: string;
  } {
    return {
      isConnected: !this.isServerDown,
      isServerDown: this.isServerDown,
      lastCheck: this.lastServerCheck,
      connectionAttempts: this.connectionAttempts,
      lastSuccessfulConnection: this.lastSuccessfulConnection,
      timeSinceLastSuccess: this.lastSuccessfulConnection ? Date.now() - this.lastSuccessfulConnection : 0,
      apiEndpoint: API_BASE_URL
    };
  }

  // Reset connection state
  static resetConnectionState(): void {
    this.retryCount = 0;
    this.isServerDown = false;
    this.lastServerCheck = 0;
    this.connectionAttempts = 0;
    console.log('🔄 Production API connection state reset');
  }
}