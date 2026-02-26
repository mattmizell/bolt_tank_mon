import React, { useState } from 'react';
import { Store } from '../types';
import { ArrowLeft, RefreshCw, Download, Filter, Activity, AlertTriangle, Wifi, WifiOff, ExternalLink, Shield } from 'lucide-react';
import { TankTable } from './TankTable';
import { TankChart } from './TankChart';
import { ComplianceReport } from './ComplianceReport';
import { format } from 'date-fns';

type StoreTab = 'tanks' | 'compliance';

interface StoreReportProps {
  store: Store;
  onBack: () => void;
  isLiveData?: boolean;
}

export const StoreReport: React.FC<StoreReportProps> = ({ store, onBack, isLiveData = false }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [activeTab, setActiveTab] = useState<StoreTab>('tanks');

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call - in real implementation, this would refresh the store data
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const criticalTanks = store.tanks.filter(tank => tank.status === 'critical').length;
  const warningTanks = store.tanks.filter(tank => tank.status === 'warning').length;

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
              <span>Back to Stores</span>
            </button>
            <div>
              <div className="flex items-center space-x-3">
                {/* Better Day Energy Logo */}
                <img 
                  src="/betterday-energy-logo_trans.png" 
                  alt="Better Day Energy" 
                  className="h-8 w-auto"
                />
                <h1 className="text-3xl font-bold text-white">{store.store_name}</h1>
                <div className="flex items-center space-x-1">
                  {isLiveData ? (
                    <Wifi className="w-5 h-5 text-green-400" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-yellow-400" />
                  )}
                  <span className={`text-sm ${isLiveData ? 'text-green-400' : 'text-yellow-400'}`}>
                    {isLiveData ? 'Live Data' : 'Demo Data'}
                  </span>
                </div>
                {isLiveData && (
                  <a
                    href="https://central-tank-server.onrender.com/stores/full"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>API</span>
                  </a>
                )}
              </div>
              <p className="text-slate-400">
                Tank Monitoring Dashboard • Last updated: {
                  store.last_updated 
                    ? format(new Date(store.last_updated), 'PPpp')
                    : 'Unknown'
                }
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
              <span>Refresh</span>
            </button>
            <button className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-white transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-white transition-colors">
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* Live Data Banner */}
        {isLiveData && (
          <div className="bg-green-900/30 border border-green-500/30 rounded-lg px-4 py-3 mb-6">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <p className="text-green-200 text-sm">
                🔴 Live data from Central Tank Server • Auto-updating in background every 30 seconds
              </p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setActiveTab('tanks')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'tanks'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Tanks</span>
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'compliance'
                ? 'bg-green-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Compliance</span>
          </button>
        </div>

        {/* Tanks Tab */}
        {activeTab === 'tanks' && (
          <>
            {/* Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Total Tanks</p>
                    <p className="text-2xl font-bold text-white">{store.tanks.length}</p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-400" />
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-red-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Critical Alerts</p>
                    <p className="text-2xl font-bold text-red-400">{criticalTanks}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-yellow-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Warnings</p>
                    <p className="text-2xl font-bold text-yellow-400">{warningTanks}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-yellow-400" />
                </div>
              </div>
            </div>

            {/* Tank Data Table */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Tank Status</h2>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm text-slate-400">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span>Normal</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-slate-400">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <span>Warning</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-slate-400">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <span>Critical</span>
                  </div>
                </div>
              </div>
              <TankTable tanks={store.tanks} />
            </div>

            {/* Charts Toggle */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Volume Trends (Live Data)</h2>
              <button
                onClick={() => setShowCharts(!showCharts)}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                {showCharts ? 'Hide Charts' : 'Show Charts'}
              </button>
            </div>

            {/* Tank Charts */}
            {showCharts && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {store.tanks.map((tank) => (
                  <TankChart key={tank.tank_id} tank={tank} />
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="mt-12 bg-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Legend</h3>
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
                  <span className="text-slate-300 ml-2">90% of empty space in tank (conservative planning)</span>
                </div>
                <div>
                  <strong className="text-white">Height:</strong>
                  <span className="text-slate-300 ml-2">Current product height (inches)</span>
                </div>
                <div>
                  <strong className="text-white">Run Rate:</strong>
                  <span className="text-slate-300 ml-2">Consumption rate during business hours (gal/hr)</span>
                </div>
                <div>
                  <strong className="text-white">Hours to 10":</strong>
                  <span className="text-slate-300 ml-2">Estimated hours until fuel drops to 10 inches</span>
                </div>
                <div>
                  <strong className="text-white">Predicted Time:</strong>
                  <span className="text-slate-300 ml-2">Estimated timestamp for reaching 10 inches</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Compliance Tab */}
        {activeTab === 'compliance' && (
          <ComplianceReport storeName={store.store_name} />
        )}
      </div>
    </div>
  );
};