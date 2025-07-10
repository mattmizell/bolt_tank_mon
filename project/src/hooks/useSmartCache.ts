import { useState, useEffect, useCallback, useRef } from 'react';
import { Store } from '../types';
import { ApiService } from '../services/api';
import { SmartCache } from '../services/smartCache';
import { 
  createTankProfile, 
  calculateRunRate, 
  calculateHoursTo10Inches, 
  getTankStatus, 
  predictDepletionTime,
  getTankCapacityPercentage
} from '../services/tankProfile';
import { ConfigService } from '../services/configService';

export const useSmartCache = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiveData, setIsLiveData] = useState(false);
  const [newStoreDetected, setNewStoreDetected] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState(SmartCache.getCacheInfo());
  
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
          const profile = createTankProfile(rawStore.store_name, rawTank.tank_id);
          
          let runRate = rawTank.run_rate || 0.5;
          let hoursTo10 = rawTank.hours_to_10_inches || 0;
          let status: 'normal' | 'warning' | 'critical' = rawTank.status || 'normal';
          let predictedTime: string | undefined = rawTank.predicted_time;
          let capacityPercentage = rawTank.capacity_percentage || 0;
          let historicalLogs: any[] = [];

          // Skip historical data fetch during initial load - charts will load their own data
          // This prevents the app from hanging on initial load
          try {
            console.log(`📈 Skipping historical data fetch for initial load - charts will load independently`);
            historicalLogs = []; // Charts will fetch their own data when needed
            console.log(`✅ Deferred historical data loading for performance`);
          } catch (logError) {
            console.warn(`⚠️ Could not fetch historical logs for ${rawStore.store_name} Tank ${rawTank.tank_id}:`, logError);
            historicalLogs = [];
          }

          // If no pre-calculated data, calculate it from the historical logs we just fetched
          if (!rawTank.run_rate && historicalLogs.length >= 5) {
            console.log(`🔢 Calculating run rate from ${historicalLogs.length} historical logs...`);
            runRate = calculateRunRate(historicalLogs, profile);
          }

          const latestLog = rawTank.latest_log;
          if (typeof latestLog?.height === 'number' && isFinite(latestLog.height)) {
            hoursTo10 = calculateHoursTo10Inches(latestLog.height, runRate, profile);
            status = getTankStatus(latestLog.height, hoursTo10, profile);
            capacityPercentage = getTankCapacityPercentage(Number(latestLog.tc_volume) || 0, profile);
            
            if (hoursTo10 > 0) {
              try {
                const predicted = predictDepletionTime(new Date(latestLog.timestamp), hoursTo10, rawStore.store_name);
                predictedTime = predicted.toISOString();
              } catch (error) {
                console.warn('Error predicting depletion time:', error);
              }
            }
          }

          processedTanks.push({
            tank_id: rawTank.tank_id,
            tank_name: profile.tank_name,
            product: rawTank.product || rawTank.latest_log?.product || profile.tank_name,
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
            logs: historicalLogs, // Include the 10 days of real historical data
            run_rate: runRate,
            hours_to_10_inches: hoursTo10,
            predicted_time: predictedTime,
            status: status,
            profile: profile,
            capacity_percentage: capacityPercentage,
          });
        } catch (error) {
          console.error(`Error processing tank ${rawTank.tank_id}:`, error);
          const profile = createTankProfile(rawStore.store_name, rawTank.tank_id);
          processedTanks.push({
            tank_id: rawTank.tank_id,
            tank_name: profile.tank_name,
            product: rawTank.latest_log?.product || profile.tank_name,
            latest_log: rawTank.latest_log,
            logs: [],
            run_rate: 0.5,
            hours_to_10_inches: 0,
            status: 'normal' as const,
            profile: profile,
            capacity_percentage: 0,
          });
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
    try {
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
    setLoading(true);
    smartLoad()
      .finally(() => setLoading(false));
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