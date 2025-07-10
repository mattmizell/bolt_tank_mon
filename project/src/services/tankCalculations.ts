// Industry-Standard Tank Calculations for Fuel Operations
// Focus on operational needs: current level, usage patterns, and refill timing

import { TankLog } from '../types';
import { ConfigService } from './configService';

export interface TankMetrics {
  current_height_inches: number;
  usage_rate_inches_per_hour: number;
  hours_to_10_inches: number;
  predicted_time_to_10in: string | null;
  status: 'normal' | 'warning' | 'critical';
  capacity_percentage: number;
}

/**
 * Calculate tank metrics using industry-standard fuel operations approach
 * Based on historical inch readings and usage patterns, not tank geometry
 */
export function calculateTankMetrics(
  storeName: string,
  tankId: number,
  logs: TankLog[],
  currentHeight: number,
  currentVolume: number
): TankMetrics {
  console.log(`📊 Calculating metrics for ${storeName} Tank ${tankId}:`, {
    logsCount: logs.length,
    currentHeight,
    currentVolume
  });

  // Get business hours for this store
  const storeHours = ConfigService.getStoreHoursForStore(storeName);
  const openHour = storeHours?.open_hour || 5;
  const closeHour = storeHours?.close_hour || 23;

  // Calculate usage rate in inches per hour using 4-week historical data
  const usageRate = calculateUsageRateInchesPerHour(logs, openHour, closeHour);
  
  // Calculate hours to critical level (10 inches) using crawling average
  const hoursTo10 = calculateHoursTo10Inches(currentHeight, usageRate);
  
  // Predict time to 10 inches with business hour adjustment
  const predictedTime = predictTimeToEmpty(hoursTo10, openHour, closeHour);
  
  // Determine tank status
  const status = getTankStatus(currentHeight, hoursTo10);
  
  // Calculate capacity percentage (simplified - based on typical tank capacity)
  const capacityPercentage = calculateCapacityPercentage(currentVolume);

  console.log(`✅ Calculated metrics for ${storeName} Tank ${tankId}:`, {
    usageRate: `${usageRate.toFixed(3)} in/hr`,
    hoursTo10: `${hoursTo10.toFixed(1)} hrs`,
    status,
    capacityPercentage: `${capacityPercentage.toFixed(1)}%`
  });

  return {
    current_height_inches: currentHeight,
    usage_rate_inches_per_hour: usageRate,
    hours_to_10_inches: hoursTo10,
    predicted_time_to_10in: predictedTime,
    status,
    capacity_percentage: capacityPercentage
  };
}

/**
 * Calculate usage rate in inches per hour using 4 weeks of historical data
 * Segmented by hour of week, excluding delivery windows
 */
function calculateUsageRateInchesPerHour(
  logs: TankLog[],
  openHour: number,
  closeHour: number
): number {
  if (!logs || logs.length < 10) {
    console.log('⚠️ Insufficient data for usage rate calculation, using default');
    return 0.1; // Default conservative rate
  }

  try {
    // Filter to business hours only and last 4 weeks
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const businessHourLogs = logs.filter(log => {
      try {
        const logDate = new Date(log.timestamp);
        const hour = logDate.getHours();
        const isBusinessHour = hour >= openHour && hour < closeHour;
        const isRecent = logDate >= fourWeeksAgo;
        const hasValidHeight = isFinite(log.height) && log.height > 0 && log.height <= 200;
        
        return isBusinessHour && isRecent && hasValidHeight;
      } catch {
        return false;
      }
    });

    if (businessHourLogs.length < 5) {
      console.log('⚠️ Insufficient business hour data, using default rate');
      return 0.1;
    }

    // Remove delivery spikes (large increases in height)
    const cleanedLogs = removeDeliverySpikes(businessHourLogs);
    
    if (cleanedLogs.length < 3) {
      console.log('⚠️ Insufficient clean data after delivery removal');
      return 0.1;
    }

    // Calculate average inch drop per hour segmented by hour of week
    const usageRate = calculateHourOfWeekAverages(cleanedLogs);
    
    // Validate and clamp the result
    if (!isFinite(usageRate) || usageRate < 0) {
      console.log('⚠️ Invalid usage rate calculated, using default');
      return 0.1;
    }

    // Clamp to reasonable range (0.01 to 2 inches per hour)
    const clampedRate = Math.max(0.01, Math.min(2.0, usageRate));
    
    console.log(`📈 Usage rate calculated: ${clampedRate.toFixed(3)} inches/hour`);
    return clampedRate;

  } catch (error) {
    console.error('Error calculating usage rate:', error);
    return 0.1;
  }
}

