import React from 'react';
import { Tank } from '../types';
import { AlertTriangle, AlertCircle, CheckCircle, Thermometer, Droplets, Gauge } from 'lucide-react';
import { format } from 'date-fns';

interface TankTableProps {
  tanks: Tank[];
}

export const TankTable: React.FC<TankTableProps> = ({ tanks }) => {
  // Grid debugging removed - working perfectly now!
  // CRITICAL: display_alias should override tank_name - v2
  
  // Debug: Log tank data to verify display_alias is received
  React.useEffect(() => {
    if (tanks.length > 0) {
      console.log('🔍 TankTable received tanks:', tanks.map(t => ({
        id: t.tank_id,
        name: t.tank_name,
        alias: t.display_alias,
        ullage90: t.ninety_percent_ullage
      })));
    }
  }, [tanks]);

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'normal':
      default:
        return <CheckCircle className="w-5 h-5 text-green-400" />;
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'critical':
        return 'bg-red-900/20 border-red-500/30';
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-500/30';
      case 'normal':
      default:
        return 'bg-green-900/20 border-green-500/30';
    }
  };

  const formatValue = (value: number | undefined, decimals: number = 0): string => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
  };

  const formatHoursTo10Inches = (hours: number | undefined): string => {
    if (hours === undefined || hours === null || isNaN(hours)) return 'N/A';
    
    // Handle zero or negative (tank not consuming)
    if (hours <= 0) return 'N/A';
    
    // For very large numbers, round to nearest 1000 and show appropriately
    if (hours >= 10000) {
      const rounded = Math.round(hours / 1000) * 1000;
      return `~${(rounded / 8760).toFixed(1)} years`;
    }
    
    // For more than 30 days, show in days
    if (hours > 720) {
      return `${Math.round(hours / 24)} days`;
    }
    
    // Normal hours display
    return hours.toFixed(1);
  };

  // Enhanced run rate formatting to show proper precision
  const formatRunRate = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    
    // For run rates, show 1 decimal place but ensure we don't lose precision
    if (value >= 10) {
      return value.toFixed(1); // 22.0 gal/hr
    } else if (value >= 1) {
      return value.toFixed(1); // 2.1 gal/hr  
    } else {
      return value.toFixed(2); // 0.50 gal/hr
    }
  };

  const formatPredictedTime = (timestamp: string | undefined): string => {
    if (!timestamp) return 'N/A';
    try {
      return format(new Date(timestamp), 'MM/dd/yyyy hh:mm a');
    } catch {
      return 'N/A';
    }
  };

  const getCapacityColor = (percentage: number): string => {
    if (percentage < 20) return 'text-red-400';
    if (percentage < 40) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getTimestampColor = (timestamp: string | undefined): string => {
    if (!timestamp) return 'text-slate-400';
    try {
      const lastUpdate = new Date(timestamp);
      const now = new Date();
      const hoursAgo = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

      if (hoursAgo >= 48) return 'text-red-400 font-semibold'; // Red if 48+ hours
      if (hoursAgo >= 24) return 'text-yellow-400 font-semibold'; // Yellow if 24+ hours
      return 'text-slate-400'; // Normal if fresh
    } catch {
      return 'text-slate-400';
    }
  };

  // Calculate max fill ullage based on tank configuration
  // FIXED: Calculate remaining ullage space when tank reaches max fill percentage
  const calculateMaxFillUllage = (tank: Tank): number => {
    const maxCapacity = tank.configuration?.max_capacity_gallons || tank.profile?.max_capacity_gallons || 10000;
    const currentVolume = tank.latest_log?.tc_volume || 0;
    const maxFillPercentage = tank.configuration?.max_fill_ullage_percentage || 90.0;
    
    // CORRECT: (capacity * percentage) - current_volume
    const maxFillVolume = maxCapacity * (maxFillPercentage / 100);
    const remainingUllageAtMaxFill = maxFillVolume - currentVolume;
    
    return Math.max(0, remainingUllageAtMaxFill);
  };

  // Get max fill percentage for display
  const getMaxFillPercentage = (tank: Tank): number => {
    return tank.configuration?.max_fill_ullage_percentage || 90.0;
  };

  // Calculate available ullage - how much fuel can safely be added
  const calculateAvailableUllage = (tank: Tank): number => {
    // Use the ninety_percent_ullage value from the backend if available
    // This is already calculated correctly on the backend as: (capacity * fill%) - current_volume
    if (tank.ninety_percent_ullage !== undefined && tank.ninety_percent_ullage !== null) {
      return tank.ninety_percent_ullage;
    }

    // Fallback to correct local calculation if backend value not available
    const maxCapacity = tank.configuration?.max_capacity_gallons || tank.profile?.max_capacity_gallons || 10000;
    const currentVolume = tank.latest_log?.tc_volume || tank.latest_log?.volume || 0;
    const maxFillPercentage = tank.configuration?.max_fill_ullage_percentage || 90.0;

    // CORRECT formula: (capacity * percentage) - current_volume
    const maxFillVolume = maxCapacity * (maxFillPercentage / 100);
    const remainingUllageAtMaxFill = maxFillVolume - currentVolume;

    return Math.max(0, remainingUllageAtMaxFill);
  };

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-700">
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-200">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-200">Tank</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-200">TC Volume</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-200">Capacity Used</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-200">Available Ullage</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-200">Current Height</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-200">Run Rate</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-200">Hours to 10"</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-200">Predicted Time</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-slate-200">Temp</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-200">Last Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {tanks.map((tank) => (
              <tr
                key={tank.tank_id}
                className={`border-l-4 ${getStatusColor(tank.status)} hover:bg-slate-700/50 transition-colors`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(tank.status)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{tank.display_alias || tank.tank_name}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-white font-mono">
                    {formatValue(tank.latest_log?.tc_volume)}
                  </span>
                  <span className="text-slate-400 text-sm ml-1">gal</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <Gauge className="w-4 h-4 text-blue-400" />
                    <span className={`font-mono ${getCapacityColor(tank.capacity_percentage || 0)}`}>
                      {formatValue(tank.capacity_percentage, 1)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-slate-300 font-mono">
                    {formatValue(calculateAvailableUllage(tank))}
                  </span>
                  <span className="text-slate-400 text-sm ml-1">gal</span>
                  <div className="text-xs text-slate-500 mt-1">
                    Safe fill at {getMaxFillPercentage(tank)}%
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-cyan-400 font-mono text-lg">
                    {formatValue(tank.latest_log?.height, 1)}
                  </span>
                  <span className="text-slate-400 text-sm ml-1">in</span>
                  <div className="text-xs text-slate-500 mt-1">
                    To 10": {tank.latest_log?.height ? (tank.latest_log.height - 10).toFixed(1) : 'N/A'}"
                  </div>
                  {tank.latest_log?.height && tank.latest_log.height < 20 && (
                    <div className="text-xs text-yellow-400 mt-1">
                      ⚠️ Below 20"
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-slate-300 font-mono">
                    {formatRunRate(tank.run_rate)}
                  </span>
                  <span className="text-slate-400 text-sm ml-1">gal/hr</span>
                  <div className="text-xs text-slate-500 mt-1">
                    Business hrs only
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-mono ${
                    tank.hours_to_10_inches && tank.hours_to_10_inches < 24 
                      ? 'text-red-400' 
                      : tank.hours_to_10_inches && tank.hours_to_10_inches < 48
                      ? 'text-yellow-400'
                      : 'text-slate-300'
                  }`}>
                    {formatHoursTo10Inches(tank.hours_to_10_inches)}
                  </span>
                  <span className="text-slate-400 text-sm ml-1">hrs</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-300 text-sm">
                    {formatPredictedTime(tank.predicted_time)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <Thermometer className="w-4 h-4 text-orange-400" />
                    <span className="text-slate-300 text-sm">
                      {formatValue(tank.latest_log?.temp, 1)}°F
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm ${getTimestampColor(tank.latest_log?.timestamp)}`}>
                    {tank.latest_log?.timestamp
                      ? format(new Date(tank.latest_log.timestamp), 'MM/dd hh:mm a')
                      : 'N/A'
                    }
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Tank Profile Summary */}
      <div className="bg-slate-700/50 px-4 py-3 border-t border-slate-600">
        <div className="text-xs text-slate-400">
          <strong>Tank Specifications:</strong> Critical alert at 10" height • Warning alert at 20\" height • 
          Run rates calculated using business hours only (5 AM - 11 PM) • 
          <strong>Available Ullage:</strong> Safe fuel capacity based on configured max fill percentage (set in admin panel)
        </div>
      </div>
    </div>
  );
};