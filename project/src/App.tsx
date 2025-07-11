import React, { useState, useEffect } from 'react';
import { Store } from './types';
import { StoreSelector } from './components/StoreSelector';
import { TankChart } from './components/TankChart';

type ViewMode = 'selector' | 'single-store' | 'all-stores';

function App() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('selector');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🚀 Fetching data directly from API...');
        
        // Get store list
        const storesResponse = await fetch('https://central-tank-server.onrender.com/dashboard/stores');
        if (!storesResponse.ok) {
          throw new Error(`Failed to fetch stores: ${storesResponse.status}`);
        }
        const storesList = await storesResponse.json();
        console.log('📊 Got stores list:', storesList);
        
        // Get detailed data for each store
        const storePromises = storesList.map(async (store: any) => {
          const detailResponse = await fetch(`https://central-tank-server.onrender.com/dashboard/stores/${store.store_name}`);
          if (!detailResponse.ok) {
            throw new Error(`Failed to fetch ${store.store_name}: ${detailResponse.status}`);
          }
          const storeData = await detailResponse.json();
          console.log(`📊 Got data for ${store.store_name}:`, storeData);
          
          // Convert to Store format using the working API data
          const tanks = storeData.tanks.map((tank: any) => {
            console.log(`🔧 Processing tank ${tank.tank_id} with run_rate: ${tank.analytics.run_rate}`);
            
            return {
              tank_id: tank.tank_id,
              tank_name: tank.tank_name,
              product: tank.tank_name,
              latest_log: {
                volume: tank.latest_reading.volume,
                tc_volume: tank.latest_reading.volume,
                height: tank.latest_reading.height,
                timestamp: tank.latest_reading.timestamp,
                temp: 70,
                ullage: tank.latest_reading.ullage || 0,
                water: 0,
                id: 0,
                store_name: storeData.store_name,
                tank_id: tank.tank_id,
                product: tank.tank_name
              },
              logs: [],
              run_rate: tank.analytics.run_rate,
              hours_to_10_inches: tank.analytics.hours_to_critical,
              status: tank.current_status,
              capacity_percentage: Math.round((tank.latest_reading.volume / tank.configuration.max_capacity_gallons) * 100),
              profile: {
                store_name: storeData.store_name,
                tank_id: tank.tank_id,
                tank_name: tank.tank_name,
                max_capacity_gallons: tank.configuration.max_capacity_gallons,
                critical_height_inches: tank.configuration.critical_height_inches,
                warning_height_inches: tank.configuration.warning_height_inches
              },
              configuration: tank.configuration,
              analytics: tank.analytics,
              predicted_time: tank.analytics.predicted_empty
            };
          });
          
          console.log(`✅ Processed ${tanks.length} tanks for ${storeData.store_name}`);
          
          return {
            store_name: storeData.store_name,
            tanks: tanks,
            last_updated: new Date().toISOString()
          };
        });
        
        const processedStores = await Promise.all(storePromises);
        console.log('✅ All stores processed:', processedStores);
        setStores(processedStores);
        
      } catch (err) {
        console.error('❌ Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const refreshData = () => {
    setLoading(true);
    setError(null);
    // Re-trigger the useEffect
    window.location.reload();
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg">Loading Tank Data...</p>
          <p className="text-slate-500 text-sm mt-2">Connecting to Central Tank Server...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-8">
            <div className="text-red-400 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-4">Connection Failed</h1>
            <p className="text-red-300 mb-6">{error}</p>
            <button
              onClick={refreshData}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-white font-medium transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  const handleStoreSelect = (store: Store) => {
    setSelectedStore(store);
    setViewMode('single-store');
  };

  const handleViewAllStores = () => {
    setViewMode('all-stores');
  };

  const handleBack = () => {
    setSelectedStore(null);
    setViewMode('selector');
  };

  if (viewMode === 'selector') {
    return (
      <div className="App">
        <StoreSelector
          stores={stores}
          onStoreSelect={handleStoreSelect}
          onViewAll={handleViewAllStores}
          loading={false}
        />
      </div>
    );
  }

  if (viewMode === 'all-stores') {
    return (
      <div className="App">
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={handleBack}
                className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
              >
                <span>← Back to Store Selection</span>
              </button>
              <h1 className="text-3xl font-bold text-white">All Stores Overview</h1>
              <button
                onClick={refreshData}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white transition-colors"
              >
                Refresh
              </button>
            </div>
            
            {/* Alerts Overview Grid */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">System Alerts</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Critical Alerts */}
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-400 text-sm font-medium">Critical Alerts</p>
                      <p className="text-2xl font-bold text-red-300">
                        {stores.reduce((count, store) => 
                          count + store.tanks.filter(tank => tank.status === 'critical').length, 0
                        )}
                      </p>
                    </div>
                    <div className="text-red-400 text-2xl">🚨</div>
                  </div>
                </div>
                
                {/* Warning Alerts */}
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-400 text-sm font-medium">Warning Alerts</p>
                      <p className="text-2xl font-bold text-yellow-300">
                        {stores.reduce((count, store) => 
                          count + store.tanks.filter(tank => tank.status === 'warning').length, 0
                        )}
                      </p>
                    </div>
                    <div className="text-yellow-400 text-2xl">⚠️</div>
                  </div>
                </div>
                
                {/* Low Fuel Tanks (< 25%) */}
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-400 text-sm font-medium">Low Fuel (&lt;25%)</p>
                      <p className="text-2xl font-bold text-orange-300">
                        {stores.reduce((count, store) => 
                          count + store.tanks.filter(tank => tank.capacity_percentage < 25).length, 0
                        )}
                      </p>
                    </div>
                    <div className="text-orange-400 text-2xl">⛽</div>
                  </div>
                </div>
                
                {/* Total Tanks */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-400 text-sm font-medium">Total Tanks</p>
                      <p className="text-2xl font-bold text-blue-300">
                        {stores.reduce((count, store) => count + store.tanks.length, 0)}
                      </p>
                    </div>
                    <div className="text-blue-400 text-2xl">📊</div>
                  </div>
                </div>
              </div>
              
              {/* Active Alerts List */}
              {(() => {
                const alertTanks = stores.flatMap(store => 
                  store.tanks
                    .filter(tank => tank.status === 'critical' || tank.status === 'warning' || tank.capacity_percentage < 25)
                    .map(tank => ({ ...tank, store_name: store.store_name }))
                );
                
                if (alertTanks.length > 0) {
                  return (
                    <div className="bg-slate-800 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-3">Active Alerts ({alertTanks.length})</h3>
                      <div className="space-y-2">
                        {alertTanks.map((tank, index) => (
                          <div key={`${tank.store_name}-${tank.tank_id}`} className={`flex items-center justify-between p-3 rounded-lg ${
                            tank.status === 'critical' ? 'bg-red-900/30 border border-red-500/30' :
                            tank.status === 'warning' ? 'bg-yellow-900/30 border border-yellow-500/30' :
                            'bg-orange-900/30 border border-orange-500/30'
                          }`}>
                            <div className="flex items-center space-x-3">
                              <div className={`text-lg ${
                                tank.status === 'critical' ? 'text-red-400' :
                                tank.status === 'warning' ? 'text-yellow-400' :
                                'text-orange-400'
                              }`}>
                                {tank.status === 'critical' ? '🚨' : tank.status === 'warning' ? '⚠️' : '⛽'}
                              </div>
                              <div>
                                <p className="text-white font-medium">
                                  {tank.store_name} - {tank.tank_name}
                                </p>
                                <p className="text-slate-300 text-sm">
                                  {tank.capacity_percentage}% capacity • {tank.latest_log?.volume || 0} gal • {tank.latest_log?.height?.toFixed(1) || 0}" height
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-medium ${
                                tank.status === 'critical' ? 'text-red-300' :
                                tank.status === 'warning' ? 'text-yellow-300' :
                                'text-orange-300'
                              }`}>
                                {tank.status === 'critical' ? 'CRITICAL' :
                                 tank.status === 'warning' ? 'WARNING' :
                                 'LOW FUEL'}
                              </p>
                              {tank.hours_to_10_inches && tank.hours_to_10_inches < 168 && (
                                <p className="text-slate-400 text-sm">
                                  {tank.hours_to_10_inches.toFixed(1)}h to 10"
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-center">
                      <div className="text-green-400 text-3xl mb-2">✅</div>
                      <p className="text-green-300 font-medium">All Systems Normal</p>
                      <p className="text-green-400 text-sm">No active alerts across all stores</p>
                    </div>
                  );
                }
              })()}
            </div>
            
            <div className="space-y-8">
              {stores.map((store) => (
                <div key={store.store_name} className="bg-slate-800 rounded-xl p-6">
                  <h2 className="text-2xl font-bold text-white mb-4">{store.store_name}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {store.tanks.map((tank) => (
                      <div key={tank.tank_id} className="bg-slate-700 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-white mb-2">{tank.tank_name}</h3>
                        <div className="space-y-1 text-sm">
                          <div className="text-slate-300">Volume: <span className="text-white">{tank.latest_log?.volume || 0} gal</span></div>
                          <div className="text-slate-300">Capacity: <span className="text-white">{tank.capacity_percentage}%</span></div>
                          <div className="text-slate-300">Run Rate: <span className="text-white">{tank.run_rate?.toFixed(2)} in/hr</span></div>
                          <div className="text-slate-300">Height: <span className="text-white">{tank.latest_log?.height?.toFixed(1)} in</span></div>
                          <div className={`text-sm font-medium ${
                            tank.status === 'critical' ? 'text-red-400' :
                            tank.status === 'warning' ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {tank.status?.toUpperCase() || 'NORMAL'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Single store view (placeholder)
  if (viewMode === 'single-store' && selectedStore) {
    return (
      <div className="App">
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={handleBack}
                className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
              >
                <span>← Back to Store Selection</span>
              </button>
              <h1 className="text-3xl font-bold text-white">{selectedStore.store_name}</h1>
              <button
                onClick={refreshData}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white transition-colors"
              >
                Refresh
              </button>
            </div>
            
            {/* Store Alert Summary */}
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Total Tanks</p>
                      <p className="text-xl font-bold text-white">{selectedStore.tanks.length}</p>
                    </div>
                    <div className="text-blue-400 text-xl">📊</div>
                  </div>
                </div>
                
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-400 text-sm">Critical</p>
                      <p className="text-xl font-bold text-red-300">
                        {selectedStore.tanks.filter(tank => tank.status === 'critical').length}
                      </p>
                    </div>
                    <div className="text-red-400 text-xl">🚨</div>
                  </div>
                </div>
                
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-400 text-sm">Warning</p>
                      <p className="text-xl font-bold text-yellow-300">
                        {selectedStore.tanks.filter(tank => tank.status === 'warning').length}
                      </p>
                    </div>
                    <div className="text-yellow-400 text-xl">⚠️</div>
                  </div>
                </div>
                
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-400 text-sm">Normal</p>
                      <p className="text-xl font-bold text-green-300">
                        {selectedStore.tanks.filter(tank => tank.status === 'normal' || !tank.status).length}
                      </p>
                    </div>
                    <div className="text-green-400 text-xl">✅</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {selectedStore.tanks.map((tank) => {
                const isLowFuel = tank.capacity_percentage < 25;
                const isAlert = tank.status === 'critical' || tank.status === 'warning' || isLowFuel;
                
                return (
                  <div key={tank.tank_id} className={`rounded-xl p-6 border-2 ${
                    tank.status === 'critical' ? 'bg-red-900/20 border-red-500/50' :
                    tank.status === 'warning' ? 'bg-yellow-900/20 border-yellow-500/50' :
                    isLowFuel ? 'bg-orange-900/20 border-orange-500/50' :
                    'bg-slate-800 border-slate-600'
                  }`}>
                    {/* Tank Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-white">{tank.tank_name}</h2>
                      <div className={`text-2xl ${
                        tank.status === 'critical' ? 'text-red-400' :
                        tank.status === 'warning' ? 'text-yellow-400' :
                        isLowFuel ? 'text-orange-400' :
                        'text-green-400'
                      }`}>
                        {tank.status === 'critical' ? '🚨' :
                         tank.status === 'warning' ? '⚠️' :
                         isLowFuel ? '⛽' : '✅'}
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${
                      tank.status === 'critical' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                      tank.status === 'warning' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                      isLowFuel ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                      'bg-green-500/20 text-green-300 border border-green-500/30'
                    }`}>
                      {tank.status === 'critical' ? 'CRITICAL ALERT' :
                       tank.status === 'warning' ? 'WARNING' :
                       isLowFuel ? 'LOW FUEL' : 'NORMAL'}
                    </div>
                    
                    {/* Tank Metrics */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">Current Volume</span>
                        <span className="text-white text-lg font-semibold">{tank.latest_log?.volume || 0} gal</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">Capacity Used</span>
                        <div className="flex items-center space-x-2">
                          <span className={`text-lg font-semibold ${
                            tank.capacity_percentage < 15 ? 'text-red-400' :
                            tank.capacity_percentage < 30 ? 'text-yellow-400' :
                            'text-white'
                          }`}>{tank.capacity_percentage}%</span>
                          <div className="w-16 h-2 bg-slate-600 rounded-full">
                            <div 
                              className={`h-2 rounded-full ${
                                tank.capacity_percentage < 15 ? 'bg-red-500' :
                                tank.capacity_percentage < 30 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(tank.capacity_percentage, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">Height</span>
                        <span className="text-white">{tank.latest_log?.height?.toFixed(1)} in</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">Run Rate</span>
                        <span className="text-white">{tank.run_rate?.toFixed(3)} in/hr</span>
                      </div>
                      
                      {tank.hours_to_10_inches && tank.hours_to_10_inches < 168 && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300">Time to 10"</span>
                          <span className={`font-semibold ${
                            tank.hours_to_10_inches < 24 ? 'text-red-400' :
                            tank.hours_to_10_inches < 48 ? 'text-yellow-400' :
                            'text-white'
                          }`}>{tank.hours_to_10_inches.toFixed(1)} hrs</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">Max Capacity</span>
                        <span className="text-slate-400">{tank.profile?.max_capacity_gallons?.toLocaleString()} gal</span>
                      </div>
                    </div>
                    
                    {/* Tank Chart */}
                    <div className="mt-6 pt-4 border-t border-slate-600">
                      <TankChart tank={tank} />
                    </div>
                  </div>
                );
              })
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;