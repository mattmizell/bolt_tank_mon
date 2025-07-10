// Simplified Tank Analytics - Industry Standard Approach
// Based on historical inch patterns, no tank geometry required

import { TankLog } from '../types';
import { ConfigService } from './configService';

export interface SimpleTankMetrics {
  // Current state
  current_height_inches: number;
  current_volume_gallons: number;
  
  // Analytics (the key outputs)
  run_rate_inches_per_hour: number;
  hours_to_10_inches: number;
  predicted_time_to_10in: string | null;
  
  // Status and display
  status: 'normal' | 'warning' | 'critical';
  capacity_percentage: number;
}

/**
 * Calculate all tank metrics using the simplified industry approach
 * INPUT: Just height history and current readings
 * OUTPUT: Industry-standard predictions
 */
export function calculateSimpleTankMetrics(
  storeName: string,
  tankId: number,
  logs: TankLog[],
  currentHeight: number,
  currentVolume: number
): SimpleTankMetrics {
  console.log(`🔧 Simple calculation for ${storeName} Tank ${tankId}: ${currentHeight}" height, ${logs.length} historical readings`);

  // Get business hours for this store
  const storeHours = ConfigService.getStoreHoursForStore(storeName);
  const openHour = storeHours?.open_hour || 5;
  const closeHour = storeHours?.close_hour || 23;

  // Core calculation: inches per hour from 4-week historical pattern
  const inchesPerHour = calculateInchesPerHourFromHistory(logs, openHour, closeHour);
  
  // Core prediction: hours to reach 10" using simple division
  const hoursTo10 = calculateHoursToTarget(currentHeight, 10, inchesPerHour);
  
  // Business hours adjusted prediction time
  const predictedTime = predictBusinessHourTime(hoursTo10, openHour, closeHour);
  
  // Simple status logic
  const status = getSimpleStatus(currentHeight, hoursTo10);
  
  // Get tank capacity from configuration
  const tankConfig = ConfigService.getTankConfiguration(storeName, tankId);
  const tankCapacity = tankConfig?.max_capacity_gallons || 10000; // Default to 10,000 gallons
  
  // Capacity percentage using configured tank capacity
  const capacityPercentage = (currentVolume / tankCapacity) * 100;

  const result: SimpleTankMetrics = {
    current_height_inches: currentHeight,
    current_volume_gallons: currentVolume,
    run_rate_inches_per_hour: inchesPerHour,
    hours_to_10_inches: hoursTo10,
    predicted_time_to_10in: predictedTime,
    status,
    capacity_percentage: Math.min(100, Math.max(0, capacityPercentage))
  };

  console.log(`✅ Simple metrics for ${storeName} Tank ${tankId}:`, {
    rate: `${inchesPerHour.toFixed(3)} in/hr`,
    hours: `${hoursTo10.toFixed(1)} hrs`,
    status
  });

  return result;
}

/**
 * Calculate inches per hour from 4 weeks of historical data
 * Uses hour-of-week segmentation and excludes deliveries
 */
