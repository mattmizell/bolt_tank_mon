import { useState, useEffect, useCallback, useRef } from 'react';
import { Store, Tank, TankLog } from '../types';
import { ApiService } from '../services/api';
import { RunRateCache } from '../services/runRateCache';
import { 
  createTankProfile, 
  calculateRunRate, 
  calculateHoursTo10Inches, 
  getTankStatus, 
  predictDepletionTime,
  getTankCapacityPercentage
} from '../services/tankProfile';
import { ConfigService } from '../services/configService';

// Enhanced cache for processed store data
const storeDataCache = new Map<string, { data: Store; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for production
const FAST_LOAD_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes for fast load data

// Fast processing for initial load - minimal data processing
const processStoreDataFast = async (rawStore: any): Promise<Store> => {
  // Add version to cache key to invalidate old cached data after fixes
  const fastCacheKey = `fast-v2-${rawStore.store_name}-${rawStore.last_updated || Date.now()}`;
  
  // Check fast cache first
  if (storeDataCache.has(fastCacheKey)) {
    const cached = storeDataCache.get(fastCacheKey)!;
    if (Date.now() - cached.timestamp < FAST_LOAD_CACHE_DURATION) {
      return cached.data;
    }
  }

  // Process tanks with minimal computation for fast display
  console.log('🚀🔍 MASSIVE DEBUG: Processing', rawStore.tanks.length, 'tanks for store', rawStore.store_name);
  const fastTanks = rawStore.tanks.map((rawTank: any, index: number) => {
    console.log(`🔍 DEBUG Tank ${index + 1}/${rawStore.tanks.length} ===================`);
    console.log(`🔍 DEBUG rawTank[${index}] keys:`, Object.keys(rawTank));
    console.log(`🔍 DEBUG rawTank[${index}] full object:`, JSON.stringify(rawTank, null, 2));
    
    // NEW SERVER FORMAT: latest_reading instead of latest_log
    const latestReading = rawTank.latest_reading;
    console.log(`🔍 DEBUG latestReading for tank ${rawTank.tank_id}:`, JSON.stringify(latestReading, null, 2));
    
    const latestLog = latestReading ? {
      id: 0,
      store_name: rawStore.store_name,
      tank_id: rawTank.tank_id,
      product: rawTank.tank_name,
      volume: latestReading.volume,
      tc_volume: latestReading.volume,
      ullage: latestReading.ullage,
      height: latestReading.height,
      water: latestReading.water,
      temp: latestReading.temp,
      timestamp: latestReading.timestamp,
    } : undefined;
    
    // REMOVED ALL FALLBACK VALUES - NO DEFAULTS ALLOWED
    const analytics = rawTank.analytics;
    console.log(`🔍 DEBUG analytics for tank ${rawTank.tank_id}:`, JSON.stringify(analytics, null, 2));
    
    if (!analytics) {
      console.error(`❌ CRITICAL ERROR: No analytics data for tank ${rawTank.tank_id}`);
      throw new Error(`No analytics data for tank ${rawTank.tank_id}`);
    }
    
    let runRate = analytics.run_rate;
    let hoursTo10 = analytics.hours_to_critical;
    let status: 'normal' | 'warning' | 'critical' = rawTank.current_status;
    
    console.log(`🔍 DEBUG EXTRACTED VALUES for tank ${rawTank.tank_id}: runRate=${runRate}, hoursTo10=${hoursTo10}, status=${status}`);
    
    if (runRate === undefined || runRate === null) {
      console.error(`❌ CRITICAL ERROR: No run_rate for tank ${rawTank.tank_id}`);
      throw new Error(`No run_rate for tank ${rawTank.tank_id}`);
    }
    
    if (hoursTo10 === undefined || hoursTo10 === null) {
      console.error(`❌ CRITICAL ERROR: No hours_to_critical for tank ${rawTank.tank_id}`);
      throw new Error(`No hours_to_critical for tank ${rawTank.tank_id}`);
    }
    
    if (!status) {
      console.error(`❌ CRITICAL ERROR: No current_status for tank ${rawTank.tank_id}`);
      throw new Error(`No current_status for tank ${rawTank.tank_id}`);
    }
    
    // REMOVED FALLBACK - NO DEFAULT PROFILE CREATION
    const serverConfig = rawTank.configuration;
    console.log(`🔍 DEBUG serverConfig for tank ${rawTank.tank_id}:`, JSON.stringify(serverConfig, null, 2));
    
    if (!serverConfig) {
      console.error(`❌ CRITICAL ERROR: No configuration data for tank ${rawTank.tank_id}`);
      throw new Error(`No configuration for tank ${rawTank.tank_id}`);
    }
    
    const profile = {
      store_name: rawStore.store_name,
      tank_id: rawTank.tank_id,
      tank_name: rawTank.tank_name,
      max_capacity_gallons: serverConfig.max_capacity_gallons,
      critical_height_inches: serverConfig.critical_height_inches,
      warning_height_inches: serverConfig.warning_height_inches,
    };
    
    // Calculate capacity percentage using server configuration ONLY
    let capacityPercentage = 0;
    if (latestReading && serverConfig.max_capacity_gallons) {
      capacityPercentage = (latestReading.volume / serverConfig.max_capacity_gallons) * 100;
      console.log(`🔍 DEBUG capacity: ${latestReading.volume} / ${serverConfig.max_capacity_gallons} * 100 = ${capacityPercentage}%`);
    } else {
      console.error(`❌ CRITICAL ERROR: Cannot calculate capacity percentage for tank ${rawTank.tank_id}`);
      throw new Error(`Cannot calculate capacity percentage for tank ${rawTank.tank_id}`);
    }

    const tankData = {
      tank_id: rawTank.tank_id,
      tank_name: rawTank.tank_name,
      product: rawTank.tank_name,
      latest_log: latestLog,
      logs: rawTank.historical_data,
      run_rate: analytics.run_rate,
      hours_to_10_inches: analytics.hours_to_critical,
      status: status,
      profile: profile,
      configuration: serverConfig,
      analytics: analytics,
      capacity_percentage: Math.round(capacityPercentage),
      predicted_time: analytics.predicted_empty,
    };
    
    console.log(`🔍 DEBUG FINAL tankData for tank ${rawTank.tank_id}:`, JSON.stringify(tankData, null, 2));
    
    return tankData;
  });

  const fastStoreData: Store = {
    store_name: rawStore.store_name,
    tanks: fastTanks,
    last_updated: new Date().toISOString(),
  };

  // Cache fast data
  storeDataCache.set(fastCacheKey, { data: fastStoreData, timestamp: Date.now() });
  
  return fastStoreData;
};

// Full processing for background updates
const processStoreDataFull = async (rawStore: any, useCache: boolean = true): Promise<Store> => {
  // Add version to cache key to invalidate old cached data after fixes
  const cacheKey = `full-v2-${rawStore.store_name}-${rawStore.last_updated || Date.now()}`;
  
  // Check cache first
  if (useCache && storeDataCache.has(cacheKey)) {
    const cached = storeDataCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }

  // Process tanks with full computation
  const tankPromises = rawStore.tanks.map(async (rawTank: any) => {
    try {
      // Use server analytics and configuration (same as fast processing)
      const analytics = rawTank.analytics || {};
      const serverConfig = rawTank.configuration;
      
      // REMOVED FALLBACK - NO PROFILE CREATION
      const serverConfig = rawTank.configuration;
      console.log(`🔍 DEBUG serverConfig for tank ${rawTank.tank_id}:`, JSON.stringify(serverConfig, null, 2));
      
      if (!serverConfig) {
        console.error(`❌ CRITICAL ERROR: No configuration data for tank ${rawTank.tank_id}`);
        throw new Error(`No configuration for tank ${rawTank.tank_id}`);
      }
      
      const profile = {
        store_name: rawStore.store_name,
        tank_id: rawTank.tank_id,
        tank_name: rawTank.tank_name,
        max_capacity_gallons: serverConfig.max_capacity_gallons,
        critical_height_inches: serverConfig.critical_height_inches,
        warning_height_inches: serverConfig.warning_height_inches,
      };
      
      // Get historical data for run rate calculation (only if not already processed)
      let logs: any[] = [];
      console.log(`🔍 DEBUG analytics for tank ${rawTank.tank_id}:`, JSON.stringify(analytics, null, 2));
      
      if (!analytics) {
        console.error(`❌ CRITICAL ERROR: No analytics data for tank ${rawTank.tank_id}`);
        throw new Error(`No analytics data for tank ${rawTank.tank_id}`);
      }
      
      let runRate = analytics.run_rate;
      let hoursTo10 = analytics.hours_to_critical;
      let status: 'normal' | 'warning' | 'critical' = rawTank.current_status;
      
      console.log(`🔍 DEBUG EXTRACTED VALUES for tank ${rawTank.tank_id}:`);
      console.log(`🔍   runRate:`, runRate);
      console.log(`🔍   hoursTo10:`, hoursTo10);
      console.log(`🔍   status:`, status);
      
      if (runRate === undefined || runRate === null) {
        console.error(`❌ CRITICAL ERROR: No run_rate in analytics for tank ${rawTank.tank_id}`);
        throw new Error(`No run_rate for tank ${rawTank.tank_id}`);
      }
      
      if (hoursTo10 === undefined || hoursTo10 === null) {
        console.error(`❌ CRITICAL ERROR: No hours_to_critical in analytics for tank ${rawTank.tank_id}`);
        throw new Error(`No hours_to_critical for tank ${rawTank.tank_id}`);
      }
      
      if (!status) {
        console.error(`❌ CRITICAL ERROR: No current_status for tank ${rawTank.tank_id}`);
        throw new Error(`No current_status for tank ${rawTank.tank_id}`);
      }
      let predictedTime: string | undefined = analytics.predicted_empty;
      let capacityPercentage = 0;

      // Calculate capacity percentage using server configuration ONLY
      const latestReading = rawTank.latest_reading;
      console.log(`🔍 DEBUG latestReading for tank ${rawTank.tank_id}:`, JSON.stringify(latestReading, null, 2));
      
      if (latestReading && serverConfig.max_capacity_gallons) {
        capacityPercentage = (latestReading.volume / serverConfig.max_capacity_gallons) * 100;
        console.log(`🔍 DEBUG capacity calculation: ${latestReading.volume} / ${serverConfig.max_capacity_gallons} * 100 = ${capacityPercentage}%`);
      } else {
        console.error(`❌ CRITICAL ERROR: Cannot calculate capacity percentage`);
        console.error(`❌   latestReading:`, latestReading);
        console.error(`❌   serverConfig.max_capacity_gallons:`, serverConfig.max_capacity_gallons);
        throw new Error(`Cannot calculate capacity percentage for tank ${rawTank.tank_id}`);
      }

      // If server analytics are available, use them directly (skip old calculation logic)
      if (analytics.run_rate !== undefined && analytics.hours_to_critical !== undefined) {
        console.log(`📋 Using server analytics for ${rawStore.store_name} Tank ${rawTank.tank_id}`);
      } else {
        // NO FALLBACK CALCULATION - SERVER MUST PROVIDE ANALYTICS
        console.error(`❌ CRITICAL ERROR: Server analytics missing for ${rawStore.store_name} Tank ${rawTank.tank_id}`);
        console.error(`❌   analytics object:`, analytics);
        console.error(`❌   analytics.run_rate:`, analytics.run_rate);
        console.error(`❌   analytics.hours_to_critical:`, analytics.hours_to_critical);
        throw new Error(`Server analytics missing for ${rawStore.store_name} Tank ${rawTank.tank_id}`);
      }

      return {
        tank_id: rawTank.tank_id,
        tank_name: rawTank.tank_name, // Use server tank name directly
        product: rawTank.tank_name, // Keep for backward compatibility but use tank_name
        latest_log: rawTank.latest_log ? {
          id: rawTank.latest_log.id || 0,
          store_name: rawTank.latest_log.store_name || rawStore.store_name,
          tank_id: rawTank.latest_log.tank_id || rawTank.tank_id,
          product: rawTank.latest_log.product || profile.tank_name,
          volume: Number(rawTank.latest_log.volume) || 0,
          tc_volume: Number(rawTank.latest_log.tc_volume) || 0,
          ullage: Number(rawTank.latest_log.ullage) || 0,
          height: Number(rawTank.latest_log.height) || 0,
          water: Number(rawTank.latest_log.water) || 0,
          temp: Number(rawTank.latest_log.temp) || 0,
          timestamp: rawTank.latest_log.timestamp || new Date().toISOString(),
        } : undefined,
        logs: logs,
        run_rate: runRate,
        hours_to_10_inches: hoursTo10,
        predicted_time: predictedTime,
        status: status,
        profile: profile,
        capacity_percentage: capacityPercentage,
      };
    } catch (error) {
      console.error(`Error processing tank ${rawTank.tank_id} for store ${rawStore.store_name}:`, error);
      
      return {
        tank_id: rawTank.tank_id,
        tank_name: rawTank.tank_name || `Tank ${rawTank.tank_id}`,
        product: rawTank.latest_log?.product || 'Unknown',
        latest_log: rawTank.latest_log,
        logs: [],
        run_rate: 1.0, // Default gallons per hour
        hours_to_10_inches: 0,
        status: 'normal' as const,
        profile: {
          store_name: rawStore.store_name,
          tank_id: rawTank.tank_id,
          tank_name: rawTank.tank_name || `Tank ${rawTank.tank_id}`,
          max_capacity_gallons: 10000,
          critical_height_inches: 10,
          warning_height_inches: 20,
        },
        capacity_percentage: 0,
      };
    }
  });

  const processedTanks = await Promise.all(tankPromises);

  const storeData: Store = {
    store_name: rawStore.store_name,
    tanks: processedTanks,
    last_updated: new Date().toISOString(),
  };

  // Cache the processed data
  if (useCache) {
    storeDataCache.set(cacheKey, { data: storeData, timestamp: Date.now() });
  }

  return storeData;
};

// Auto-configure new stores and tanks
const autoConfigureNewStore = (storeName: string, tanks: any[]) => {
  console.log(`🆕 Auto-configuring new store: ${storeName} with ${tanks.length} tanks`);
  
  const existingHours = ConfigService.getStoreHoursForStore(storeName);
  if (!existingHours) {
    const speediCheckHours = ConfigService.getStoreHoursForStore('Speedi Check');
    const defaultHours = speediCheckHours || {
      store_name: 'Speedi Check',
      open_hour: 5,
      close_hour: 23,
      timezone: 'America/Chicago',
      admin_name: 'Store Manager',
      admin_phone: '+1234567890',
      admin_email: 'manager@speedicheck.betterdayenergy.com',
      alerts_enabled: true,
    };
    
    ConfigService.updateStoreHours(
      storeName, 
      defaultHours.open_hour, 
      defaultHours.close_hour, 
      defaultHours.timezone,
      'Store Manager',
      '+1234567890',
      `manager@${storeName.toLowerCase().replace(/\s+/g, '')}.betterdayenergy.com`,
      true
    );
  }

  tanks.forEach((tank, index) => {
    const existingConfig = ConfigService.getTankConfiguration(storeName, tank.tank_id);
    if (!existingConfig) {
      let tankName = `Tank ${tank.tank_id}`;
      let productType = 'Regular Unleaded';
      
      if (tank.latest_log?.product || tank.product) {
        const product = (tank.latest_log?.product || tank.product).toLowerCase();
        if (product.includes('unleaded') || product.includes('unl')) {
          if (product.includes('premium') || product.includes('prem')) {
            tankName = 'PREMIUM';
            productType = 'Premium Unleaded';
          } else {
            tankName = 'UNLEADED';
            productType = 'Regular Unleaded';
          }
        } else if (product.includes('diesel')) {
          tankName = 'DIESEL';
          productType = 'Diesel';
        } else if (product.includes('kerosene') || product.includes('k1')) {
          tankName = 'K1';
          productType = 'Kerosene';
        } else {
          tankName = (tank.latest_log?.product || tank.product).toUpperCase();
          productType = tank.latest_log?.product || tank.product;
        }
      } else {
        if (index === 0) {
          tankName = 'UNLEADED';
          productType = 'Regular Unleaded';
        } else if (index === 1) {
          tankName = 'PREMIUM';
          productType = 'Premium Unleaded';
        } else if (index === 2) {
          tankName = 'DIESEL';
          productType = 'Diesel';
        } else {
          tankName = `TANK ${tank.tank_id}`;
          productType = 'Regular Unleaded';
        }
      }

      const newTankConfig = {
        store_name: storeName,
        tank_id: tank.tank_id,
        tank_name: tankName,
        product_type: productType,
        critical_height_inches: 10,
        warning_height_inches: 20,
        alerts_enabled: true,
      };

      ConfigService.updateTankConfiguration(newTankConfig);
    }
  });
};

export const useApi = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiveData, setIsLiveData] = useState(false);
  const [newStoreDetected, setNewStoreDetected] = useState<string | null>(null);
  
  // Track background processing state
  const backgroundUpdateInProgress = useRef(false);
  const lastSuccessfulUpdate = useRef<number>(0);
  const fullDataProcessed = useRef(false);

  const fetchStores = useCallback(async (isBackgroundUpdate = false, fastLoad = false) => {
    try {
      // Prevent multiple background updates
      if (isBackgroundUpdate && backgroundUpdateInProgress.current) {
        return;
      }

      if (isBackgroundUpdate) {
        backgroundUpdateInProgress.current = true;
      } else if (!fastLoad) {
        setLoading(true);
        setError(null);
        
        // Clear old cache entries on initial load only
        const removedCount = RunRateCache.clearOldCache();
        if (removedCount > 0) {
          console.log(`🧹 Cleared ${removedCount} old cache entries`);
        }
      }
      
      // Initialize API service to detect data source
      await ApiService.initialize();
      
      // Fetch live data from server
      const rawStores = await ApiService.getAllStoresData();
      
      if (!rawStores || rawStores.length === 0) {
        throw new Error('No stores data received from database');
      }

      // Check for new stores (only for initial loads)
      if (!isBackgroundUpdate && !fastLoad) {
        const existingStoreNames = ConfigService.getStoreHours().map(h => h.store_name);
        const newStores = rawStores.filter(store => !existingStoreNames.includes(store.store_name));
        
        for (const newStore of newStores) {
          autoConfigureNewStore(newStore.store_name, newStore.tanks);
          setNewStoreDetected(newStore.store_name);
          setTimeout(() => setNewStoreDetected(null), 5000);
        }
      }

      // Choose processing strategy based on load type
      let processedStores: Store[];
      
      if (fastLoad) {
        // Fast processing for initial display
        console.log('🚀 Fast load: Processing stores with minimal computation...');
        const storePromises = rawStores.map(rawStore => processStoreDataFast(rawStore));
        processedStores = await Promise.all(storePromises);
        console.log('✅ Fast load complete - UI ready for interaction');
        
        // Schedule full processing in background
        setTimeout(() => {
          if (!fullDataProcessed.current) {
            console.log('🔄 Starting background full data processing...');
            fetchStores(true, false); // Background full processing
          }
        }, 100);
        
      } else {
        // Full processing
        const storePromises = rawStores.map(rawStore => processStoreDataFull(rawStore, true));
        processedStores = await Promise.all(storePromises);
        fullDataProcessed.current = true;
        
        if (!isBackgroundUpdate) {
          console.log('✅ Full load complete - All calculations finished');
        }
      }
      
      // Update state
      setStores(prevStores => {
        if (isBackgroundUpdate) {
          const hasChanges = JSON.stringify(prevStores) !== JSON.stringify(processedStores);
          if (!hasChanges) {
            return prevStores;
          }
        }
        return processedStores;
      });
      
      setIsLiveData(true);
      lastSuccessfulUpdate.current = Date.now();
      
      // Debug analysis only for full loads
      if (!isBackgroundUpdate && !fastLoad) {
        const cacheStats = ApiService.getCacheStats();
        console.log('✅ Connected to live database');
        console.log(`📊 Loaded ${processedStores.length} stores with ${processedStores.reduce((sum, store) => sum + store.tanks.length, 0)} tanks`);
        console.log(`💾 Data source: ${cacheStats.dataSource}`);
        
        // Log calculation summary
        const totalTanks = processedStores.reduce((sum, store) => sum + store.tanks.length, 0);
        const tanksWithRunRate = processedStores.reduce((sum, store) => 
          sum + store.tanks.filter(tank => tank.run_rate && tank.run_rate > 0).length, 0);
        const tanksWithHours = processedStores.reduce((sum, store) => 
          sum + store.tanks.filter(tank => tank.hours_to_10_inches && tank.hours_to_10_inches > 0).length, 0);
        
        console.log(`📈 Calculation Results: ${tanksWithRunRate}/${totalTanks} tanks have run rates, ${tanksWithHours}/${totalTanks} have hours to 10"`);
        
        // Log cache performance
        const finalCacheStats = RunRateCache.getCacheStats();
        console.log(`💾 Cache Performance: ${finalCacheStats.validEntries} entries cached, reducing calculation load`);
      }
        
    } catch (apiError) {
      console.error('❌ Database connection failed:', apiError);
      
      if (!isBackgroundUpdate) {
        setError(`Database connection failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
        setStores([]);
        setIsLiveData(false);
      } else {
        console.warn('⚠️ Background update failed, keeping existing data:', apiError);
        
        const timeSinceLastSuccess = Date.now() - lastSuccessfulUpdate.current;
        if (timeSinceLastSuccess > 10 * 60 * 1000) {
          setError('Background updates failing - data may be stale');
        }
      }
    } finally {
      if (!isBackgroundUpdate && !fastLoad) {
        setLoading(false);
      } else if (isBackgroundUpdate) {
        backgroundUpdateInProgress.current = false;
      }
    }
  }, []);

  const fetchStoreData = useCallback(async (storeName: string): Promise<Store | null> => {
    try {
      if (isLiveData) {
        const rawStore = await ApiService.getStoreData(storeName);
        if (rawStore) {
          return await processStoreDataFull(rawStore, true);
        }
        return null;
      } else {
        return null;
      }
    } catch (err) {
      console.error('Error fetching store data:', err);
      throw err;
    }
  }, [isLiveData]);

  const refreshData = useCallback(async () => {
    // Clear cache on manual refresh
    storeDataCache.clear();
    RunRateCache.clearAllCache();
    ApiService.clearCache();
    fullDataProcessed.current = false;
    console.log('🗑️ Cleared all caches for manual refresh');
    await fetchStores(false, false); // Full refresh
  }, [fetchStores]);

  // Initial load with fast strategy, then background updates
  useEffect(() => {
    // Start with fast load for immediate UI
    fetchStores(false, true);
    
    // Set up background updates every 3 minutes
    const interval = setInterval(() => {
      if (isLiveData && !backgroundUpdateInProgress.current) {
        fetchStores(true, false); // Background full update
      }
    }, 180000); // 3 minutes
    
    return () => clearInterval(interval);
  }, [fetchStores, isLiveData]);

  return {
    stores,
    loading,
    error,
    isLiveData,
    refreshData,
    fetchStoreData,
    newStoreDetected,
  };
};