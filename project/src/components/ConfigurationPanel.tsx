import React, { useState, useEffect } from 'react';
import { X, Settings, Download, Upload, RotateCcw, Save, Eye, EyeOff, Database, ExternalLink, Copy, Sparkles } from 'lucide-react';
import { Store } from '../types';
import { ConfigService } from '../services/configService';
import { DatabaseStatus } from './DatabaseStatus';

interface ConfigurationPanelProps {
  onClose: () => void;
  stores: Store[];
  generateReadOnlyLink: (storeName: string) => string;
  copyToClipboard: (text: string) => void;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  onClose,
  stores,
  generateReadOnlyLink,
  copyToClipboard,
}) => {
  const [activeTab, setActiveTab] = useState<'stores' | 'tanks' | 'system'>('stores');
  const [storeHours, setStoreHours] = useState(ConfigService.getStoreHours());
  const [tankConfigs, setTankConfigs] = useState(ConfigService.getTankConfigurations());
  const [showDatabaseStatus, setShowDatabaseStatus] = useState(false);
  const [showReadOnlyLinks, setShowReadOnlyLinks] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch store configurations from central server database
    const loadStoreConfigurations = async () => {
      setLoading(true);
      try {
        const serverStoreHours = await ConfigService.getStoreHoursWithServerSync();
        const serverTankConfigs = await ConfigService.syncTankConfigurationsFromServer();
        
        setStoreHours(serverStoreHours);
        setTankConfigs(serverTankConfigs);
        
        console.log('✅ Loaded store configurations from central server database');
      } catch (error) {
        console.error('❌ Failed to load from server, using local data:', error);
        // Fallback to local data
        setStoreHours(ConfigService.getStoreHours());
        setTankConfigs(ConfigService.getTankConfigurations());
      } finally {
        setLoading(false);
      }
    };

    loadStoreConfigurations();
  }, []);

  const handleStoreHoursUpdate = async (storeName: string, field: string, value: any) => {
    const updated = storeHours.map(hours => 
      hours.store_name === storeName 
        ? { ...hours, [field]: value }
        : hours
    );
    setStoreHours(updated);
    
    // Save locally first
    ConfigService.saveStoreHours(updated);
    
    // Find the updated store and sync to central server
    const updatedStore = updated.find(hours => hours.store_name === storeName);
    if (updatedStore) {
      try {
        await ConfigService.pushStoreConfigurationToServer(updatedStore);
        console.log(`✅ Store configuration synced to central server`);
      } catch (error) {
        console.error('❌ Failed to sync store configuration:', error);
        // Configuration is still saved locally
      }
    }
  };

  const handleTankConfigUpdate = async (storeName: string, tankId: number, field: string, value: any) => {
    const updated = tankConfigs.map(config => 
      config.store_name === storeName && config.tank_id === tankId
        ? { ...config, [field]: value }
        : config
    );
    setTankConfigs(updated);
    
    // Find the updated config and sync to central server
    const updatedConfig = updated.find(config => 
      config.store_name === storeName && config.tank_id === tankId
    );
    
    if (updatedConfig) {
      try {
        await ConfigService.updateTankConfigurationWithSync(updatedConfig);
        console.log(`✅ Tank configuration synced to central server`);
      } catch (error) {
        console.error('❌ Failed to sync to central server:', error);
        // Configuration is still saved locally
      }
    }
  };

  const exportConfig = () => {
    const configJson = ConfigService.exportConfiguration();
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tank-monitor-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const configJson = e.target?.result as string;
          if (ConfigService.importConfiguration(configJson)) {
            setStoreHours(ConfigService.getStoreHours());
            setTankConfigs(ConfigService.getTankConfigurations());
            alert('Configuration imported successfully!');
          } else {
            alert('Failed to import configuration. Please check the file format.');
          }
        } catch (error) {
          alert('Error reading configuration file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const resetToDefaults = () => {
    if (confirm('Are you sure you want to reset all configurations to defaults? This cannot be undone.')) {
      ConfigService.resetToDefaults();
      setStoreHours(ConfigService.getStoreHours());
      setTankConfigs(ConfigService.getTankConfigurations());
      alert('Configuration reset to defaults.');
    }
  };

  const showStoredConfigurations = () => {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">System Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700">
          {[
            { id: 'stores', label: 'Store Settings', icon: Settings },
            { id: 'tanks', label: 'Tank Configuration', icon: Database },
            { id: 'system', label: 'System Tools', icon: Sparkles },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center space-x-2 px-6 py-4 transition-colors ${
                activeTab === id
                  ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'stores' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Store Hours & Admin Contacts
                  {loading && <span className="ml-2 text-blue-400 text-sm">(Loading from database...)</span>}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowReadOnlyLinks(!showReadOnlyLinks)}
                    className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-white transition-colors text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Read-Only Links</span>
                  </button>
                </div>
              </div>

              {showReadOnlyLinks && (
                <div className="bg-slate-700 rounded-lg p-4 space-y-3">
                  <h4 className="text-white font-medium">Read-Only Store Links</h4>
                  <p className="text-slate-300 text-sm">Share these links for view-only access to individual stores:</p>
                  {stores.map(store => (
                    <div key={store.store_name} className="flex items-center justify-between bg-slate-800 rounded p-3">
                      <span className="text-white">{store.store_name}</span>
                      <button
                        onClick={() => copyToClipboard(generateReadOnlyLink(store.store_name))}
                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white text-sm transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Link</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-4">
                {storeHours.map((hours) => (
                  <div key={hours.store_name} className="bg-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-medium">{hours.store_name}</h4>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleStoreHoursUpdate(hours.store_name, 'is_active', !hours.is_active)}
                          className={`p-1 rounded transition-colors ${
                            hours.is_active !== false
                              ? 'text-green-400 hover:bg-green-900/30'
                              : 'text-slate-500 hover:bg-slate-600'
                          }`}
                          title={hours.is_active !== false ? 'Store Visible' : 'Store Hidden'}
                        >
                          {hours.is_active !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Operating Hours</label>
                        <div className="flex space-x-2">
                          <select
                            value={hours.open_hour}
                            onChange={(e) => handleStoreHoursUpdate(hours.store_name, 'open_hour', parseInt(e.target.value))}
                            className="bg-slate-600 text-white rounded px-3 py-2 text-sm"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                            ))}
                          </select>
                          <span className="text-slate-400 self-center">to</span>
                          <select
                            value={hours.close_hour}
                            onChange={(e) => handleStoreHoursUpdate(hours.store_name, 'close_hour', parseInt(e.target.value))}
                            className="bg-slate-600 text-white rounded px-3 py-2 text-sm"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-2">Admin Contact</label>
                        <input
                          type="text"
                          value={hours.admin_name || ''}
                          onChange={(e) => handleStoreHoursUpdate(hours.store_name, 'admin_name', e.target.value)}
                          placeholder="Admin Name"
                          className="w-full bg-slate-600 text-white rounded px-3 py-2 text-sm mb-2"
                        />
                        <input
                          type="tel"
                          value={hours.admin_phone || ''}
                          onChange={(e) => handleStoreHoursUpdate(hours.store_name, 'admin_phone', e.target.value)}
                          placeholder="Phone Number"
                          className="w-full bg-slate-600 text-white rounded px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center space-x-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={hours.alerts_enabled !== false}
                          onChange={(e) => handleStoreHoursUpdate(hours.store_name, 'alerts_enabled', e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-slate-300 text-sm">Enable Alerts</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={hours.is_test_data || false}
                          onChange={(e) => handleStoreHoursUpdate(hours.store_name, 'is_test_data', e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-slate-300 text-sm">Test Data</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'tanks' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Tank Configurations</h3>
                <button
                  onClick={async () => {
                    try {
                      const synced = await ConfigService.syncTankConfigurationsFromServer();
                      setTankConfigs(synced);
                      console.log('✅ Synced tank configurations from central server');
                    } catch (error) {
                      console.error('❌ Failed to sync from central server:', error);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center gap-2"
                >
                  <RotateCcw size={16} />
                  Sync from Server
                </button>
              </div>
              
              {stores.map((store) => {
                const storeConfigs = tankConfigs.filter(config => config.store_name === store.store_name);
                
                return (
                  <div key={store.store_name} className="bg-slate-700 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-4">{store.store_name}</h4>
                    
                    <div className="space-y-4">
                      {storeConfigs.map((config) => {
                        // Check if this is a central server store (has live tank data)
                        const relatedTank = store.tanks?.find(tank => tank.tank_id === config.tank_id);
                        const isFromCentralServer = relatedTank?.latest_log?.timestamp;
                        
                        return (
                          <div key={`${config.store_name}-${config.tank_id}`} className="bg-slate-600 rounded p-3">
                            {isFromCentralServer && (
                              <div className="mb-3 flex items-center space-x-2 text-green-400 text-xs">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                <span>Live data from Central Tank Server</span>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div>
                                <label className="block text-slate-300 text-sm mb-1">Tank Name</label>
                                <input
                                  type="text"
                                  value={config.tank_name}
                                  onChange={(e) => handleTankConfigUpdate(config.store_name, config.tank_id, 'tank_name', e.target.value)}
                                  className="w-full bg-slate-500 text-white rounded px-3 py-2 text-sm"
                                  disabled={isFromCentralServer}
                                  title={isFromCentralServer ? "Tank name is managed by Central Tank Server" : ""}
                                />
                              </div>
                              
                              <div>
                                <label className="block text-slate-300 text-sm mb-1">Product Type</label>
                                <input
                                  type="text"
                                  value={config.product_type}
                                  onChange={(e) => handleTankConfigUpdate(config.store_name, config.tank_id, 'product_type', e.target.value)}
                                  className="w-full bg-slate-500 text-white rounded px-3 py-2 text-sm"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-slate-300 text-sm mb-1">
                                  Tank Capacity (gallons)
                                  <span className="text-slate-400 ml-1 text-xs">• Actual tank volume</span>
                                </label>
                                <input
                                  type="number"
                                  value={config.max_capacity_gallons || 10000}
                                  onChange={(e) => handleTankConfigUpdate(config.store_name, config.tank_id, 'max_capacity_gallons', parseFloat(e.target.value))}
                                  className="w-full bg-slate-500 text-white rounded px-3 py-2 text-sm"
                                  min="1000"
                                  max="25000"
                                  step="100"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-slate-300 text-sm mb-1">
                                  Tank Height (inches)
                                  <span className="text-slate-400 ml-1 text-xs">• Total tank height for chart axis</span>
                                </label>
                                <input
                                  type="number"
                                  value={config.max_height_inches || 96}
                                  onChange={(e) => handleTankConfigUpdate(config.store_name, config.tank_id, 'max_height_inches', parseFloat(e.target.value))}
                                  className="w-full bg-slate-500 text-white rounded px-3 py-2 text-sm"
                                  min="60"
                                  max="120"
                                  step="1"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-slate-300 text-sm mb-1">
                                  Critical Level (inches)
                                  <span className="text-slate-400 ml-1 text-xs">• Industry standard: 10"</span>
                                </label>
                                <input
                                  type="number"
                                  value={config.critical_height_inches}
                                  onChange={(e) => handleTankConfigUpdate(config.store_name, config.tank_id, 'critical_height_inches', parseFloat(e.target.value))}
                                  className="w-full bg-slate-500 text-white rounded px-3 py-2 text-sm"
                                  min="1"
                                  max="50"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-slate-300 text-sm mb-1">
                                  Warning Level (inches)
                                  <span className="text-slate-400 ml-1 text-xs">• Early warning threshold</span>
                                </label>
                                <input
                                  type="number"
                                  value={config.warning_height_inches || 20}
                                  onChange={(e) => handleTankConfigUpdate(config.store_name, config.tank_id, 'warning_height_inches', parseFloat(e.target.value))}
                                  className="w-full bg-slate-500 text-white rounded px-3 py-2 text-sm"
                                  min="5"
                                  max="100"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-slate-300 text-sm mb-1">
                                  Max Fill Ullage %
                                  <span className="text-slate-400 ml-1 text-xs">• Safe fill limit</span>
                                </label>
                                <input
                                  type="number"
                                  value={config.max_fill_ullage_percentage || 90}
                                  onChange={(e) => handleTankConfigUpdate(config.store_name, config.tank_id, 'max_fill_ullage_percentage', parseFloat(e.target.value))}
                                  className="w-full bg-slate-500 text-white rounded px-3 py-2 text-sm"
                                  min="50"
                                  max="95"
                                  step="0.5"
                                />
                              </div>
                            </div>
                            
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={config.alerts_enabled !== false}
                                    onChange={(e) => handleTankConfigUpdate(config.store_name, config.tank_id, 'alerts_enabled', e.target.checked)}
                                    className="rounded"
                                  />
                                  <span className="text-slate-300 text-sm">Enable Alerts</span>
                                </label>
                                
                                {!isFromCentralServer && (
                                  <label className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      checked={config.is_manual_data || false}
                                      onChange={(e) => handleTankConfigUpdate(config.store_name, config.tank_id, 'is_manual_data', e.target.checked)}
                                      className="rounded"
                                    />
                                    <span className="text-slate-300 text-sm">Manual Data Entry</span>
                                  </label>
                                )}
                              </div>
                              
                              {!isFromCentralServer && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete tank "${config.tank_name}"? This cannot be undone.`)) {
                                      const updated = tankConfigs.filter(c => 
                                        !(c.store_name === config.store_name && c.tank_id === config.tank_id)
                                      );
                                      setTankConfigs(updated);
                                      ConfigService.saveTankConfigurations(updated);
                                    }
                                  }}
                                  className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-900/30 transition-colors"
                                  title="Delete tank configuration"
                                >
                                  Delete Tank
                                </button>
                              )}
                            </div>
                            
                            {isFromCentralServer && (
                              <div className="mt-2 text-xs text-slate-400 bg-slate-700 rounded p-2">
                                ⚠️ This tank receives live data from the Central Tank Server. 
                                Tank name and some settings are managed centrally and cannot be deleted from here.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white">System Tools</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={exportConfig}
                  className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-lg text-white transition-colors"
                >
                  <Download className="w-5 h-5" />
                  <span>Export Configuration</span>
                </button>
                
                <label className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg text-white transition-colors cursor-pointer">
                  <Upload className="w-5 h-5" />
                  <span>Import Configuration</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={importConfig}
                    className="hidden"
                  />
                </label>
                
                <button
                  onClick={() => setShowDatabaseStatus(true)}
                  className="flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 px-4 py-3 rounded-lg text-white transition-colors"
                >
                  <Database className="w-5 h-5" />
                  <span>Database Status</span>
                </button>
                
                <button
                  onClick={showStoredConfigurations}
                  className="flex items-center justify-center space-x-2 bg-yellow-600 hover:bg-yellow-700 px-4 py-3 rounded-lg text-white transition-colors"
                >
                  <Eye className="w-5 h-5" />
                  <span>Debug Info</span>
                </button>
                
                <button
                  onClick={resetToDefaults}
                  className="flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg text-white transition-colors md:col-span-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Reset to Defaults</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Database Status Modal */}
      {showDatabaseStatus && (
        <DatabaseStatus onClose={() => setShowDatabaseStatus(false)} />
      )}
    </div>
  );
};