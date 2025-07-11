import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Tank } from '../types';
import { format } from 'date-fns';
import { ApiService } from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TankChartProps {
  tank: Tank;
  readOnly?: boolean;
}

export const TankChart: React.FC<TankChartProps> = ({ tank, readOnly = false }) => {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const [chartLogs, setChartLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch fresh chart data directly from API (no caching)
  useEffect(() => {
    const fetchChartData = async () => {
      if (!tank.latest_log?.store_name) {
        console.warn('No store name available for tank chart');
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        console.log(`📊 Fetching FRESH chart data for ${tank.latest_log.store_name} Tank ${tank.tank_id} (no cache)`);
        
        let logs: any[] = [];
        
        // Use direct API call to dashboard endpoint for fresh data
        try {
          // Fetch 7 days of sampled data directly from the dashboard API with cache busting
          const cacheBuster = Date.now();
          const response = await fetch(
            `https://central-tank-server.onrender.com/dashboard/stores/${tank.latest_log.store_name}/tanks/${tank.tank_id}/sampled?hours=168&sampling_rate=4&_t=${cacheBuster}`
          );
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          logs = data.logs || [];
          console.log(`📈 Retrieved ${logs.length} fresh sampled points directly from API (7 days)`);
        } catch (error) {
          console.warn('Direct API fetch failed, trying ApiService fallback:', error);
          
          try {
            // Fallback: Use ApiService but bypass any caching
            await ApiService.initialize();
            logs = await ApiService.getSampledTankData(tank.latest_log.store_name, tank.tank_id, 5, 'hourly');
            console.log(`📈 Retrieved ${logs.length} sampled points from ApiService fallback`);
          } catch (error) {
            console.error('All API calls failed, no synthetic data will be used:', error);
            throw new Error('Unable to fetch real chart data from any source');
          }
        }
        
        // Process and validate logs - handle both raw logs and sampled data formats
        const processedLogs = logs
          .map(log => {
            try {
              // Handle sampled data format (from /sampled endpoint) vs raw log format
              const isSampledData = 'hour_timestamp' in log || (!log.id && log.timestamp && log.volume && log.height);
              
              if (isSampledData) {
                // Sampled data format: {timestamp, volume, height}
                return {
                  id: 0,
                  store_name: tank.latest_log?.store_name || '',
                  tank_id: tank.tank_id,
                  product: tank.product || tank.tank_name || '',
                  volume: Number(log.volume) || 0,
                  tc_volume: Number(log.volume) || 0, // Use volume for sampled data
                  ullage: 0, // Not available in sampled data
                  height: Number(log.height) || 0,
                  water: 0, // Not available in sampled data
                  temp: 70, // Default temp for sampled data
                  timestamp: log.timestamp || log.hour_timestamp || new Date().toISOString(),
                };
              } else {
                // Raw log format: full log data
                return {
                  id: log.id || 0,
                  store_name: log.store_name || tank.latest_log?.store_name || '',
                  tank_id: log.tank_id || tank.tank_id,
                  product: log.product || tank.product || tank.tank_name || '',
                  volume: Number(log.volume) || 0,
                  tc_volume: Number(log.tc_volume) || 0,
                  ullage: Number(log.ullage) || 0,
                  height: Number(log.height) || 0,
                  water: Number(log.water) || 0,
                  temp: Number(log.temp) || 70,
                  timestamp: log.timestamp || log.recorded_at || new Date().toISOString(),
                };
              }
            } catch (error) {
              console.warn('Error processing log entry:', error);
              return null;
            }
          })
          .filter((log): log is any => log !== null && (log.tc_volume > 0 || log.volume > 0) && log.height > 0)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        if (processedLogs.length === 0) {
          throw new Error('No valid chart data available');
        }

        setChartLogs(processedLogs);
        console.log(`✅ Chart data loaded: ${processedLogs.length} valid readings`);
        
      } catch (error) {
        console.error(`❌ Failed to fetch chart data for Tank ${tank.tank_id}:`, error);
        setError(`Unable to load chart data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setChartLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [tank.tank_id, tank.latest_log?.store_name, tank.product, tank.latest_log?.timestamp]);


  if (loading) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
        <p className="text-slate-400">Loading chart data for {tank.tank_name}...</p>
        <p className="text-slate-500 text-xs mt-1">Fetching historical readings...</p>
      </div>
    );
  }

  if (error && chartLogs.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 text-center">
        <div className="text-slate-400 mb-4">
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
            ⚠️
          </div>
          <p className="font-medium">Chart Data Unavailable</p>
          <p className="text-sm text-slate-500 mt-1">
            {error}
          </p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">
            Charts require historical tank readings. This may be due to:
            • Limited historical data available
            • Network connectivity issues
            • Tank recently added to system
          </p>
        </div>
      </div>
    );
  }

  if (chartLogs.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 text-center">
        <div className="text-slate-400 mb-4">
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
            📊
          </div>
          <p className="font-medium">No Chart Data Available</p>
          <p className="text-sm text-slate-500 mt-1">
            No historical data found for {tank.tank_name}
          </p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">
            Charts require at least a few hours of historical tank readings. 
            Data may not be available yet or the tank may be newly configured.
          </p>
        </div>
      </div>
    );
  }

  // Generate labels with appropriate frequency
  const labels = chartLogs.map(log => {
    try {
      const date = new Date(log.timestamp);
      if (chartLogs.length > 100) {
        // For lots of data, show date and hour
        return format(date, 'MM/dd HH:mm');
      } else if (chartLogs.length > 24) {
        // For moderate data, show day and time
        return format(date, 'dd HH:mm');
      } else {
        // For limited data, show full time
        return format(date, 'HH:mm');
      }
    } catch {
      return 'Invalid Date';
    }
  });

  // Get tank configuration from server (has actual capacity set in admin UI)
  const criticalHeight = tank.configuration?.critical_height_inches || tank.profile?.critical_height_inches || 10;
  const maxCapacity = tank.configuration?.max_capacity_gallons || tank.profile?.max_capacity_gallons || 10000;
  
  // Get 48-hour prediction from server analytics
  const predicted48hHeight = tank.analytics?.predicted_height_48h;

  const data = {
    labels,
    datasets: [
      {
        label: 'Product Height (in)',
        data: chartLogs.map(log => log.height),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.1,
        pointRadius: chartLogs.length > 50 ? 0 : 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        yAxisID: 'y',
      },
      {
        label: 'TC Volume (gal)',
        data: chartLogs.map(log => log.tc_volume),
        borderColor: 'rgb(14, 165, 233)',
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        fill: false,
        tension: 0.1,
        pointRadius: chartLogs.length > 50 ? 0 : 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        yAxisID: 'y1',
      },
      // 48-Hour Prediction Line (only show if valid prediction exists)
      ...(predicted48hHeight !== null && predicted48hHeight !== undefined && predicted48hHeight > 0 ? [{
        label: '48h Prediction',
        data: new Array(chartLogs.length).fill(predicted48hHeight),
        borderColor: 'rgb(251, 146, 60)', // Orange color
        backgroundColor: 'rgba(251, 146, 60, 0.1)',
        fill: false,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 2,
        borderDash: [12, 6],
        yAxisID: 'y',
      }] : []),
      // Critical Level Line at 10"
      {
        label: 'Critical Level (10")',
        data: new Array(chartLogs.length).fill(criticalHeight),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: false,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 2,
        borderDash: [5, 5],
        yAxisID: 'y',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0, // Disable animations for better performance
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgb(148, 163, 184)',
          filter: function(legendItem: any) {
            return true;
          }
        },
      },
      title: {
        display: true,
        text: `${tank.tank_name} - Historical Trend${readOnly ? ' (Read Only)' : ''}`,
        color: 'rgb(226, 232, 240)',
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        titleColor: 'rgb(226, 232, 240)',
        bodyColor: 'rgb(148, 163, 184)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
        filter: function(tooltipItem: any) {
          // Don't show tooltip for the warning and critical level lines
          return tooltipItem.datasetIndex !== 2 && tooltipItem.datasetIndex !== 3;
        },
        callbacks: {
          afterBody: (context: any) => {
            const dataIndex = context[0]?.dataIndex;
            if (dataIndex !== undefined && chartLogs[dataIndex]) {
              const log = chartLogs[dataIndex];
              const capacityPct = tank.profile ? 
                ((log.tc_volume / tank.profile.max_capacity_gallons) * 100).toFixed(1) : 
                'N/A';
              return [
                `Temperature: ${log.temp?.toFixed(1)}°F`,
                `Water: ${log.water?.toFixed(2)}"`,
                `Ullage: ${log.ullage?.toLocaleString()} gal`,
                `Capacity: ${capacityPct}%`
              ];
            }
            return [];
          }
        }
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: 'rgba(71, 85, 105, 0.3)',
        },
        ticks: {
          color: 'rgb(148, 163, 184)',
          maxTicksLimit: Math.min(20, Math.max(5, Math.floor(chartLogs.length / 5))),
          callback: function(value: any, index: number) {
            // Show every nth tick based on data density
            const skipFactor = Math.max(1, Math.floor(chartLogs.length / 15));
            if (index % skipFactor === 0) {
              return this.getLabelForValue(value);
            }
            return '';
          }
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Product Height (inches)',
          color: 'rgb(59, 130, 246)',
        },
        grid: {
          color: 'rgba(71, 85, 105, 0.3)',
        },
        ticks: {
          color: 'rgb(59, 130, 246)',
          callback: function(value: any) {
            return typeof value === 'number' ? `${value.toFixed(1)}"` : value;
          }
        },
        min: 0,
        max: 100, // Max height in inches - no need for diameter calculations
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'TC Volume (gal)',
          color: 'rgb(14, 165, 233)',
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: 'rgb(14, 165, 233)',
          callback: function(value: any) {
            return typeof value === 'number' ? value.toLocaleString() : value;
          }
        },
        min: 0,
        max: maxCapacity,
      },
    },
  };

  // Determine data period for display
  const getDataPeriod = () => {
    if (chartLogs.length === 0) return 'No data';
    
    const firstLog = chartLogs[0];
    const lastLog = chartLogs[chartLogs.length - 1];
    
    try {
      const firstDate = new Date(firstLog.timestamp);
      const lastDate = new Date(lastLog.timestamp);
      const hoursDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff >= 96) return '5+ days';
      if (hoursDiff >= 48) return '2-3 days';
      if (hoursDiff >= 24) return '1-2 days';
      return `${Math.round(hoursDiff)} hours`;
    } catch {
      return 'Historical';
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div style={{ height: '350px' }}>
        <Line ref={chartRef} data={data} options={options} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
        <div className="text-slate-400">
          <div className="flex justify-between">
            <span>Tank Capacity:</span>
            <span className="text-white">{maxCapacity.toLocaleString()} gal</span>
          </div>
          <div className="flex justify-between">
            <span>Current Height:</span>
            <span className="text-blue-400">
              {tank.latest_log?.height?.toFixed(1) || 'N/A'}"
            </span>
          </div>
          {tank.run_rate && tank.run_rate > 0 && (
            <div className="flex justify-between">
              <span>Run Rate:</span>
              <span className="text-green-400">{tank.run_rate.toFixed(2)} in/hr</span>
            </div>
          )}
        </div>
        <div className="text-slate-400">
          <div className="flex justify-between">
            <span>Critical Level:</span>
            <span className="text-red-400">{criticalHeight}" (Red Line)</span>
          </div>
          {tank.hours_to_10_inches && tank.hours_to_10_inches > 0 && (
            <div className="flex justify-between">
              <span>Hours to 10":</span>
              <span className="text-orange-400">{tank.hours_to_10_inches.toFixed(1)} hrs</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-400 text-center">
        Showing {getDataPeriod()} of data ({chartLogs.length} readings) • Capacity: {maxCapacity.toLocaleString()} gal
        {readOnly && <span className="text-yellow-400 ml-2">• READ ONLY VIEW</span>}
      </div>
    </div>
  );
};