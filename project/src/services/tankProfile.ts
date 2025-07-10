import { TankLog } from '../types';
import { ConfigService } from './configService';

export interface TankProfile {
  store_name: string;
  tank_id: number;
  tank_name: string;
  diameter_inches: number;
  length_inches: number;
  max_capacity_gallons: number;
  critical_height_inches: number;
  warning_height_inches: number;
}

// Fallback tank dimensions and names
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

/**
 * Calculate gallons at a specific depth using cylindrical tank geometry
 */
export function gallonsAtDepth(depthInches: number, diameterInches: number, lengthInches: number): number {
  try {
    const r = diameterInches / 2;
    const h = depthInches;
    const L = lengthInches;
    
    if (h <= 0 || h > diameterInches || !isFinite(h) || !isFinite(r) || !isFinite(L)) {
      return 0;
    }
    
    const theta = Math.acos((r - h) / r);
    if (!isFinite(theta)) return 0;
    
    const segmentArea = (r ** 2) * (theta - Math.sin(2 * theta) / 2);
    if (!isFinite(segmentArea)) return 0;
    
    const volumeCubicInches = segmentArea * L;
    const gallons = volumeCubicInches / 231;
    return isFinite(gallons) ? Math.max(0, gallons) : 0;
  } catch (error) {
    console.error('Error calculating gallons at depth:', error);
    return 0;
  }
}

/**
 * Get tank dimensions for a specific store and tank
 */
export function getTankDimensions(storeName: string, tankId: number): [number, number] {
  try {
    const config = ConfigService.getTankConfiguration(storeName, tankId);
    if (config) {
      return [config.diameter_inches, config.length_inches];
    }
  } catch (error) {
    console.warn('Error getting tank configuration:', error);
  }
  
  return STORE_TANK_DIMENSIONS[storeName]?.[tankId] || [DEFAULT_DIAMETER, DEFAULT_LENGTH];
}

/**
 * Get tank name for a specific store and tank
 */
export function getTankName(storeName: string, tankId: number): string {
  try {
    const config = ConfigService.getTankConfiguration(storeName, tankId);
    if (config) {
      return config.tank_name;
    }
  } catch (error) {
    console.warn('Error getting tank configuration:', error);
  }
  
  return STORE_TANK_NAMES[storeName]?.[tankId] || `Tank ${tankId}`;
}

/**
 * Create a complete tank profile with all specifications
 */
export function createTankProfile(storeName: string, tankId: number): TankProfile {
  try {
    const config = ConfigService.getTankConfiguration(storeName, tankId);
    if (config) {
      return {
        store_name: config.store_name,
        tank_id: config.tank_id,
        tank_name: config.tank_name,
        diameter_inches: config.diameter_inches,
        length_inches: config.length_inches,
        max_capacity_gallons: config.max_capacity_gallons || gallonsAtDepth(config.diameter_inches, config.diameter_inches, config.length_inches),
        critical_height_inches: config.critical_height_inches,
        warning_height_inches: config.warning_height_inches,
      };
    }
  } catch (error) {
    console.warn('Error getting tank configuration, using defaults:', error);
  }
  
  const [diameter, length] = getTankDimensions(storeName, tankId);
  const tankName = getTankName(storeName, tankId);
  const maxCapacity = gallonsAtDepth(diameter, diameter, length);
  
  return {
    store_name: storeName,
    tank_id: tankId,
    tank_name: tankName,
    diameter_inches: diameter,
    length_inches: length,
    max_capacity_gallons: Math.round(maxCapacity),
    critical_height_inches: 10,
    warning_height_inches: 20,
  };
}

/**
 * OPTIMIZED: Fast Run Rate Calculation for Performance
 * Simplified algorithm that prioritizes speed over precision for initial load
 */