/**
 * Remove delivery spikes from logs (large increases in height)
 */
function removeDeliverySpikes(logs: TankLog[]): TankLog[] {
  if (logs.length < 2) return logs;

  const cleaned = [logs[0]];
  
  for (let i = 1; i < logs.length; i++) {
    const current = logs[i];
    const previous = logs[i - 1];
    
    try {
      const heightDelta = current.height - previous.height;
      const timeDelta = (new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()) / (1000 * 60 * 60);
      
      // Skip obvious deliveries (large height increase in short time)
      if (heightDelta > 10 && timeDelta < 4) {
        console.log(`🚛 Delivery detected: +${heightDelta.toFixed(1)}" in ${timeDelta.toFixed(1)}hrs`);
        continue;
      }
      
      cleaned.push(current);
    } catch {
      cleaned.push(current);
    }
  }
  
  console.log(`🧹 Cleaned logs: ${logs.length} → ${cleaned.length} (removed ${logs.length - cleaned.length} delivery spikes)`);
  return cleaned;
}

/**
 * Calculate average inch drop per hour segmented by hour of week
 * This provides more accurate predictions based on usage patterns
 */
function calculateHourOfWeekAverages(logs: TankLog[]): number {
  if (logs.length < 2) return 0.1;

  try {
    // Sort by timestamp to ensure proper order
    const sortedLogs = logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Group by hour of week (0-167: Sunday 0AM = 0, Saturday 11PM = 167)
    const hourOfWeekData: { [key: number]: { drops: number[], totalHours: number } } = {};

    // Calculate inch drop between consecutive readings
    for (let i = 1; i < sortedLogs.length; i++) {
      const current = sortedLogs[i];
      const previous = sortedLogs[i - 1];
      
      try {
        const currentDate = new Date(current.timestamp);
        const previousDate = new Date(previous.timestamp);
        
        const heightDrop = previous.height - current.height; // Positive = consumption
        const timeDelta = (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60);
        
        // Only count valid consumption periods
        if (heightDrop > 0 && timeDelta > 0 && timeDelta < 24) {
          const hourOfWeek = currentDate.getDay() * 24 + currentDate.getHours();
          
          if (!hourOfWeekData[hourOfWeek]) {
            hourOfWeekData[hourOfWeek] = { drops: [], totalHours: 0 };
          }
          
          const dropRate = heightDrop / timeDelta;
          hourOfWeekData[hourOfWeek].drops.push(dropRate);
          hourOfWeekData[hourOfWeek].totalHours += timeDelta;
        }
      } catch {
        continue;
      }
    }

    // Calculate weighted average across all hour-of-week segments
    let totalWeightedRate = 0;
    let totalWeight = 0;

    for (const hourOfWeek in hourOfWeekData) {
      const data = hourOfWeekData[hourOfWeek];
      if (data.drops.length > 0) {
        // Average rate for this hour of week
        const avgRate = data.drops.reduce((sum, rate) => sum + rate, 0) / data.drops.length;
        const weight = data.totalHours; // Weight by total hours of data
        
        totalWeightedRate += avgRate * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) {
      console.log('⚠️ No valid hour-of-week data found');
      return 0.1;
    }

    const averageRate = totalWeightedRate / totalWeight;
    console.log(`📊 Hour-of-week usage calculation: ${averageRate.toFixed(3)} in/hr (${Object.keys(hourOfWeekData).length} hour segments)`);
    
    return averageRate;

  } catch (error) {
    console.error('Error in hour-of-week calculation:', error);
    return 0.1;
  }
}

/**
 * Calculate hours until tank reaches 10 inches using crawling average
 * Walk forward hour by hour using historical average inch drop
 */
function calculateHoursTo10Inches(currentHeight: number, usageRateInchesPerHour: number): number {
  if (!isFinite(currentHeight) || !isFinite(usageRateInchesPerHour) || usageRateInchesPerHour <= 0) {
    return 0;
  }

  if (currentHeight <= 10) {
    return 0; // Already at or below critical level
  }

  // Simple calculation: inches to drop divided by usage rate
  const inchesToDrop = currentHeight - 10;
  const hoursToEmpty = inchesToDrop / usageRateInchesPerHour;

  return Math.max(0, hoursToEmpty);
}

/**
 * Predict time to reach 10 inches, snapped to business hours
 * Walk forward hour by hour, only counting business hours
 */
function predictTimeToEmpty(
  hoursToEmpty: number,
  openHour: number,
  closeHour: number
): string | null {
  if (!isFinite(hoursToEmpty) || hoursToEmpty <= 0) {
    return null;
  }

  try {
    const now = new Date();
    let currentTime = new Date(now);
    let remainingHours = hoursToEmpty;

    // Walk forward hour by hour, only counting business hours
    while (remainingHours > 0) {
      const currentHour = currentTime.getHours();
      
      // If we're in business hours, count this hour
      if (currentHour >= openHour && currentHour < closeHour) {
        remainingHours -= 1;
      }
      
      // Move to next hour
      currentTime.setHours(currentTime.getHours() + 1);
      
      // Safety check to prevent infinite loops
      if (currentTime.getTime() - now.getTime() > 365 * 24 * 60 * 60 * 1000) {
        console.warn('Prediction calculation exceeded 1 year, stopping');
        break;
      }
    }

    // If predicted time is outside business hours, snap to next open hour
    const finalHour = currentTime.getHours();
    if (finalHour < openHour || finalHour >= closeHour) {
      // Snap to next business day opening
      if (finalHour >= closeHour) {
        currentTime.setDate(currentTime.getDate() + 1);
      }
      currentTime.setHours(openHour, 0, 0, 0);
    }

    return currentTime.toISOString();

  } catch (error) {
    console.error('Error predicting empty time:', error);
    return null;
  }
}

/**
 * Determine tank status based on height and time to empty
 */
function getTankStatus(currentHeight: number, hoursToEmpty: number): 'normal' | 'warning' | 'critical' {
  // Critical: At or below 10 inches OR less than 48 hours to empty
  if (currentHeight <= 10 || (hoursToEmpty > 0 && hoursToEmpty < 48)) {
    return 'critical';
  }
  
  // Warning: Below 20 inches OR less than 72 hours to empty
  if (currentHeight <= 20 || (hoursToEmpty > 0 && hoursToEmpty < 72)) {
    return 'warning';
  }
  
  return 'normal';
}

/**
 * Calculate capacity percentage (simplified approach)
 */
function calculateCapacityPercentage(currentVolume: number): number {
  if (!isFinite(currentVolume) || currentVolume <= 0) {
    return 0;
  }

  // Use typical tank capacity of 10000 gallons
  // This is simplified - in production you might want to configure this per tank
  const typicalCapacity = 10000;
  const percentage = (currentVolume / typicalCapacity) * 100;
  
  return Math.min(100, Math.max(0, percentage));
}

/**
 * Format hours to empty for display
 */
export function formatHoursToEmpty(hours: number): string {
  if (!isFinite(hours) || hours <= 0) {
    return 'N/A';
  }

  if (hours < 24) {
    return `${hours.toFixed(1)} hrs`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours.toFixed(0)}h`;
  }
}

/**
 * Format predicted time for display
 */
export function formatPredictedTime(timestamp: string | null): string {
  if (!timestamp) {
    return 'N/A';
  }

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 168) { // Less than a week
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  } catch {
    return 'N/A';
  }
}