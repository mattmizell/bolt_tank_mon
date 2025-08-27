import React, { useState } from 'react';
import { Store } from '../types';
import { Building2, ChevronRight, Settings, Sparkles, ExternalLink, Copy, Database } from 'lucide-react';
import { ConfigurationPanel } from './ConfigurationPanel';
import { DatabaseStatus } from './DatabaseStatus';
import { ConfigService } from '../services/configService';
import { getDataFreshness, DataFreshnessIndicator } from '../utils/dataFreshness';

interface StoreSelectorProps {
  stores: Store[];
  onStoreSelect: (store: Store) => void;
  onViewAll: () => void;
  loading?: boolean;
  newStoreDetected?: string | null;
}

export const StoreSelector: React.FC<StoreSelectorProps> = ({ 
  stores, 
  onStoreSelect, 
  onViewAll,
  loading = false,
  newStoreDetected = null,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [showDatabaseStatus, setShowDatabaseStatus] = useState(false);
  const [showReadOnlyLinks, setShowReadOnlyLinks] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  const generateReadOnlyLink = (storeName: string): string => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?readonly=true&store=${encodeURIComponent(storeName)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const showStoredConfigurations = () => {
    const storeHours = ConfigService.getStoreHours();
    const tankConfigs = ConfigService.getTankConfigurations();
    const visibleStores = ConfigService.getVisibleStores();
    const activeStores = ConfigService.getActiveStores();
    
    console.log('🔍 STORED CONFIGURATIONS DEBUG:');
    console.log('📅 Store Hours:', storeHours);
    console.log('👁️ Visible Stores:', visibleStores);
    console.log('✅ Active Stores:', activeStores);
    console.log('🛢️ Tank Configurations:', tankConfigs);
    
    // Group tank configs by store for easier reading
    const configsByStore = tankConfigs.reduce((acc, config) => {
      if (!acc[config.store_name]) acc[config.store_name] = [];
      acc[config.store_name].push(config);
      return acc;
    }, {} as Record<string, any[]>);
    
    console.log('🏪 Tank Configs by Store:', configsByStore);
    
    const hiddenStores = storeHours.length - visibleStores.length;
    alert(`Debug info logged to console. Check browser dev tools.\n\nTotal stores: ${storeHours.length}\nVisible stores: ${visibleStores.length}\nHidden stores: ${hiddenStores}\nTanks configured: ${tankConfigs.length}`);
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-4">Loading Tank Data</h2>
          <p className="text-slate-300 text-lg mb-4">
            Fetching data from Dashboard API...
          </p>
          
          {/* Progress indicator */}
          <div className="w-full bg-slate-700 rounded-full h-3 mb-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
          
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mt-4">
            <p className="text-blue-200 text-sm font-semibold mb-2">🚀 Dashboard API Loading</p>
            <p className="text-blue-300 text-xs">
              Loading all stores with complete data including 5 days of historical data for charts
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* New Store Detection Banner */}
        {newStoreDetected && (
          <div className="fixed top-4 right-4 z-50 bg-gradient-to-r from-green-600 to-emerald-600 border border-green-500 rounded-lg px-6 py-4 shadow-lg animate-pulse max-w-sm">
            <div className="flex items-center space-x-3">
              <Sparkles className="w-6 h-6 text-green-200 flex-shrink-0" />
              <div>
                <p className="text-green-100 font-semibold">🎉 New Gas Station Detected!</p>
                <p className="text-green-200 text-sm">
                  "{newStoreDetected}" has been auto-configured and is ready for monitoring
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-8 lg:mb-12">
          <div className="mb-6">
            {/* Better Day Energy Logo */}
            <div className="flex justify-center mb-6">
              <img 
                src="/betterday-energy-logo_trans.png" 
                alt="Better Day Energy" 
                className="h-16 lg:h-20 w-auto"
              />
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">Tank Monitoring System</h1>
            <p className="text-slate-300 text-lg">Professional Fuel Management Dashboard</p>
            <p className="text-slate-500 text-sm mt-2">
              {stores.length} store{stores.length !== 1 ? 's' : ''} • 
              Dashboard API • 
              Auto-refresh every 30s
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 lg:mb-8 space-y-4 lg:space-y-0">
            <h2 className="text-xl lg:text-2xl font-semibold text-white">Select a Store</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => setShowConfig(true)}
                className="flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-white transition-colors text-sm"
              >
                <Settings className="w-4 h-4" />
                <span>Configuration</span>
              </button>
            </div>
          </div>

          {/* View All Button */}
          <div className="mb-6">
            <button
              onClick={onViewAll}
              className="w-full group bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 border border-blue-500 rounded-xl p-4 lg:p-6 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20"
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-lg lg:text-xl font-semibold text-white flex items-center space-x-2">
                    <Eye className="w-5 lg:w-6 h-5 lg:h-6" />
                    <span>View All Stores</span>
                  </h3>
                  <p className="text-blue-100 mt-1 text-sm lg:text-base">
                    Monitor all {stores.length} store{stores.length !== 1 ? 's' : ''} and {stores.reduce((sum, store) => sum + store.tanks.length, 0)} tanks in one view
                  </p>
                </div>
                <ChevronRight className="w-5 lg:w-6 h-5 lg:h-6 text-blue-200 group-hover:text-white transition-colors flex-shrink-0" />
              </div>
            </button>
          </div>

          <div className="text-center mb-4">
            <span className="text-slate-400 text-sm">Or select individual stores:</span>
          </div>
          
          <div className="grid gap-4">
            {stores.map((store) => {
              const criticalTanks = store.tanks.filter(tank => tank.status === 'critical').length;
              const warningTanks = store.tanks.filter(tank => tank.status === 'warning').length;
              const isNewStore = newStoreDetected === store.store_name;
              const storeFreshness = getDataFreshness(store.last_updated);
              
              return (
                <button
                  key={store.store_name}
                  onClick={() => onStoreSelect(store)}
                  className={`group rounded-xl p-4 lg:p-6 transition-all duration-200 hover:shadow-lg ${
                    isNewStore 
                      ? 'bg-gradient-to-r from-green-800 to-emerald-800 border border-green-500 hover:border-green-400 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-blue-400 hover:shadow-blue-500/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="flex flex-col lg:flex-row lg:items-center space-y-2 lg:space-y-0 lg:space-x-2">
                        <h3 className={`text-lg lg:text-xl font-semibold transition-colors ${
                          isNewStore 
                            ? 'text-green-100 group-hover:text-white'
                            : 'text-white group-hover:text-blue-400'
                        }`}>
                          {store.store_name}
                        </h3>
                        {isNewStore && (
                          <div className="flex items-center space-x-1 bg-green-600 px-2 py-1 rounded-full">
                            <Sparkles className="w-3 h-3 text-green-200" />
                            <span className="text-green-200 text-xs font-medium">NEW</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col lg:flex-row lg:items-center space-y-1 lg:space-y-0 lg:space-x-4 mt-1">
                        <p className={isNewStore ? 'text-green-200' : 'text-slate-400'}>
                          {store.tanks.length} tank{store.tanks.length !== 1 ? 's' : ''} monitored
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {criticalTanks > 0 && (
                            <span className="bg-red-900/30 text-red-400 px-2 py-1 rounded text-xs font-medium">
                              {criticalTanks} Critical
                            </span>
                          )}
                          {warningTanks > 0 && (
                            <span className="bg-yellow-900/30 text-yellow-400 px-2 py-1 rounded text-xs font-medium">
                              {warningTanks} Warning
                            </span>
                          )}
                        </div>
                      </div>
                      {store.last_updated && (
                        <p className={`text-sm mt-2 ${isNewStore ? 'text-green-300' : 'text-slate-500'}`}>
                          Last updated: <DataFreshnessIndicator 
                            timestamp={store.last_updated}
                            className={isNewStore ? 'text-green-300' : ''}
                            showIcon={!isNewStore}
                          />
                        </p>
                      )}
                      {isNewStore && (
                        <p className="text-green-300 text-xs mt-1 font-medium">
                          ✨ Auto-configured with defaults • Ready for monitoring
                        </p>
                      )}
                    </div>
                    <ChevronRight className={`w-5 lg:w-6 h-5 lg:h-6 transition-colors flex-shrink-0 ${
                      isNewStore 
                        ? 'text-green-300 group-hover:text-white'
                        : 'text-slate-400 group-hover:text-blue-400'
                    }`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-12 lg:mt-16 text-center">
          <p className="text-slate-400 text-sm">
            © 2025 Better Day Energy | Professional tank monitoring system
          </p>
          <p className="text-slate-500 text-xs mt-1">
            Dashboard API • Updates every 30 seconds • Dynamic store detection
          </p>
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <ConfigurationPanel 
          onClose={() => setShowConfig(false)} 
          stores={stores}
          generateReadOnlyLink={generateReadOnlyLink}
          copyToClipboard={copyToClipboard}
        />
      )}
    </div>
  );
};