export function calculateRunRate(logs: TankLog[], profile: TankProfile): number {
  try {
    if (!logs || logs.length < 6) {
      return 0.5; // Default fallback
    }
    
    // Get store hours from configuration
    let openHour = 5;
    let closeHour = 23;
    
    try {
      const storeHours = ConfigService.getStoreHoursForStore(profile.store_name);
      if (storeHours) {
        openHour = storeHours.open_hour;
        closeHour = storeHours.close_hour;
      }
    } catch (error) {
      // Use defaults
    }
    
    // Filter to business hours and validate data
    const businessHourLogs = logs.filter(log => {
      try {
        const logDate = new Date(log.timestamp);
        const hour = logDate.getHours();
        const isBusinessHour = hour >= openHour && hour < closeHour;
        const hasValidData = isFinite(log.tc_volume) && log.tc_volume > 0 && log.tc_volume < 50000;
        return isBusinessHour && hasValidData;
      } catch {
        return false;
      }
    });
    
    if (businessHourLogs.length < 4) {
      return 0.5; // Default fallback
    }
    
    // Simple approach: Use last 20 readings for speed
    const recentLogs = businessHourLogs.slice(-20);
    
    // Remove obvious refills quickly
    const cleanLogs = [];
    for (let i = 0; i < recentLogs.length; i++) {
      if (i === 0) {
        cleanLogs.push(recentLogs[i]);
        continue;
      }
      
      const currentLog = recentLogs[i];
      const prevLog = recentLogs[i - 1];
      
      try {
        const volumeDelta = currentLog.tc_volume - prevLog.tc_volume;
        const timeDelta = (new Date(currentLog.timestamp).getTime() - new Date(prevLog.timestamp).getTime()) / (1000 * 60 * 60);
        
        // Skip obvious refills
        if (volumeDelta > 1500 && timeDelta < 2) {
          continue;
        }
        
        cleanLogs.push(currentLog);
      } catch {
        cleanLogs.push(currentLog);
      }
    }
    
    if (cleanLogs.length < 3) {
      return 0.5;
    }
    
    // Simple linear regression for speed
    const firstTimestamp = new Date(cleanLogs[0].timestamp).getTime();
    const dataPoints = cleanLogs.map(log => {
      const timestamp = new Date(log.timestamp).getTime();
      const hoursFromStart = (timestamp - firstTimestamp) / (1000 * 60 * 60);
      return {
        hours: hoursFromStart,
        volume: log.tc_volume,
      };
    }).filter(point => isFinite(point.hours) && isFinite(point.volume) && point.volume > 0);
    
    if (dataPoints.length < 3) {
      return 0.5;
    }
    
    // Quick linear regression
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, point) => sum + point.hours, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point.volume, 0);
    const sumXY = dataPoints.reduce((sum, point) => sum + point.hours * point.volume, 0);
    const sumXX = dataPoints.reduce((sum, point) => sum + point.hours * point.hours, 0);
    
    const denominator = n * sumXX - sumX * sumX;
    if (Math.abs(denominator) < 1e-10) {
      return 0.5;
    }
    
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const rateGallonsPerHour = Math.abs(slope);
    
    // Validate result
    if (!isFinite(rateGallonsPerHour) || rateGallonsPerHour < 0.1 || rateGallonsPerHour > 150) {
      return 0.5;
    }
    
    return rateGallonsPerHour;
    
  } catch (error) {
    console.error('Error calculating run rate:', error);
    return 0.5;
  }
}

/**
 * Calculate hours until tank reaches critical level
 */
export function calculateHoursTo10Inches(currentHeight: number, runRate: number, profile: TankProfile): number {
  try {
    if (!isFinite(currentHeight) || !isFinite(runRate) || runRate <= 0) {
      return 0;
    }
    
    if (currentHeight <= profile.critical_height_inches) {
      return 0;
    }
    
    const currentGallons = gallonsAtDepth(currentHeight, profile.diameter_inches, profile.length_inches);
    const gallonsAtCritical = gallonsAtDepth(profile.critical_height_inches, profile.diameter_inches, profile.length_inches);
    
    const gallonsUntilCritical = currentGallons - gallonsAtCritical;
    
    if (gallonsUntilCritical <= 0) {
      return 0;
    }
    
    const hoursUntilCritical = gallonsUntilCritical / runRate;
    
    if (!isFinite(hoursUntilCritical)) {
      return 0;
    }
    
    return Math.max(0, hoursUntilCritical);
    
  } catch (error) {
    console.error('Error calculating hours to critical level:', error);
    return 0;
  }
}

