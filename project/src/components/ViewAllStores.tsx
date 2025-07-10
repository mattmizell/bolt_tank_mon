import React, { useState, useEffect } from 'react';
import { Store } from '../types';
import { ArrowLeft, RefreshCw, Activity, AlertTriangle, Building2, ExternalLink, Wifi } from 'lucide-react';
import { TankTable } from './TankTable';
import { TankChart } from './TankChart';
import { format } from 'date-fns';

interface ViewAllStoresProps {
  stores: Store[];
  onBack: () => void;
  onRefresh: () => void;
  loading: boolean;
  isLiveData?: boolean;
}

export const ViewAllStores: React.FC<ViewAllStoresProps> = ({ 
  stores, 
  onBack, 
  onRefresh, 
  loading,
  isLiveData = false
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [showCharts, setShowCharts] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  // Calculate overall statistics
  const totalTanks = stores.reduce((sum, store) => sum + store.tanks.length, 0);
  const criticalTanks = stores.reduce((sum, store) => 
    sum + store.tanks.filter(tank => tank.status === 'critical').length, 0);
  const warningTanks = stores.reduce((sum, store) => 
    sum + store.tanks.filter(tank => tank.status === 'warning').length, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg">Loading All Stores Data...</p>
          <p className="text-slate-500 text-sm mt-2">Connecting to Central Tank Server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Store Selection</span>
            </button>
            <div>
              <div className="flex items-center space-x-3">
                {/* Better Day Energy Logo */}
                <img 
                  src="/betterday-energy-logo_trans.png" 
                  alt="Better Day Energy" 
                  className="h-8 w-auto"
                />
                <h1 className="text-3xl font-bold text-white">All Stores Overview</h1>
                {isLiveData && (
                  <div className="flex items-center space-x-2">
                    <Wifi className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-green-400">Live Data</span>
                    <a
                      href="https://central-tank-server.onrender.com/stores/full"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>API</span>
                    </a>
                  </div>
                )}
              </div>
              <p className="text-slate-400">
                Central Tank Monitoring Dashboard • Last updated: {format(new Date(), 'PPpp')}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 px-4 py-2 rounded-lg text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh All</span>
            </button>
          </div>
        </div>

        {/* Live Data Banner */}
        {isLiveData && (
          <div className="bg-green-900/30 border border-green-500/30 rounded-lg px-4 py-3 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <p className="text-green-200 text-sm">
                  🔴 Live data from Central Tank Server • Auto-updating in background every 30 seconds for all {stores.length} stores
                </p>
              </div>
              <a
                href="https://central-tank-server.onrender.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-300 hover:text-green-200 text-sm transition-colors"
              >
                View API →
              </a>
            </div>
          </div>
        )}

        {/* Overall Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Stores</p>
                <p className="text-2xl font-bold text-white">{stores.length}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Tanks</p>
                <p className="text-2xl font-bold text-white">{totalTanks}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-xl p-6 border border-red-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-400">{criticalTanks}</p>
                <p className="text-xs text-slate-500">≤10" or {"<24hrs"}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-yellow-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Warnings</p>
                <p className="text-2xl font-bold text-yellow-400">{warningTanks}</p>
                <p className="text-xs text-slate-500">≤20" or {"<48hrs"}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Store Cards */}
        <div className="space-y-8">
          {stores.map((store) => {
            const storeCritical = store.tanks.filter(tank => tank.status === 'critical').length;
            const storeWarning = store.tanks.filter(tank => tank.status === 'warning').length;

            return (
              <div key={store.store_name} className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                {/* Store Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{store.store_name}</h2>
                    <p className="text-slate-400">
                      {store.tanks.length} tank{store.tanks.length !== 1 ? 's' : ''} • 
                      Last updated: {store.last_updated 
                        ? format(new Date(store.last_updated), 'PPpp')
                        : 'Unknown'
                      }
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    {storeCritical > 0 && (
                      <div className="flex items-center space-x-2 bg-red-900/30 px-3 py-1 rounded-full">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 text-sm font-medium">{storeCritical} Critical</span>
                      </div>
                    )}
                    {storeWarning > 0 && (
                      <div className="flex items-center space-x-2 bg-yellow-900/30 px-3 py-1 rounded-full">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400 text-sm font-medium">{storeWarning} Warning</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tank Table */}
                <TankTable tanks={store.tanks} />

                {/* Charts Toggle for this store */}
                <div className="flex items-center justify-between mt-6 mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    {store.store_name} Volume Trends (Calibrated to Tank Capacity)
                  </h3>
                  <button
                    onClick={() => setShowCharts(!showCharts)}
                    className="text-blue-400 hover:text-blue-300 transition-colors text-sm"
                  >
                    {showCharts ? 'Hide Charts' : 'Show Charts'}
                  </button>
                </div>

                {/* Tank Charts for this store */}
                {showCharts && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {store.tanks.map((tank) => (
                      <TankChart key={`${store.store_name}-${tank.tank_id}`} tank={tank} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Enhanced Legend */}
        <div className="mt-12 bg-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Tank Monitoring System Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <strong className="text-white">TC Volume:</strong>
              <span className="text-slate-300 ml-2">Temperature-compensated fuel volume (gallons)</span>
            </div>
            <div>
              <strong className="text-white">Capacity Used:</strong>
              <span className="text-slate-300 ml-2">Percentage of tank's maximum capacity currently used</span>
            </div>
            <div>
              <strong className="text-white">90% Ullage:</strong>
              <span className="text-slate-300 ml-2">90% of actual empty space in tank (conservative planning)</span>
            </div>
            <div>
              <strong className="text-white">Height:</strong>
              <span className="text-slate-300 ml-2">Current product height (inches)</span>
            </div>
            <div>
              <strong className="text-white">Run Rate:</strong>
              <span className="text-slate-300 ml-2">Consumption rate during business hours only (5 AM - 11 PM)</span>
            </div>
            <div>
              <strong className="text-white">Hours to 10":</strong>
              <span className="text-slate-300 ml-2">Estimated business hours until fuel drops to 10 inches</span>
            </div>
            <div>
              <strong className="text-red-300">Critical Alert:</strong>
              <span className="text-slate-300 ml-2">Tank height ≤15" OR {"<24"} hours to 10"</span>
            </div>
            <div>
              <strong className="text-yellow-300">Warning Alert:</strong>
              <span className="text-slate-300 ml-2">Tank height ≤20" OR {"<48"} hours to 10"</span>
            </div>
            <div>
              <strong className="text-white">Tank Specs:</strong>
              <span className="text-slate-300 ml-2">96" diameter × 319.3" length cylindrical tanks</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};