import React from 'react';
import { Tank } from '../types';
import { AlertTriangle, AlertCircle, CheckCircle, Thermometer, Droplets, Gauge } from 'lucide-react';
import { format } from 'date-fns';

interface TankTableProps {
  tanks: Tank[];
}

export const TankTable: React.FC<TankTableProps> = ({ tanks }) => {
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

  // Calculate 90% ullage safely
  const calculate90PercentUllage = (ullage: number | undefined): number => {
    if (!ullage || isNaN(ullage)) return 0;
    return ullage * 0.9;
  };

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-700">
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-200">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-200">Tank</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-200">Product</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-200">TC Volume</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-200">Capacity Used</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-200">90% Ullage</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-200">Height</th>
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
                  <div className="font-medium text-white">{tank.tank_name}</div>
                  <div className="text-sm text-slate-400">
                    Tank {tank.tank_id} • {tank.profile?.max_capacity_gallons?.toLocaleString() || 'N/A'} gal
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-300">{tank.product}</span>
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
                    {formatValue(calculate90PercentUllage(tank.latest_log?.ullage))}
                  </span>
                  <span className="text-slate-400 text-sm ml-1">gal</span>
                  <div className="text-xs text-slate-500 mt-1">
                    90% of {formatValue(tank.latest_log?.ullage)} gal
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <Droplets className="w-4 h-4 text-blue-400" />
                    <span className="text-white font-mono">
                      {formatValue(tank.latest_log?.height, 1)}
                    </span>
                    <span className="text-slate-400 text-sm">in</span>
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
                    {formatValue(tank.hours_to_10_inches, 1)}
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
                  <span className="text-slate-400 text-sm">
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
          <strong>Tank Specifications:</strong> All tanks are {tanks[0]?.profile?.diameter_inches || 96}" diameter × {tanks[0]?.profile?.length_inches || 319.3}" length • 
          Critical alert at 10" height • Warning alert at 20\" height • 
          Run rates calculated using business hours only (5 AM - 11 PM) • 
          <strong>90% Ullage:</strong> Displays 90% of actual ullage for conservative capacity planning and safety margins
        </div>
      </div>
    </div>
  );
};