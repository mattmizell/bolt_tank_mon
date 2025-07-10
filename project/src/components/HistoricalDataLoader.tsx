import React, { useState, useEffect } from 'react';
import { HistoricalDataLoader } from '../services/historicalDataLoader';
import { Download, Database, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface HistoricalDataLoaderProps {
  onComplete?: (success: boolean, totalLogs: number) => void;
  onClose?: () => void;
}

export const HistoricalDataLoaderComponent: React.FC<HistoricalDataLoaderProps> = ({ 
  onComplete, 
  onClose 
}) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string; totalLogs: number } | null>(null);
  const [dataCheck, setDataCheck] = useState<any>(null);

  // Check current data availability on mount
  useEffect(() => {
    const checkData = async () => {
      const check = await HistoricalDataLoader.checkHistoricalDataAvailability();
      setDataCheck(check);
    };
    checkData();
  }, []);

  const handleLoadHistoricalData = async () => {
    setLoading(true);
    setProgress(0);
    setMessage('Starting historical data load...');
    setResult(null);

    const result = await HistoricalDataLoader.loadHistoricalData((progress, message) => {
      setProgress(progress);
      setMessage(message);
    });

    setResult(result);
    setLoading(false);
    
    if (onComplete) {
      onComplete(result.success, result.totalLogs);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Database className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold text-white">Historical Data Loader</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ×
            </button>
          )}
        </div>

        {/* Current Data Status */}
        {dataCheck && (
          <div className={`rounded-lg p-4 mb-6 ${
            dataCheck.hasData 
              ? 'bg-green-900/20 border border-green-500/30' 
              : 'bg-yellow-900/20 border border-yellow-500/30'
          }`}>
            <div className="flex items-center space-x-3 mb-3">
              {dataCheck.hasData ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-400" />
              )}
              <h3 className={`font-semibold ${
                dataCheck.hasData ? 'text-green-200' : 'text-yellow-200'
              }`}>
                Current Data Status
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Total Records:</span>
                <span className="text-white ml-2">{dataCheck.totalLogs.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400">Status:</span>
                <span className={`ml-2 ${dataCheck.hasData ? 'text-green-400' : 'text-yellow-400'}`}>
                  {dataCheck.hasData ? 'Sufficient' : 'Insufficient'}
                </span>
              </div>
              {dataCheck.oldestRecord && (
                <div>
                  <span className="text-slate-400">Oldest:</span>
                  <span className="text-white ml-2">{new Date(dataCheck.oldestRecord).toLocaleDateString()}</span>
                </div>
              )}
              {dataCheck.newestRecord && (
                <div>
                  <span className="text-slate-400">Newest:</span>
                  <span className="text-white ml-2">{new Date(dataCheck.newestRecord).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            <p className={`text-xs mt-3 ${
              dataCheck.hasData ? 'text-green-300' : 'text-yellow-300'
            }`}>
              {dataCheck.recommendation}
            </p>
          </div>
        )}

        {/* Load Historical Data Section */}
        <div className="bg-slate-700 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Download className="w-5 h-5 text-blue-400" />
            <span>Load 10 Days of Historical Data</span>
          </h3>
          
          <p className="text-slate-300 text-sm mb-4">
            This will fetch 10 days of historical tank readings from your Central Tank Server 
            and cache them for instant chart loading. This process may take 2-5 minutes depending 
            on the number of stores and tanks.
          </p>

          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <h4 className="text-blue-200 font-semibold mb-2">What this does:</h4>
            <ul className="text-blue-300 text-xs space-y-1">
              <li>• Fetches 10 days (240 hours) of historical data for all tanks</li>
              <li>• Caches data locally for instant chart loading</li>
              <li>• Populates Supabase database (if connected) for persistence</li>
              <li>• Enables rich historical charts and trend analysis</li>
              <li>• One-time process - subsequent loads will be instant</li>
            </ul>
          </div>

          {/* Progress Bar */}
          {loading && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">{message}</span>
                <span className="text-sm text-slate-400">{progress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-600 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-lg p-4 mb-4 ${
              result.success 
                ? 'bg-green-900/20 border border-green-500/30' 
                : 'bg-red-900/20 border border-red-500/30'
            }`}>
              <div className="flex items-center space-x-2">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                )}
                <p className={`font-semibold ${
                  result.success ? 'text-green-200' : 'text-red-200'
                }`}>
                  {result.success ? 'Success!' : 'Failed'}
                </p>
              </div>
              <p className={`text-sm mt-2 ${
                result.success ? 'text-green-300' : 'text-red-300'
              }`}>
                {result.message}
              </p>
              {result.success && (
                <p className="text-green-400 text-xs mt-2">
                  🎉 Charts will now load instantly with {result.totalLogs.toLocaleString()} historical data points!
                </p>
              )}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleLoadHistoricalData}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 px-6 py-3 rounded-lg text-white font-medium transition-colors"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Loading Historical Data...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Load 10 Days of Historical Data</span>
              </>
            )}
          </button>
        </div>

        {/* Performance Note */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span>Performance Benefits</span>
          </h4>
          <div className="text-xs text-slate-400 space-y-1">
            <p>• <strong>First Load:</strong> 2-5 minutes to fetch and cache 10 days of data</p>
            <p>• <strong>Subsequent Loads:</strong> Instant chart rendering from cached data</p>
            <p>• <strong>Auto-Refresh:</strong> Background updates every 30 seconds</p>
            <p>• <strong>Persistent Cache:</strong> Data survives browser restarts</p>
          </div>
        </div>
      </div>
    </div>
  );
};