// Enhanced run rate caching service with better performance optimization
import { Tank, TankLog } from '../types';
import { TankProfile } from './tankProfile';

interface CachedRunRateData {
  store_name: string;
  tank_id: number;
  run_rate: number;
  hours_to_10_inches: number;
  predicted_time?: string;
  status: 'normal' | 'warning' | 'critical';
  capacity_percentage: number;
  last_calculated: string;
  data_hash: string;
  calculation_period_days: number;
  data_quality_score: number; // New field to track data quality
}

interface RunRateCalculationInput {
  logs: TankLog[];
  profile: TankProfile;
  latest_log?: TankLog;
}

const STORAGE_KEY = 'tank_monitor_run_rate_cache';
const CACHE_DURATION_HOURS = 4; // Reduced from 6 to 4 hours for more frequent updates
const MIN_DATA_CHANGE_THRESHOLD = 0.03; // Reduced threshold for more sensitive updates

export class RunRateCache {
  // Get cached run rate data with performance optimization
  static getCachedData(): CachedRunRateData[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Filter out obviously invalid entries during load
        return data.filter((entry: CachedRunRateData) => 
          entry.run_rate !== undefined && 
          this.isValidRunRate(entry.run_rate) &&
          entry.store_name &&
          entry.tank_id !== undefined
        );
      }
    } catch (error) {
      console.error('Error loading run rate cache:', error);
      // Clear corrupted cache
      localStorage.removeItem(STORAGE_KEY);
    }
    return [];
  }

  // Save cached run rate data with optimization
  static saveCachedData(data: CachedRunRateData[]): void {
    try {
      // Keep only last 500 entries and sort by quality score
      const sortedData = data
        .filter(entry => this.isValidRunRate(entry.run_rate))
        .sort((a, b) => (b.data_quality_score || 0) - (a.data_quality_score || 0))
        .slice(0, 500);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedData));
    } catch (error) {
      console.error('Error saving run rate cache:', error);
      // If storage is full, clear old entries and try again
      this.clearOldCache();
      try {
        const trimmedData = data.slice(-200); // Keep only most recent 200 entries
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedData));
      } catch (retryError) {
        console.error('Failed to save cache even after cleanup:', retryError);
      }
    }
  }

  // Enhanced data hash generation with better sensitivity
  static generateDataHash(input: RunRateCalculationInput): string {
    try {
      // Use more recent logs for better change detection
      const recentLogs = input.logs.slice(-100); // Increased from 50 to 100
      const hashData = {
        logs: recentLogs.map(log => ({
          tc_volume: Math.round(log.tc_volume * 10) / 10, // Round to 1 decimal for stability
          height: Math.round(log.height * 10) / 10,
          timestamp: log.timestamp,
        })),
        profile: {
          capacity: input.profile.max_capacity_gallons,
          critical_height: input.profile.critical_height_inches,
        },
        latest_volume: input.latest_log?.tc_volume ? Math.round(input.latest_log.tc_volume * 10) / 10 : 0,
        latest_height: input.latest_log?.height ? Math.round(input.latest_log.height * 10) / 10 : 0,
        data_span_hours: recentLogs.length > 0 ? 
          (new Date(recentLogs[recentLogs.length - 1].timestamp).getTime() - 
           new Date(recentLogs[0].timestamp).getTime()) / (1000 * 60 * 60) : 0,
      };
      
      // Simple but effective hash function
      const str = JSON.stringify(hashData);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString();
    } catch (error) {
      console.error('Error generating data hash:', error);
      return Date.now().toString();
    }
  }

  // Enhanced cache validity checking
  static isCacheValid(cached: CachedRunRateData, currentHash: string): boolean {
    try {
      // Check if cache is too old
      const cacheAge = Date.now() - new Date(cached.last_calculated).getTime();
      const maxAge = CACHE_DURATION_HOURS * 60 * 60 * 1000;
      
      if (cacheAge > maxAge) {
        return false;
      }

      // Check if data has changed significantly
      if (cached.data_hash !== currentHash) {
        return false;
      }

      // Enhanced validation: Check if run rate is reasonable
      if (!this.isValidRunRate(cached.run_rate)) {
        return false;
      }

      // Check data quality score (if available)
      if (cached.data_quality_score !== undefined && cached.data_quality_score < 0.3) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  }

  // Calculate data quality score
  static calculateDataQualityScore(input: RunRateCalculationInput, runRate: number): number {
    try {
      let score = 0.5; // Base score
      
      // Data quantity score (0-0.3)
      const logCount = input.logs.length;
      if (logCount >= 100) score += 0.3;
      else if (logCount >= 50) score += 0.2;
      else if (logCount >= 20) score += 0.1;
      
      // Data span score (0-0.2)
      if (input.logs.length >= 2) {
        const spanHours = (new Date(input.logs[input.logs.length - 1].timestamp).getTime() - 
                          new Date(input.logs[0].timestamp).getTime()) / (1000 * 60 * 60);
        if (spanHours >= 168) score += 0.2; // 1 week+
        else if (spanHours >= 72) score += 0.15; // 3 days+
        else if (spanHours >= 24) score += 0.1; // 1 day+
      }
      
      // Run rate reasonableness score (0-0.2)
      if (runRate >= 1 && runRate <= 100) score += 0.2;
      else if (runRate >= 0.5 && runRate <= 200) score += 0.1;
      
      return Math.min(1.0, score);
    } catch (error) {
      return 0.5; // Default score
    }
  }

  // Get cached run rate for a specific tank with enhanced logic
  static getCachedRunRate(storeName: string, tankId: number, input: RunRateCalculationInput): CachedRunRateData | null {
    try {
      const allCached = this.getCachedData();
      const cached = allCached.find(
        item => item.store_name === storeName && item.tank_id === tankId
      );

      if (!cached) {
        return null;
      }

      const currentHash = this.generateDataHash(input);
      
      if (this.isCacheValid(cached, currentHash)) {
        const cacheAgeMinutes = Math.round((Date.now() - new Date(cached.last_calculated).getTime()) / (1000 * 60));
        console.log(`📋 Using cached run rate for ${storeName} Tank ${tankId} (age: ${cacheAgeMinutes} minutes, quality: ${(cached.data_quality_score || 0.5).toFixed(2)})`);
        return cached;
      }

      // Remove invalid cache entry
      this.removeCacheEntry(storeName, tankId);
      return null;
    } catch (error) {
      console.error('Error getting cached run rate:', error);
      return null;
    }
  }

  // Enhanced cache run rate with quality scoring
  static cacheRunRate(
    storeName: string, 
    tankId: number, 
    input: RunRateCalculationInput,
    calculatedData: {
      run_rate: number;
      hours_to_10_inches: number;
      predicted_time?: string;
      status: 'normal' | 'warning' | 'critical';
      capacity_percentage: number;
    }
  ): void {
    try {
      // Validate calculated data before caching
      if (!this.isValidRunRate(calculatedData.run_rate)) {
        console.warn(`⚠️ Not caching invalid run rate for ${storeName} Tank ${tankId}: ${calculatedData.run_rate} gal/hr`);
        return;
      }

      const allCached = this.getCachedData();
      const dataHash = this.generateDataHash(input);
      const qualityScore = this.calculateDataQualityScore(input, calculatedData.run_rate);
      
      const newCacheEntry: CachedRunRateData = {
        store_name: storeName,
        tank_id: tankId,
        run_rate: calculatedData.run_rate,
        hours_to_10_inches: calculatedData.hours_to_10_inches,
        predicted_time: calculatedData.predicted_time,
        status: calculatedData.status,
        capacity_percentage: calculatedData.capacity_percentage,
        last_calculated: new Date().toISOString(),
        data_hash: dataHash,
        calculation_period_days: Math.ceil(input.logs.length / 24),
        data_quality_score: qualityScore,
      };

      // Remove existing cache for this tank
      const filteredCache = allCached.filter(
        item => !(item.store_name === storeName && item.tank_id === tankId)
      );

      // Add new cache entry
      filteredCache.push(newCacheEntry);

      this.saveCachedData(filteredCache);
      
      console.log(`💾 Cached run rate for ${storeName} Tank ${tankId}: ${calculatedData.run_rate.toFixed(1)} gal/hr (quality: ${qualityScore.toFixed(2)})`);
    } catch (error) {
      console.error('Error caching run rate:', error);
    }
  }

  // Enhanced validation for gas station run rates
  static isValidRunRate(runRate: number): boolean {
    // Gas station tanks typically consume 0.1 to 150 gal/hr
    // Anything above 200 gal/hr is likely an error, anything below 0.1 is too low
    return isFinite(runRate) && runRate >= 0.1 && runRate <= 150;
  }

  // Remove a specific cache entry
  static removeCacheEntry(storeName: string, tankId: number): void {
    try {
      const allCached = this.getCachedData();
      const filteredCache = allCached.filter(
        item => !(item.store_name === storeName && item.tank_id === tankId)
      );
      this.saveCachedData(filteredCache);
    } catch (error) {
      console.error('Error removing cache entry:', error);
    }
  }

  // Enhanced cache statistics
  static getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    highQualityEntries: number;
    oldestEntry?: string;
    newestEntry?: string;
    averageAge: number;
    averageQuality: number;
  } {
    try {
      const allCached = this.getCachedData();
      const now = Date.now();
      const maxAge = CACHE_DURATION_HOURS * 60 * 60 * 1000;
      
      const validEntries = allCached.filter(entry => {
        const age = now - new Date(entry.last_calculated).getTime();
        return age <= maxAge && this.isValidRunRate(entry.run_rate);
      });

      const highQualityEntries = validEntries.filter(entry => 
        (entry.data_quality_score || 0) >= 0.7
      );

      const ages = allCached.map(entry => now - new Date(entry.last_calculated).getTime());
      const averageAge = ages.length > 0 ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 0;

      const qualities = allCached.map(entry => entry.data_quality_score || 0.5);
      const averageQuality = qualities.length > 0 ? qualities.reduce((sum, q) => sum + q, 0) / qualities.length : 0.5;

      const timestamps = allCached.map(entry => new Date(entry.last_calculated).getTime());
      const oldestTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : 0;
      const newestTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : 0;

      return {
        totalEntries: allCached.length,
        validEntries: validEntries.length,
        highQualityEntries: highQualityEntries.length,
        oldestEntry: timestamps.length > 0 ? new Date(oldestTimestamp).toISOString() : undefined,
        newestEntry: timestamps.length > 0 ? new Date(newestTimestamp).toISOString() : undefined,
        averageAge: averageAge / (1000 * 60), // Convert to minutes
        averageQuality: averageQuality,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalEntries: 0,
        validEntries: 0,
        highQualityEntries: 0,
        averageAge: 0,
        averageQuality: 0.5,
      };
    }
  }

  // Enhanced cache cleanup
  static clearOldCache(): number {
    try {
      const allCached = this.getCachedData();
      const now = Date.now();
      const maxAge = CACHE_DURATION_HOURS * 60 * 60 * 1000;
      
      const validEntries = allCached.filter(entry => {
        const age = now - new Date(entry.last_calculated).getTime();
        const isValid = age <= maxAge && this.isValidRunRate(entry.run_rate);
        return isValid;
      });

      const removedCount = allCached.length - validEntries.length;
      
      if (removedCount > 0) {
        this.saveCachedData(validEntries);
        console.log(`🧹 Cleared ${removedCount} old/invalid cache entries`);
      }

      return removedCount;
    } catch (error) {
      console.error('Error clearing old cache:', error);
      return 0;
    }
  }

  // Clear all cache
  static clearAllCache(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('🗑️ Cleared all run rate cache');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Force refresh cache for a specific tank
  static forceRefreshTank(storeName: string, tankId: number): void {
    this.removeCacheEntry(storeName, tankId);
    console.log(`🔄 Forced cache refresh for ${storeName} Tank ${tankId}`);
  }

  // Export cache data with enhanced information
  static exportCache(): string {
    const cacheData = {
      cache: this.getCachedData(),
      stats: this.getCacheStats(),
      exportDate: new Date().toISOString(),
      version: '1.2',
      performance_notes: {
        cache_duration_hours: CACHE_DURATION_HOURS,
        max_entries: 500,
        quality_scoring: true,
      }
    };
    return JSON.stringify(cacheData, null, 2);
  }

  // Import cache data with validation
  static importCache(cacheJson: string): boolean {
    try {
      const data = JSON.parse(cacheJson);
      if (data.cache && Array.isArray(data.cache)) {
        // Validate and enhance imported cache entries
        const validEntries = data.cache
          .filter((entry: any) => 
            entry.run_rate !== undefined && 
            this.isValidRunRate(entry.run_rate) &&
            entry.store_name &&
            entry.tank_id !== undefined
          )
          .map((entry: any) => ({
            ...entry,
            data_quality_score: entry.data_quality_score || 0.5, // Add quality score if missing
          }));
        
        this.saveCachedData(validEntries);
        console.log(`📥 Imported ${validEntries.length} valid cache entries`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing cache:', error);
      return false;
    }
  }
}