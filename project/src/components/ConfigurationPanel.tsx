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

  useEffect(() => {
    // Refresh data when panel opens
    setStoreHours(ConfigService.getStoreHours());
    setTankConfigs(ConfigService.getTankConfigurations());
  }, []);

  const handleStoreHoursUpdate = (storeName: string, field: string, value: any) => {
    const updated = storeHours.map(hours => 
      hours.store_name === storeName 
        ? { ...hours, [field]: value }
        : hours
    );
    setStoreHours(updated);
    ConfigService.saveStoreHours(updated);
  };

  const handleTankConfigUpdate = (storeName: string, tankId: number, field: string, value: any) => {
    const updated = tankConfigs.map(config => 
      config.store_name === storeName && config.tank_id === tankId
        ? { ...config, [field]: value }
        : config
    );
    setTankConfigs(updated);
    ConfigService.saveTankConfigurations(updated);
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
                <h3 className="text-lg font-semibold text-white">Store Hours & Admin Contacts</h3>
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
              <h3 className="text-lg font-semibold text-white">Tank Configurations</h3>
              
              {stores.map((store) => {
                const storeConfigs = tankConfigs.filter(config => config.store_name === store.store_name);
                
                return (
                  <div key={store.store_name} className="bg-slate-700 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-4">{store.store_name}</h4>
                    
                    <div className="space-y-4">
                      {storeConfigs.map((config) => (
                        <div key={`${config.store_name}-${config.tank_id}`} className="bg-slate-600 rounded p-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-slate-300 text-sm mb-1">Tank Name</label>
                              <input
                                type="text"
                                value={config.tank_name}
                                onChange={(e) => handleTankConfigUpdate(config.store_name, config.tank_id, 'tank_name', e.target.value)}
                                className="w-full bg-slate-500 text-white rounded px-3 py-2 text-sm"
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
                              <label className="block text-slate-300 text-sm mb-1">Critical Level (inches)</label>
                              <input
                                type="number"
                                value={config.critical_height_inches}
                                onChange={(e) => handleTankConfigUpdate(config.store_name, config.tank_id, 'critical_height_inches', parseFloat(e.target.value))}
                                className="w-full bg-slate-500 text-white rounded px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                          
                          <div className="mt-3 flex items-center space-x-4">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={config.alerts_enabled !== false}
                                onChange={(e) => handleTankConfigUpdate(config.store_name, config.tank_id, 'alerts_enabled', e.target.checked)}
                                className="rounded"
                              />
                              <span className="text-slate-300 text-sm">Enable Alerts</span>
                            </label>
                          </div>
                        </div>
                      ))}
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