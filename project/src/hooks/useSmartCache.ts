import { useState, useEffect, useCallback, useRef } from 'react';
import { Store } from '../types';
import { ApiService } from '../services/api';
import { SmartCache } from '../services/smartCache';
import { calculateSimpleTankMetrics } from '../services/tankAnalytics';
import { ConfigService } from '../services/configService';

export const useSmartCache = () => {
  console.log('🚀 useSmartCache HOOK INITIALIZING...');
  
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiveData, setIsLiveData] = useState(false);
  const [newStoreDetected, setNewStoreDetected] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState(SmartCache.getCacheInfo());
  
  console.log('🚀 useSmartCache initial state:', {
    storesLength: stores.length,
    loading,
    error,
    isLiveData,
    cacheInfo
  });
  
  const refreshInProgress = useRef(false);
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Process raw API data into full Store objects with historical data for charts
  const processRawApiData = useCallback(async (rawStores: any[]): Promise<Store[]> => {
    console.log('🔄 Processing raw API data with full historical data for charts...');
    const processedStores: Store[] = [];

    for (const rawStore of rawStores) {
      console.log(`📊 Processing store: ${rawStore.store_name} with ${rawStore.tanks.length} tanks`);
      const processedTanks = [];

      for (const rawTank of rawStore.tanks) {
        try {
          console.log(`🔍 Processing tank ${rawTank.tank_id} in ${rawStore.store_name}`);
          console.log(`🔍 rawTank keys:`, Object.keys(rawTank));
          console.log(`🔍 rawTank.analytics:`, rawTank.analytics);
          console.log(`🔍 rawTank.configuration:`, rawTank.configuration);
          console.log(`🔍 rawTank.latest_reading:`, rawTank.latest_reading);
          
          // FIXED: Use server analytics and configuration data directly!
          if (!rawTank.analytics) {
            console.error(`❌ No analytics data from server for ${rawStore.store_name} Tank ${rawTank.tank_id}`);
            throw new Error(`Missing server analytics for ${rawStore.store_name} Tank ${rawTank.tank_id}`);
          }
          
          if (!rawTank.configuration) {
            console.error(`❌ No configuration data from server for ${rawStore.store_name} Tank ${rawTank.tank_id}`);
            throw new Error(`Missing server configuration for ${rawStore.store_name} Tank ${rawTank.tank_id}`);
          }
          
          const latestLog = rawTank.latest_log;
          const latestReading = rawTank.latest_reading;
          const analytics = rawTank.analytics;
          const serverConfig = rawTank.configuration;
          
          console.log(`🔍 Using server analytics: run_rate=${analytics.run_rate}, hours_to_critical=${analytics.hours_to_critical}`);
          console.log(`🔍 Using server config: max_capacity=${serverConfig.max_capacity_gallons}`);
          
          const currentHeight = Number(latestReading?.height || latestLog?.height) || 0;
          const currentVolume = Number(latestReading?.volume || latestLog?.tc_volume) || 0;
          const actualCapacity = serverConfig.max_capacity_gallons;
          
          // Get historical data for this tank (extended fetch for better calculations)
          let historicalLogs: any[] = [];
          try {
            // Get 4 weeks of data for proper historical analysis
            historicalLogs = await ApiService.getTankLogs(rawStore.store_name, rawTank.tank_id, 672); // 4 weeks = 28 days
            console.log(`📊 Retrieved ${historicalLogs.length} logs for analytics calculation (4 weeks)`);
          } catch (logError) {
            console.warn(`⚠️ Could not fetch historical logs for ${rawStore.store_name} Tank ${rawTank.tank_id}:`, logError);
            historicalLogs = [];
          }

          // FIXED: Use server analytics directly!
          console.log(`📊 Using server analytics for ${rawStore.store_name} Tank ${rawTank.tank_id}`);
          console.log(`✅ Server run_rate: ${analytics.run_rate} in/hr`);
          console.log(`✅ Server capacity: ${serverConfig.max_capacity_gallons} gal`);
          console.log(`✅ Current volume: ${currentVolume} gal`);
          
          const capacityPercentage = (currentVolume / actualCapacity) * 100;
          console.log(`✅ Calculated capacity percentage: ${capacityPercentage}%`);
          
          const metrics = {
            current_height_inches: currentHeight,
            current_volume_gallons: currentVolume,
            run_rate_inches_per_hour: analytics.run_rate,
            hours_to_10_inches: analytics.hours_to_critical,
            predicted_time_to_10in: analytics.predicted_empty,
            status: rawTank.current_status,
            capacity_percentage: capacityPercentage
          };
          
          console.log(`📊 Final metrics for tank ${rawTank.tank_id}:`, JSON.stringify(metrics, null, 2));

          processedTanks.push({
            tank_id: rawTank.tank_id,
            tank_name: rawTank.tank_name || `Tank ${rawTank.tank_id}`,
            product: rawTank.product || rawTank.latest_log?.product || 'Unknown',
            latest_log: rawTank.latest_log ? {
              id: rawTank.latest_log.id || 0,
              store_name: rawTank.latest_log.store_name || rawStore.store_name,
              tank_id: rawTank.latest_log.tank_id || rawTank.tank_id,
              product: rawTank.latest_log.product || 'Unknown',
              volume: Number(rawTank.latest_log.volume) || 0,
              tc_volume: Number(rawTank.latest_log.tc_volume) || 0,
              ullage: Number(rawTank.latest_log.ullage) || 0,
              height: Number(rawTank.latest_log.height) || 0,
              water: Number(rawTank.latest_log.water) || 0,
              temp: Number(rawTank.latest_log.temp) || 0,
              timestamp: rawTank.latest_log.timestamp || new Date().toISOString(),
            } : undefined,
            logs: [], // Charts will load their own data independently
            // Use simplified analytics results
            run_rate: metrics.run_rate_inches_per_hour,
            hours_to_10_inches: metrics.hours_to_10_inches,
            predicted_time: metrics.predicted_time_to_10in,
            status: metrics.status,
            capacity_percentage: metrics.capacity_percentage,
            // FIXED: Use server configuration data
            profile: {
              store_name: rawStore.store_name,
              tank_id: rawTank.tank_id,
              tank_name: serverConfig.tank_name,
              max_capacity_gallons: serverConfig.max_capacity_gallons,
              critical_height_inches: serverConfig.critical_height_inches,
              warning_height_inches: serverConfig.warning_height_inches,
            },
            // Add server configuration and analytics to tank object
            configuration: serverConfig,
            analytics: analytics,
          });
        } catch (error) {
          console.error(`❌ CRITICAL ERROR processing tank ${rawTank.tank_id} in ${rawStore.store_name}:`, error);
          console.error(`❌ Raw tank data that failed:`, JSON.stringify(rawTank, null, 2));
          // NO FALLBACK - LET ERROR BUBBLE UP
          throw new Error(`Tank processing failed for ${rawStore.store_name} Tank ${rawTank.tank_id}: ${error.message}`);
        }
      }

      processedStores.push({
        store_name: rawStore.store_name,
        tanks: processedTanks,
        last_updated: new Date().toISOString(),
      });
    }

    console.log(`✅ Processed ${processedStores.length} stores with full 10-day historical data for charts`);
    return processedStores;
  }, []);

  // Smart load: combine cached data with fresh server data
  const smartLoad = useCallback(async () => {
    console.log('🚀 smartLoad() FUNCTION STARTING...');
    try {
      console.log('🚀 Clearing any previous errors');
      setError(null);
      
      // Step 1: Load cached data instantly (if available) - DON'T process it, just convert it
      const cachedStores = SmartCache.getCachedStores();
      if (cachedStores.length > 0) {
        console.log(`⚡ Loading ${cachedStores.length} stores from cache with historical data...`);
        const storeObjects = SmartCache.convertToStores(cachedStores);
        setStores(storeObjects);
        setIsLiveData(true);
        
        // Log how many historical logs we have in cache
        const totalLogs = storeObjects.reduce((sum, store) => 
          sum + store.tanks.reduce((tankSum, tank) => tankSum + (tank.logs?.length || 0), 0), 0);
        console.log(`📊 Instant load complete: ${totalLogs} historical logs available for charts`);
      }

      // Step 2: Check what needs updating from server
      const staleStoreNames = SmartCache.getStoresNeedingUpdate(cachedStores);
      
      if (staleStoreNames.length > 0 || cachedStores.length === 0) {
        console.log(`🔄 Fetching fresh data with 10-day historical logs for ${staleStoreNames.length || 'all'} stores...`);
        console.log('⚠️ This may take 2-5 minutes as we fetch 10 days of historical data for charts, but it will be cached for instant future loads');
        
        // Initialize API service
        await ApiService.initialize();
        
        // Fetch fresh data from server
        const freshRawStores = await ApiService.getAllStoresData();
        
        // Step 3: Process raw data with full historical data (this is where we get the 10 days of logs)
        const processedStores = await processRawApiData(freshRawStores);
        
        // Step 4: Convert processed stores back to cacheable format
        const cacheableStores = processedStores.map(store => ({
          store_name: store.store_name,
          tanks: store.tanks.map(tank => ({
            tank_id: tank.tank_id,
            tank_name: tank.tank_name,
            product: tank.product,
            latest_log: tank.latest_log,
            logs: tank.logs, // Include the historical logs in cache
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
        
        // Step 5: Save to cache with historical data
        SmartCache.saveToCache(cacheableStores);
        
        // Step 6: Update UI
        setStores(processedStores);
        setIsLiveData(true);
        
        // Auto-configure new stores
        const existingStoreNames = ConfigService.getStoreHours().map(h => h.store_name);
        const newStores = processedStores.filter(store => !existingStoreNames.includes(store.store_name));
        
        for (const newStore of newStores) {
          ConfigService.autoConfigureNewStore(newStore.store_name, newStore.tanks.length, newStore.tanks);
          setNewStoreDetected(newStore.store_name);
          setTimeout(() => setNewStoreDetected(null), 5000);
        }
        
        console.log(`✅ Smart load complete with 10-day historical data: ${processedStores.length} stores`);
        console.log(`🎉 Charts now have real 10-day historical data and will load instantly next time!`);
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
    console.log('🔄 Manual refresh - clearing cache and fetching fresh data with 10-day historical logs');
    SmartCache.clearCache();
    setCacheInfo(SmartCache.getCacheInfo());
    setStores([]); // Clear current data to show loading
    await smartLoad();
  }, [smartLoad]);

  // Background refresh every 30 seconds (but only update latest readings, not historical data)
  const startBackgroundRefresh = useCallback(() => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }

    refreshInterval.current = setInterval(async () => {
      if (refreshInProgress.current) return;
      
      refreshInProgress.current = true;
      try {
        console.log('⏰ Background refresh (30s interval) - updating latest readings only');
        
        // For background refresh, only update latest readings, not historical data
        await ApiService.initialize();
        const freshRawStores = await ApiService.getAllStoresData();
        
        // Merge with existing cache to preserve historical data
        const cachedStores = SmartCache.getCachedStores();
        const mergedStores = SmartCache.mergeData(cachedStores, freshRawStores);
        SmartCache.saveToCache(mergedStores);
        
        // Update UI with merged data
        const storeObjects = SmartCache.convertToStores(mergedStores);
        setStores(storeObjects);
        setCacheInfo(SmartCache.getCacheInfo());
        
        console.log('✅ Background refresh complete - latest readings updated, historical data preserved');
      } catch (error) {
        console.warn('⚠️ Background refresh failed:', error);
      } finally {
        refreshInProgress.current = false;
      }
    }, 30000); // 30 seconds

    console.log('🔄 Background refresh started (every 30 seconds)');
  }, []);

  // Initial load
  useEffect(() => {
    console.log('🚀 useSmartCache useEffect TRIGGERED - starting initial load');
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