/**
 * Predict depletion time accounting for business hours
 */
export function predictDepletionTime(startTime: Date, hoursNeeded: number, storeName?: string): Date {
  try {
    if (!isFinite(hoursNeeded) || hoursNeeded <= 0) {
      return startTime;
    }
    
    let openHour = 5;
    let closeHour = 23;
    
    if (storeName) {
      try {
        const storeHours = ConfigService.getStoreHoursForStore(storeName);
        if (storeHours) {
          openHour = storeHours.open_hour;
          closeHour = storeHours.close_hour;
        }
      } catch (error) {
        // Use defaults
      }
    }
    
    let currentTime = new Date(startTime);
    let hoursRemaining = hoursNeeded;
    let iterations = 0;
    const maxIterations = hoursNeeded * 2 + 100;
    
    while (hoursRemaining >= 1e-6 && iterations < maxIterations) {
      const currentHour = currentTime.getHours();
      
      if (currentHour >= openHour && currentHour < closeHour) {
        if (hoursRemaining >= 1) {
          hoursRemaining -= 1;
          currentTime = new Date(currentTime.getTime() + 60 * 60 * 1000);
        } else {
          currentTime = new Date(currentTime.getTime() + hoursRemaining * 60 * 60 * 1000);
          hoursRemaining = 0;
        }
      } else {
        currentTime = new Date(currentTime.getTime() + 60 * 60 * 1000);
      }
      iterations++;
    }
    
    return currentTime;
  } catch (error) {
    console.error('Error predicting depletion time:', error);
    return startTime;
  }
}

/**
 * Enhanced tank status determination
 */
export function getTankStatus(height: number, hoursTo10Inches: number, profile: TankProfile): 'normal' | 'warning' | 'critical' {
  try {
    if (!isFinite(height)) return 'normal';
    
    if (height <= profile.critical_height_inches || (isFinite(hoursTo10Inches) && hoursTo10Inches > 0 && hoursTo10Inches < 24)) {
      return 'critical';
    }
    
    if (height <= profile.warning_height_inches || (isFinite(hoursTo10Inches) && hoursTo10Inches > 0 && hoursTo10Inches <= 40)) {
      return 'warning';
    }
    
    return 'normal';
  } catch (error) {
    console.error('Error determining tank status:', error);
    return 'normal';
  }
}

/**
 * Calculate tank capacity percentage
 */
export function getTankCapacityPercentage(currentVolume: number, profile: TankProfile): number {
  try {
    if (!isFinite(currentVolume) || profile.max_capacity_gallons <= 0) return 0;
    const percentage = (currentVolume / profile.max_capacity_gallons) * 100;
    return Math.min(100, Math.max(0, isFinite(percentage) ? percentage : 0));
  } catch (error) {
    console.error('Error calculating capacity percentage:', error);
    return 0;
  }
}

/**
 * Get all tank profiles for a store
 */
export function getStoreTankProfiles(storeName: string): TankProfile[] {
  try {
    const configs = ConfigService.getStoreConfigurations(storeName);
    if (configs.length > 0) {
      return configs.map(config => ({
        store_name: config.store_name,
        tank_id: config.tank_id,
        tank_name: config.tank_name,
        diameter_inches: config.diameter_inches,
        length_inches: config.length_inches,
        max_capacity_gallons: config.max_capacity_gallons || gallonsAtDepth(config.diameter_inches, config.diameter_inches, config.length_inches),
        critical_height_inches: config.critical_height_inches,
        warning_height_inches: config.warning_height_inches,
      }));
    }
  } catch (error) {
    console.warn('Error getting store configurations, using defaults:', error);
  }
  
  const tankIds = Object.keys(STORE_TANK_DIMENSIONS[storeName] || {}).map(Number);
  return tankIds.map(tankId => createTankProfile(storeName, tankId));
}