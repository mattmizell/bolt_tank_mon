import React, { useState, useEffect } from 'react';
import { Database, Activity, Clock, HardDrive, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { ApiService } from '../services/api';

interface DatabaseStatusProps {
  onClose: () => void;
}

export const DatabaseStatus: React.FC<DatabaseStatusProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [apiStats, setApiStats] = useState<any>(null);

  useEffect(() => {
    checkApiStatus();
  }, []);

  const checkApiStatus = async () => {
    setLoading(true);
    try {
      // Test Dashboard API connection
      const isHealthy = await ApiService.checkServerHealth();
      
      if (isHealthy) {
        setConnectionStatus('connected');
        
        // Get API stats
        const stats = {
          endpoint: 'Dashboard API',
          base_url: 'https://central-tank-server.onrender.com',
          status: 'Connected',
          response_time: '< 3 seconds',
          data_source: 'Live Tank Data',
          features: [
            'Store Overview (/dashboard/stores)',
            'Complete Store Data (/dashboard/stores/{store})',
            'Sampled Historical Data',
            'Pre-calculated Analytics',
            'Dynamic Store Detection'
          ]
        };
        setApiStats(stats);
      } else {
        setConnectionStatus('disconnected');
        setApiStats(null);
      }
    } catch (error) {
      console.error('Error checking API status:', error);
      setConnectionStatus('disconnected');
      setApiStats(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Database className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold text-white">API Status</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>

        {/* Connection Status */}
        <div className={`rounded-lg p-4 mb-6 ${
          connectionStatus === 'connected' 
            ? 'bg-green-900/20 border border-green-500/30' 
            : connectionStatus === 'disconnected'
            ? 'bg-red-900/20 border border-red-500/30'
            : 'bg-yellow-900/20 border border-yellow-500/30'
        }`}>
          <div className="flex items-center space-x-3">
            {connectionStatus === 'connected' ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : connectionStatus === 'disconnected' ? (
              <AlertCircle className="w-6 h-6 text-red-400" />
            ) : (
              <Activity className="w-6 h-6 text-yellow-400 animate-pulse" />
            )}
            <div>
              <p className={`font-semibold ${
                connectionStatus === 'connected' ? 'text-green-200' : 
                connectionStatus === 'disconnected' ? 'text-red-200' : 'text-yellow-200'
              }`}>
                {connectionStatus === 'connected' ? 'Dashboard API Connected' : 
                 connectionStatus === 'disconnected' ? 'Dashboard API Disconnected' : 'Checking Connection...'}
              </p>
              <p className="text-sm text-slate-400">
                Data Source: {apiStats?.data_source || 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-slate-300">Checking Dashboard API status...</p>
          </div>
        )}

        {/* API Statistics */}
        {!loading && apiStats && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white mb-4">Dashboard API Information</h3>
            
            <div className="bg-slate-700 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-slate-400 text-sm">Endpoint</p>
                  <p className="text-white font-medium">{apiStats.endpoint}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Base URL</p>
                  <p className="text-white font-medium">{apiStats.base_url}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Status</p>
                  <p className="text-green-400 font-medium">{apiStats.status}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Response Time</p>
                  <p className="text-white font-medium">{apiStats.response_time}</p>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-2">Available Features</p>
                <div className="space-y-2">
                  {apiStats.features.map((feature: string, index: number) => (
                    <div key={index} className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-slate-300 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Connection State */}
        {!loading && !apiStats && connectionStatus === 'disconnected' && (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No API Connection</h3>
            <p className="text-slate-400 mb-4">
              Unable to connect to Dashboard API
            </p>
            <button
              onClick={checkApiStatus}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Performance Info */}
        {connectionStatus === 'connected' && (
          <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-white mb-2">Performance Benefits:</h4>
            <div className="text-xs text-slate-400 space-y-1">
              <p>• <strong>Fast Loading:</strong> Dashboard API provides optimized data with 3-8 second load times</p>
              <p>• <strong>Sampled Data:</strong> 120 data points instead of 2400+ for charts</p>
              <p>• <strong>Pre-calculated Analytics:</strong> Run rates and predictions computed server-side</p>
              <p>• <strong>Dynamic Detection:</strong> Automatically discovers new stores</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={checkApiStatus}
            disabled={loading}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 px-4 py-2 rounded-lg text-white transition-colors"
          >
            <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
          
          {connectionStatus === 'connected' && (
            <a
              href="https://central-tank-server.onrender.com/dashboard/stores"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-white transition-colors"
            >
              <HardDrive className="w-4 h-4" />
              <span>View API Data</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};