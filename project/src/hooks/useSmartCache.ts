import { useState, useEffect, useCallback, useRef } from 'react';
import { Store } from '../types';
import { ApiService } from '../services/api';
import { SmartCache } from '../services/smartCache';
import { calculateSimpleTankMetrics } from '../services/tankAnalytics';
import { ConfigService } from '../services/configService';

export const useSmartCache = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiveData, setIsLiveData] = useState(false);
  const [newStoreDetected, setNewStoreDetected] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState(SmartCache.getCacheInfo());

  // Filter stores based on visibility settings
  const filterVisibleStores = useCallback((allStores: Store[]): Store[] => {
    const visibleStoreNames = ConfigService.getVisibleStores();
    console.log('🔍 Filtering stores by visibility:', { 
      allStores: allStores.map(s => s.store_name),
      visibleStoreNames 
    });
    
    if (visibleStoreNames.length === 0) {
      // If no visibility config exists, show all stores (backward compatibility)
      return allStores;
    }
    
    const filtered = allStores.filter(store => visibleStoreNames.includes(store.store_name));
    console.log('✅ Visible stores after filtering:', filtered.map(s => s.store_name));
    return filtered;
  }, []);
  
  const refreshInProgress = useRef(false);
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  // SIMPLIFIED: Process raw API data into Store objects (NO historical data)
  const processRawApiData = useCallback(async (rawStores: any[]): Promise<Store[]> => {
    console.log('🚀 SIMPLIFIED: Processing raw API data (NO historical data fetching)');
    const processedStores: Store[] = [];

    for (const rawStore of rawStores) {
      console.log(`📊 Processing store: ${rawStore.store_name} with ${rawStore.tanks.length} tanks`);
      const processedTanks = [];

      for (const rawTank of rawStore.tanks) {
        console.log(`🔍 Processing tank ${rawTank.tank_id} in ${rawStore.store_name}`);
        
        // Validate server data exists
        if (!rawTank.analytics) {
          console.error(`❌ No analytics data from server for ${rawStore.store_name} Tank ${rawTank.tank_id}`);
          throw new Error(`Missing server analytics for ${rawStore.store_name} Tank ${rawTank.tank_id}`);
        }
        
        if (!rawTank.configuration) {
          console.error(`❌ No configuration data from server for ${rawStore.store_name} Tank ${rawTank.tank_id}`);
          throw new Error(`Missing server configuration for ${rawStore.store_name} Tank ${rawTank.tank_id}`);
        }
        
        const analytics = rawTank.analytics;
        const serverConfig = rawTank.configuration;
        const latestReading = rawTank.latest_reading;
        
        console.log(`✅ Using server analytics: run_rate=${analytics.run_rate}, hours_to_critical=${analytics.hours_to_critical}`);
        console.log(`✅ Using server config: max_capacity=${serverConfig.max_capacity_gallons}`);
        
        const currentVolume = Number(latestReading?.volume) || 0;
        const capacityPercentage = (currentVolume / serverConfig.max_capacity_gallons) * 100;
        
        processedTanks.push({
          tank_id: rawTank.tank_id,
          tank_name: rawTank.tank_name || `Tank ${rawTank.tank_id}`,
          product: rawTank.product || 'Unknown',
          latest_log: latestReading ? {
            id: 0,
            store_name: rawStore.store_name,
            tank_id: rawTank.tank_id,
            product: rawTank.product || 'Unknown',
            volume: Number(latestReading.volume) || 0,
            tc_volume: Number(latestReading.volume) || 0,
            ullage: Number(latestReading.ullage) || 0,
            height: Number(latestReading.height) || 0,
            water: Number(latestReading.water) || 0,
            temp: Number(latestReading.temp) || 0,
            timestamp: latestReading.timestamp || new Date().toISOString(),
          } : undefined,
          logs: [], // Charts load their own data
          run_rate: analytics.run_rate,
          hours_to_10_inches: analytics.hours_to_critical,
          predicted_time: analytics.predicted_empty,
          status: rawTank.current_status,
          capacity_percentage: capacityPercentage,
          profile: {
            store_name: rawStore.store_name,
            tank_id: rawTank.tank_id,
            tank_name: serverConfig.tank_name,
            max_capacity_gallons: serverConfig.max_capacity_gallons,
            critical_height_inches: serverConfig.critical_height_inches,
            warning_height_inches: serverConfig.warning_height_inches,
          },
          configuration: serverConfig,
          analytics: analytics,
        });
      }

      processedStores.push({
        store_name: rawStore.store_name,
        tanks: processedTanks,
        last_updated: new Date().toISOString(),
      });
    }

    console.log(`✅ SIMPLIFIED: Processed ${processedStores.length} stores (NO historical data)`);
    return processedStores;
  }, []);

  // Smart load: combine cached data with fresh server data
  const smartLoad = useCallback(async () => {
    console.log('🚀 smartLoad() FUNCTION STARTING...');
    try {
      console.log('🚀 Clearing any previous errors');
      setError(null);
      
      // Step 1: Load cached data instantly (if available)
      const cachedStores = SmartCache.getCachedStores();
      if (cachedStores.length > 0) {
        console.log(`⚡ SIMPLIFIED: Loading ${cachedStores.length} stores from cache (endpoint data only)`);
        const storeObjects = SmartCache.convertToStores(cachedStores);
        const visibleStores = filterVisibleStores(storeObjects);
        setStores(visibleStores);
        setIsLiveData(true);
        console.log(`📊 SIMPLIFIED: Instant load complete - charts will fetch their own data`);
      }

      // Step 2: Check what needs updating from server
      const staleStoreNames = SmartCache.getStoresNeedingUpdate(cachedStores);
      
      if (staleStoreNames.length > 0 || cachedStores.length === 0) {
        console.log(`🚀 SIMPLIFIED: Fetching fresh endpoint data (NO historical logs)`);
        
        // Initialize API service
        await ApiService.initialize();
        
        // Fetch fresh data from server endpoints only
        const freshRawStores = await ApiService.getAllStoresData();
        
        // Process raw data (no historical data)
        const processedStores = await processRawApiData(freshRawStores);
        
        // Convert to cacheable format (no historical logs)
        const cacheableStores = processedStores.map(store => ({
          store_name: store.store_name,
          tanks: store.tanks.map(tank => ({
            tank_id: tank.tank_id,
            tank_name: tank.tank_name,
            product: tank.product,
            latest_log: tank.latest_log,
            logs: [], // No historical logs in cache
            run_rate: tank.run_rate,
            hours_to_10_inches: tank.hours_to_10_inches,
            status: tank.status,
            capacity_percentage: tank.capacity_percentage,
            predicted_time: tank.predicted_time,
            last_reading_timestamp: tank.latest_log?.timestamp,
          })),
          last_updated: store.last_updated || new Date().toISOString(),
          cache_timestamp: Date.now(),
        }));
        
        // Save simplified cache
        SmartCache.saveToCache(cacheableStores);
        
        // Update UI with filtered stores
        const visibleStores = filterVisibleStores(processedStores);
        setStores(visibleStores);
        setIsLiveData(true);
        
        // Auto-configure new stores
        const existingStoreNames = ConfigService.getStoreHours().map(h => h.store_name);
        const newStores = processedStores.filter(store => !existingStoreNames.includes(store.store_name));
        
        for (const newStore of newStores) {
          ConfigService.autoConfigureNewStore(newStore.store_name, newStore.tanks.length, newStore.tanks);
          setNewStoreDetected(newStore.store_name);
          setTimeout(() => setNewStoreDetected(null), 5000);
        }
        
        console.log(`✅ SIMPLIFIED: Load complete (${processedStores.length} stores, NO historical data)`);
      } else {
        console.log('✅ All cached data is fresh - no server fetch needed');
      }
      
      setCacheInfo(SmartCache.getCacheInfo());
      
    } catch (apiError) {
      console.error('❌ Smart load failed:', apiError);
      setError(`Failed to load data: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
      
      // If we have cached data, keep using it
      if (stores.length === 0) {
        setStores([]);
        setIsLiveData(false);
      }
    }
  }, [processRawApiData, stores.length]);

  // Refresh data (clear cache and fetch fresh)
  const refreshData = useCallback(async () => {
    console.log('🔄 SIMPLIFIED: Manual refresh - clearing cache and fetching fresh endpoint data');
    SmartCache.clearCache();
    setCacheInfo(SmartCache.getCacheInfo());
    setStores([]); // Clear current data to show loading
    await smartLoad();
  }, [smartLoad]);

  // Background refresh every 30 seconds (simplified)
  const startBackgroundRefresh = useCallback(() => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }

    refreshInterval.current = setInterval(async () => {
      if (refreshInProgress.current) return;
      
      refreshInProgress.current = true;
      try {
        console.log('⏰ SIMPLIFIED: Background refresh (30s interval) - endpoint data only');
        
        await ApiService.initialize();
        const freshRawStores = await ApiService.getAllStoresData();
        
        // Process fresh data (no historical)
        const processedStores = await processRawApiData(freshRawStores);
        
        // Update cache and UI
        const cacheableStores = processedStores.map(store => ({
          store_name: store.store_name,
          tanks: store.tanks.map(tank => ({
            tank_id: tank.tank_id,
            tank_name: tank.tank_name,
            product: tank.product,
            latest_log: tank.latest_log,
            logs: [], // No historical logs
            run_rate: tank.run_rate,
            hours_to_10_inches: tank.hours_to_10_inches,
            status: tank.status,
            capacity_percentage: tank.capacity_percentage,
            predicted_time: tank.predicted_time,
            last_reading_timestamp: tank.latest_log?.timestamp,
          })),
          last_updated: store.last_updated || new Date().toISOString(),
          cache_timestamp: Date.now(),
        }));
        
        SmartCache.saveToCache(cacheableStores);
        const visibleStores = filterVisibleStores(processedStores);
        setStores(visibleStores);
        setCacheInfo(SmartCache.getCacheInfo());
        
        console.log('✅ SIMPLIFIED: Background refresh complete');
      } catch (error) {
        console.warn('⚠️ Background refresh failed:', error);
      } finally {
        refreshInProgress.current = false;
      }
    }, 30000); // 30 seconds

    console.log('🔄 SIMPLIFIED: Background refresh started (every 30 seconds)');
  }, [processRawApiData]);

  // Initial load
  useEffect(() => {
    console.log('🚀 useSmartCache useEffect TRIGGERED - starting initial load');
    console.log('🔥 FORCE CLEARING CACHE TO FIX DATA ISSUE');
    SmartCache.clearCache();
    setCacheInfo(SmartCache.getCacheInfo());
    
    setLoading(true);
    console.log('🚀 Calling smartLoad()...');
    smartLoad()
      .then(() => {
        console.log('🚀 smartLoad() completed successfully');
      })
      .catch((error) => {
        console.error('❌ smartLoad() failed:', error);
      })
      .finally(() => {
        console.log('🚀 Setting loading to false');
        setLoading(false);
      });
  }, [smartLoad]);

  // Start background refresh after initial load
  useEffect(() => {
    if (!loading && stores.length > 0) {
      startBackgroundRefresh();
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [loading, stores.length, startBackgroundRefresh]);

  return {
    stores,
    loading,
    error,
    isLiveData,
    refreshData,
    newStoreDetected,
    cacheInfo,
    clearCache: () => {
      SmartCache.clearCache();
      setCacheInfo(SmartCache.getCacheInfo());
    }
  };
};