function calculateInchesPerHourFromHistory(
  logs: TankLog[],
  openHour: number,
  closeHour: number
): number {
  if (!logs || logs.length < 10) {
    console.log('⚠️ Insufficient data, using default 0.1 in/hr');
    return 0.1;
  }

  try {
    // Filter to last 4 weeks, business hours only
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const businessLogs = logs.filter(log => {
      try {
        const logDate = new Date(log.timestamp);
        const hour = logDate.getHours();
        return (
          logDate >= fourWeeksAgo &&
          hour >= openHour && 
          hour < closeHour &&
          isFinite(log.height) && 
          log.height > 0 && 
          log.height <= 200
        );
      } catch {
        return false;
      }
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (businessLogs.length < 5) {
      console.log('⚠️ Insufficient business hour data');
      return 0.1;
    }

    // Remove delivery spikes
    const cleanLogs = removeDeliveries(businessLogs);
    
    if (cleanLogs.length < 3) {
      console.log('⚠️ Insufficient clean data after delivery removal');
      return 0.1;
    }

    // Calculate weighted average consumption rate by hour of week
    const hourOfWeekRates: { [hourOfWeek: number]: number[] } = {};

    for (let i = 1; i < cleanLogs.length; i++) {
      const current = cleanLogs[i];
      const previous = cleanLogs[i - 1];
      
      try {
        const currentDate = new Date(current.timestamp);
        const previousDate = new Date(previous.timestamp);
        
        const heightDrop = previous.height - current.height; // Positive = consumption
        const timeDelta = (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60);
        
        // Only count valid consumption periods
        if (heightDrop > 0 && timeDelta > 0.5 && timeDelta < 24) {
          const hourOfWeek = currentDate.getDay() * 24 + currentDate.getHours();
          
          if (!hourOfWeekRates[hourOfWeek]) {
            hourOfWeekRates[hourOfWeek] = [];
          }
          
          const inchesPerHour = heightDrop / timeDelta;
          if (inchesPerHour > 0 && inchesPerHour < 3) { // Reasonable bounds
            hourOfWeekRates[hourOfWeek].push(inchesPerHour);
          }
        }
      } catch {
        continue;
      }
    }

    // Calculate overall average from all hour-of-week segments
    let totalRate = 0;
    let totalReadings = 0;

    for (const hourOfWeek in hourOfWeekRates) {
      const rates = hourOfWeekRates[hourOfWeek];
      if (rates.length > 0) {
        const avgForHour = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
        totalRate += avgForHour * rates.length; // Weight by number of readings
        totalReadings += rates.length;
      }
    }

    if (totalReadings === 0) {
      console.log('⚠️ No valid consumption periods found');
      return 0.1;
    }

    const averageRate = totalRate / totalReadings;
    const clampedRate = Math.max(0.01, Math.min(2.0, averageRate));
    
    console.log(`📊 Historical rate: ${clampedRate.toFixed(3)} in/hr from ${totalReadings} readings across ${Object.keys(hourOfWeekRates).length} hour segments`);
    return clampedRate;

  } catch (error) {
    console.error('Error calculating historical rate:', error);
    return 0.1;
  }
}

/**
 * Remove delivery spikes from logs
 */
function removeDeliveries(logs: TankLog[]): TankLog[] {
  if (logs.length < 2) return logs;

  const cleaned = [logs[0]];
  
  for (let i = 1; i < logs.length; i++) {
    const current = logs[i];
    const previous = logs[i - 1];
    
    try {
      const heightIncrease = current.height - previous.height;
      const timeDelta = (new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()) / (1000 * 60 * 60);
      
      // Skip deliveries (large height increase in short time)
      if (heightIncrease > 8 && timeDelta < 4) {
        console.log(`🚛 Delivery detected: +${heightIncrease.toFixed(1)}" in ${timeDelta.toFixed(1)}hrs`);
        continue;
      }
      
      cleaned.push(current);
    } catch {
      cleaned.push(current);
    }
  }
  
  return cleaned;
}

/**
 * Calculate hours to reach target height (usually 10 inches)
 */
function calculateHoursToTarget(
  currentHeight: number,
  targetHeight: number,
  inchesPerHour: number
): number {
  if (!isFinite(currentHeight) || !isFinite(inchesPerHour) || inchesPerHour <= 0) {
    return 0;
  }

  if (currentHeight <= targetHeight) {
    return 0;
  }

  const inchesToDrop = currentHeight - targetHeight;
  const hours = inchesToDrop / inchesPerHour;

  return Math.max(0, hours);
}

/**
 * Predict when tank will reach target, adjusted for business hours
 */
function predictBusinessHourTime(
  hoursNeeded: number,
  openHour: number,
  closeHour: number
): string | null {
  if (!isFinite(hoursNeeded) || hoursNeeded <= 0) {
    return null;
  }

  try {
    const now = new Date();
    let currentTime = new Date(now);
    let remainingHours = hoursNeeded;

    // Walk forward hour by hour, only consuming fuel during business hours
    let iterations = 0;
    const maxIterations = Math.ceil(hoursNeeded * 2) + 168; // Safety limit

    while (remainingHours > 0 && iterations < maxIterations) {
      const currentHour = currentTime.getHours();
      
      // If we're in business hours, consume fuel
      if (currentHour >= openHour && currentHour < closeHour) {
        remainingHours -= 1;
      }
      
      // Move to next hour
      currentTime.setHours(currentTime.getHours() + 1);
      iterations++;
    }

    // If we end up outside business hours, snap to next business hour
    const finalHour = currentTime.getHours();
    if (finalHour < openHour || finalHour >= closeHour) {
      if (finalHour >= closeHour) {
        currentTime.setDate(currentTime.getDate() + 1);
      }
      currentTime.setHours(openHour, 0, 0, 0);
    }

    return currentTime.toISOString();

  } catch (error) {
    console.error('Error predicting business hour time:', error);
    return null;
  }
}

/**
 * Simple status determination
 */
function getSimpleStatus(
  currentHeight: number,
  hoursTo10: number
): 'normal' | 'warning' | 'critical' {
  // Critical: At/below 10" OR less than 24 hours to 10"
  if (currentHeight <= 10 || (hoursTo10 > 0 && hoursTo10 < 24)) {
    return 'critical';
  }
  
  // Warning: At/below 20" OR less than 48 hours to 10"
  if (currentHeight <= 20 || (hoursTo10 > 0 && hoursTo10 < 48)) {
    return 'warning';
  }
  
  return 'normal';
}

/**
 * Get current hour's expected consumption rate
 * Can be used for real-time predictions
 */
export function getCurrentHourRate(
  logs: TankLog[],
  storeName: string
): number {
  const storeHours = ConfigService.getStoreHoursForStore(storeName);
  const openHour = storeHours?.open_hour || 5;
  const closeHour = storeHours?.close_hour || 23;

  // Use the same calculation but focus on current hour of week
  const now = new Date();
  const currentHourOfWeek = now.getDay() * 24 + now.getHours();
  
  // For now, just return the overall rate
  // Could be enhanced to return hour-specific rate
  return calculateInchesPerHourFromHistory(logs, openHour, closeHour);
}

/**
 * Format display values
 */
export function formatSimpleMetrics(metrics: SimpleTankMetrics) {
  return {
    runRate: `${metrics.run_rate_inches_per_hour.toFixed(3)} in/hr`,
    hoursTo10: metrics.hours_to_10_inches > 0 ? `${metrics.hours_to_10_inches.toFixed(1)} hrs` : 'N/A',
    predictedTime: metrics.predicted_time_to_10in 
      ? new Date(metrics.predicted_time_to_10in).toLocaleString()
      : 'N/A',
    capacity: `${metrics.capacity_percentage.toFixed(1)}%`,
    status: metrics.status.toUpperCase()
  };
}