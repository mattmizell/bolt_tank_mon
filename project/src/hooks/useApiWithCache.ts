import { useState, useEffect, useCallback, useRef } from 'react';
import { Store } from '../types';
import { ApiService } from '../services/api';
import { LocalCache } from '../services/localCache';
import { calculateSimpleTankMetrics } from '../services/tankAnalytics';
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
          // Use simplified analytics - no tank geometry required!
          const latestLog = rawTank.latest_log;
          const currentHeight = Number(latestLog?.height) || 0;
          const currentVolume = Number(latestLog?.tc_volume) || 0;
          
          // Get tank configuration for actual capacity
          const tankConfig = ConfigService.getTankConfiguration(rawStore.store_name, rawTank.tank_id);
          const actualCapacity = tankConfig?.max_capacity_gallons || 10000;
          
          let metrics;
          
          // Use pre-calculated data if available (from Supabase)
          if (rawTank.run_rate && rawTank.hours_to_10_inches !== undefined) {
            metrics = {
              current_height_inches: currentHeight,
              current_volume_gallons: currentVolume,
              run_rate_inches_per_hour: rawTank.run_rate,
              hours_to_10_inches: rawTank.hours_to_10_inches,
              predicted_time_to_10in: rawTank.predicted_time,
              status: rawTank.status || 'normal',
              capacity_percentage: rawTank.capacity_percentage || 0
            };
          } else {
            // Get historical data for calculation (quick fetch)
            let historicalLogs: any[] = [];
            try {
              historicalLogs = await ApiService.getTankLogs(rawStore.store_name, rawTank.tank_id, 72); // 3 days
            } catch (logError) {
              console.warn(`Could not fetch logs for ${rawStore.store_name} Tank ${rawTank.tank_id}:`, logError);
            }
            
            // Calculate using simplified approach
            metrics = calculateSimpleTankMetrics(
              rawStore.store_name,
              rawTank.tank_id,
              historicalLogs,
              currentHeight,
              currentVolume
            );
          }

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
            logs: rawTank.logs || [],
            run_rate: metrics.run_rate_inches_per_hour,
            hours_to_10_inches: metrics.hours_to_10_inches,
            predicted_time: metrics.predicted_time_to_10in,
            status: metrics.status,
            profile: {
              store_name: rawStore.store_name,
              tank_id: rawTank.tank_id,
              tank_name: tankConfig?.tank_name || rawTank.tank_name || `Tank ${rawTank.tank_id}`,
              max_capacity_gallons: actualCapacity,
              critical_height_inches: tankConfig?.critical_height_inches || 10,
              warning_height_inches: tankConfig?.warning_height_inches || 20,
            },
            capacity_percentage: metrics.capacity_percentage,
          });
        } catch (error) {
          console.error(`Error processing tank ${rawTank.tank_id}:`, error);
          // Add tank with safe defaults - simplified
          const fallbackConfig = ConfigService.getTankConfiguration(rawStore.store_name, rawTank.tank_id);
          const fallbackCapacity = fallbackConfig?.max_capacity_gallons || 10000;
          
          processedTanks.push({
            tank_id: rawTank.tank_id,
            tank_name: fallbackConfig?.tank_name || rawTank.tank_name || `Tank ${rawTank.tank_id}`,
            product: rawTank.latest_log?.product || 'Unknown',
            latest_log: rawTank.latest_log,
            logs: [],
            run_rate: 0.1, // Default inches per hour
            hours_to_10_inches: 0,
            status: 'normal' as const,
            profile: {
              store_name: rawStore.store_name,
              tank_id: rawTank.tank_id,
              tank_name: fallbackConfig?.tank_name || rawTank.tank_name || `Tank ${rawTank.tank_id}`,
              max_capacity_gallons: fallbackCapacity,
              critical_height_inches: fallbackConfig?.critical_height_inches || 10,
              warning_height_inches: fallbackConfig?.warning_height_inches || 20,
            },
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
        profile: (() => {
          const tankConfig = ConfigService.getTankConfiguration(cachedStore.store_name, cachedTank.tank_id);
          return {
            store_name: cachedStore.store_name,
            tank_id: cachedTank.tank_id,
            tank_name: tankConfig?.tank_name || cachedTank.tank_name,
            max_capacity_gallons: tankConfig?.max_capacity_gallons || 10000,
            critical_height_inches: tankConfig?.critical_height_inches || 10,
            warning_height_inches: tankConfig?.warning_height_inches || 20,
          };
        })(),
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