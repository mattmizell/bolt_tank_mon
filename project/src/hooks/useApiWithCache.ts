import { useState, useEffect, useCallback, useRef } from 'react';
import { Store } from '../types';
import { ApiService } from '../services/api';
import { LocalCache } from '../services/localCache';
import { 
  createTankProfile, 
  calculateRunRate, 
  calculateHoursTo10Inches, 
  getTankStatus, 
  predictDepletionTime,
  getTankCapacityPercentage
} from '../services/tankProfile';
import { ConfigService } from '../services/configService';

export const useApiWithCache = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiveData, setIsLiveData] = useState(false);
  const [newStoreDetected, setNewStoreDetected] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState(LocalCache.getCacheInfo());
  
  const backgroundRefreshInProgress = useRef(false);
  const isFirstLoad = useRef(true);

  // Process store data with full calculations (this is what gets cached)
  const processStoreDataFull = useCallback(async (rawStores: any[]): Promise<Store[]> => {
    console.log('🔄 Processing store data with full calculations...');
    const startTime = Date.now();
    
    const processedStores: Store[] = [];

    for (const rawStore of rawStores) {
      const processedTanks = [];

      for (const rawTank of rawStore.tanks) {
        try {
          const profile = createTankProfile(rawStore.store_name, rawTank.tank_id);
          
          // Always do full calculations for caching
          let runRate = 0.5;
          let hoursTo10 = 0;
          let status: 'normal' | 'warning' | 'critical' = 'normal';
          let predictedTime: string | undefined;
          let capacityPercentage = 0;

          // Use pre-calculated data if available (from Supabase)
          if (rawTank.run_rate && rawTank.hours_to_10_inches !== undefined) {
            runRate = rawTank.run_rate;
            hoursTo10 = rawTank.hours_to_10_inches;
            status = rawTank.status || 'normal';
            predictedTime = rawTank.predicted_time;
            capacityPercentage = rawTank.capacity_percentage || 0;
          } else if (rawTank.latest_log) {
            // Calculate if not pre-calculated
            const latestLog = rawTank.latest_log;
            
            // Get historical data for run rate calculation
            try {
              const logs = await ApiService.getTankLogs(rawStore.store_name, rawTank.tank_id, 48);
              if (logs.length >= 5) {
                runRate = calculateRunRate(logs, profile);
              }
            } catch (logError) {
              console.warn(`Could not fetch logs for ${rawStore.store_name} Tank ${rawTank.tank_id}:`, logError);
            }

            if (typeof latestLog.height === 'number' && isFinite(latestLog.height)) {
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
            logs: rawTank.logs || [],
            run_rate: runRate,
            hours_to_10_inches: hoursTo10,
            predicted_time: predictedTime,
            status: status,
            profile: profile,
            capacity_percentage: capacityPercentage,
          });
        } catch (error) {
          console.error(`Error processing tank ${rawTank.tank_id}:`, error);
          // Add tank with safe defaults
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

    const duration = Date.now() - startTime;
    console.log(`✅ Full processing completed in ${duration}ms`);
    
    return processedStores;
  }, []);

  // Fast load from cache (no calculations needed)
  const loadFromCache = useCallback((): Store[] | null => {
    const cachedData = LocalCache.getCachedData();
    if (!cachedData) return null;

    console.log('⚡ Loading from cache - INSTANT!');
    
    // Convert cached data back to Store objects
    const stores: Store[] = cachedData.map(cachedStore => ({
      store_name: cachedStore.store_name,
      tanks: cachedStore.tanks.map(cachedTank => ({
        tank_id: cachedTank.tank_id,
        tank_name: cachedTank.tank_name,
        product: cachedTank.product,
        latest_log: cachedTank.latest_log,
        logs: cachedTank.logs || [],
        run_rate: cachedTank.run_rate,
        hours_to_10_inches: cachedTank.hours_to_10_inches,
        predicted_time: cachedTank.predicted_time,
        status: cachedTank.status,
        profile: createTankProfile(cachedStore.store_name, cachedTank.tank_id),
        capacity_percentage: cachedTank.capacity_percentage,
      })),
      last_updated: cachedStore.last_updated,
    }));

    return stores;
  }, []);

  // Fetch fresh data from API and do full processing
  const fetchAndProcessFreshData = useCallback(async (): Promise<Store[]> => {
    console.log('🌐 Fetching fresh data from API...');
    console.log('⚠️ This will be slow the first time, but subsequent loads will be instant!');
    
    // Initialize API service
    await ApiService.initialize();
    
    const rawStores = await ApiService.getAllStoresData();
    const processedStores = await processStoreDataFull(rawStores);
    
    // Auto-configure new stores
    const existingStoreNames = ConfigService.getStoreHours().map(h => h.store_name);
    const newStores = processedStores.filter(store => !existingStoreNames.includes(store.store_name));
    
    for (const newStore of newStores) {
      ConfigService.autoConfigureNewStore(newStore.store_name, newStore.tanks.length, newStore.tanks);
      setNewStoreDetected(newStore.store_name);
      setTimeout(() => setNewStoreDetected(null), 5000);
    }

    // Cache the fully processed data
    const cacheableData = processedStores.map(store => ({
      store_name: store.store_name,
      tanks: store.tanks.map(tank => ({
        tank_id: tank.tank_id,
        tank_name: tank.tank_name,
        product: tank.product,
        latest_log: tank.latest_log,
        logs: tank.logs,
        run_rate: tank.run_rate,
        hours_to_10_inches: tank.hours_to_10_inches,
        predicted_time: tank.predicted_time,
        status: tank.status,
        capacity_percentage: tank.capacity_percentage,
      })),
      last_updated: store.last_updated,
    }));

    LocalCache.setCachedData(cacheableData);
    setCacheInfo(LocalCache.getCacheInfo());

    return processedStores;
  }, [processStoreDataFull]);

  // Main data loading function
  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);

      // Try cache first (unless forcing refresh)
      if (!forceRefresh && LocalCache.hasValidCache()) {
        const cachedStores = loadFromCache();
        if (cachedStores) {
          setStores(cachedStores);
          setIsLiveData(true);
          setCacheInfo(LocalCache.getCacheInfo());
          
          console.log('🎉 Loaded from cache - app started instantly!');
          
          // Start background refresh if needed
          if (LocalCache.needsRefresh() && !backgroundRefreshInProgress.current) {
            console.log('🔄 Starting background refresh...');
            backgroundRefreshInProgress.current = true;
            
            fetchAndProcessFreshData()
              .then((freshStores) => {
                setStores(freshStores);
                setCacheInfo(LocalCache.getCacheInfo());
                console.log('✅ Background refresh completed');
              })
              .catch((error) => {
                console.warn('⚠️ Background refresh failed:', error);
              })
              .finally(() => {
                backgroundRefreshInProgress.current = false;
              });
          }
          
          return;
        }
      }

      // No cache or forced refresh - fetch fresh data (slow)
      if (isFirstLoad.current) {
        console.log('🐌 First load - this will be slow but will cache for instant future loads');
      } else {
        console.log('🔄 Manual refresh - fetching fresh data');
      }
      
      const freshStores = await fetchAndProcessFreshData();
      setStores(freshStores);
      setIsLiveData(true);
      setCacheInfo(LocalCache.getCacheInfo());
      
      if (isFirstLoad.current) {
        console.log('🎉 First load complete! Next time you open the app, it will load instantly!');
        isFirstLoad.current = false;
      }
      
    } catch (apiError) {
      console.error('❌ Failed to load data:', apiError);
      setError(`Failed to load data: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
      setStores([]);
      setIsLiveData(false);
    }
  }, [loadFromCache, fetchAndProcessFreshData]);

  // Refresh data (clears cache and fetches fresh)
  const refreshData = useCallback(async () => {
    console.log('🔄 Manual refresh - clearing cache and fetching fresh data');
    LocalCache.clearCache();
    setCacheInfo(LocalCache.getCacheInfo());
    await loadData(true);
  }, [loadData]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadData()
      .finally(() => setLoading(false));
  }, [loadData]);

  // Set up periodic background refresh (every 30 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!backgroundRefreshInProgress.current && LocalCache.needsRefresh()) {
        console.log('⏰ Periodic background refresh triggered');
        backgroundRefreshInProgress.current = true;
        
        fetchAndProcessFreshData()
          .then((freshStores) => {
            setStores(freshStores);
            setCacheInfo(LocalCache.getCacheInfo());
            console.log('✅ Periodic refresh completed');
          })
          .catch((error) => {
            console.warn('⚠️ Periodic refresh failed:', error);
          })
          .finally(() => {
            backgroundRefreshInProgress.current = false;
          });
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, [fetchAndProcessFreshData]);

  return {
    stores,
    loading,
    error,
    isLiveData,
    refreshData,
    newStoreDetected,
    cacheInfo,
    clearCache: () => {
      LocalCache.clearCache();
      setCacheInfo(LocalCache.getCacheInfo());
    }
  };
};