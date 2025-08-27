// Configuration service for managing store hours and tank specifications
// Now syncs with Central Tank Server database as single source of truth
import { StoreHours, TankConfiguration } from '../types';

const STORAGE_KEYS = {
  STORE_HOURS: 'tank_monitor_store_hours',
  TANK_CONFIGS: 'tank_monitor_tank_configs',
};

// Central server API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://central-tank-server.onrender.com';

// Default store hours with admin contact information
const DEFAULT_STORE_HOURS: StoreHours[] = [
  {
    store_name: 'Mascoutah',
    open_hour: 5,
    close_hour: 23,
    timezone: 'America/Chicago',
    admin_name: 'Store Manager',
    admin_phone: '+1234567890',
    admin_email: 'manager@mascoutah.betterdayenergy.com',
    alerts_enabled: true,
    is_active: true,
  },
  {
    store_name: 'North City',
    open_hour: 5,
    close_hour: 23,
    timezone: 'America/Chicago',
    admin_name: 'Store Manager',
    admin_phone: '+1234567891',
    admin_email: 'manager@northcity.betterdayenergy.com',
    alerts_enabled: true,
    is_active: true,
  },
  {
    store_name: 'Pleasant Hill',
    open_hour: 5,
    close_hour: 23,
    timezone: 'America/Chicago',
    admin_name: 'Store Manager',
    admin_phone: '+1234567892',
    admin_email: 'manager@pleasanthill.betterdayenergy.com',
    alerts_enabled: true,
    is_active: true,
  },
];

// Default tank configurations - NO DIMENSIONS, only capacity and critical levels
const DEFAULT_TANK_CONFIGS: TankConfiguration[] = [
  // Mascoutah tanks
  {
    store_name: 'Mascoutah',
    tank_id: 1,
    tank_name: 'UNLEADED',
    product_type: 'Regular Unleaded',
    max_capacity_gallons: 10000,
    max_height_inches: 96,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'Mascoutah',
    tank_id: 2,
    tank_name: 'PREMIUM',
    product_type: 'Premium Unleaded',
    max_capacity_gallons: 10000,
    max_height_inches: 96,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'Mascoutah',
    tank_id: 3,
    tank_name: 'DIESEL',
    product_type: 'Diesel',
    max_capacity_gallons: 10000,
    max_height_inches: 96,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  // North City tanks
  {
    store_name: 'North City',
    tank_id: 1,
    tank_name: 'UNL T1',
    product_type: 'Regular Unleaded',
    max_capacity_gallons: 10000,
    max_height_inches: 96,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'North City',
    tank_id: 2,
    tank_name: 'UNL T2',
    product_type: 'Regular Unleaded',
    max_capacity_gallons: 10000,
    max_height_inches: 96,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'North City',
    tank_id: 3,
    tank_name: 'UNL T3',
    product_type: 'Regular Unleaded',
    max_capacity_gallons: 10000,
    max_height_inches: 96,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'North City',
    tank_id: 4,
    tank_name: 'PREM',
    product_type: 'Premium Unleaded',
    max_capacity_gallons: 10000,
    max_height_inches: 96,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'North City',
    tank_id: 5,
    tank_name: 'K1',
    product_type: 'Kerosene',
    max_capacity_gallons: 10000,
    max_height_inches: 96,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  // Pleasant Hill tanks
  {
    store_name: 'Pleasant Hill',
    tank_id: 1,
    tank_name: 'UNLEADED',
    product_type: 'Regular Unleaded',
    max_capacity_gallons: 10000,
    max_height_inches: 96,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'Pleasant Hill',
    tank_id: 2,
    tank_name: 'PREMIUM',
    product_type: 'Premium Unleaded',
    max_capacity_gallons: 10000,
    max_height_inches: 96,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'Pleasant Hill',
    tank_id: 3,
    tank_name: 'DIESEL',
    product_type: 'Diesel',
    max_capacity_gallons: 10000,
    max_height_inches: 96,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
];

export class ConfigService {
  private static migrationCompleted = false;

  // Migration method to ensure Pleasant Hill is included
  static migrateConfiguration(): void {
    // Only run migration once per session
    if (this.migrationCompleted) {
      return;
    }
    try {
      // Migrate store hours
      const stored = localStorage.getItem(STORAGE_KEYS.STORE_HOURS);
      if (stored) {
        const parsed = JSON.parse(stored);
        const hasPleasantHill = parsed.some((hours: StoreHours) => hours.store_name === 'Pleasant Hill');
        
        if (!hasPleasantHill) {
          console.log('🔄 Migrating store hours to include Pleasant Hill');
          const pleasantHillConfig = DEFAULT_STORE_HOURS.find(h => h.store_name === 'Pleasant Hill');
          if (pleasantHillConfig) {
            // Ensure Pleasant Hill is visible
            pleasantHillConfig.is_active = true;
            parsed.push(pleasantHillConfig);
            localStorage.setItem(STORAGE_KEYS.STORE_HOURS, JSON.stringify(parsed));
            console.log('✅ Pleasant Hill store hours added with is_active=true');
          }
        } else {
          // Ensure existing Pleasant Hill is visible
          const phIndex = parsed.findIndex((h: StoreHours) => h.store_name === 'Pleasant Hill');
          if (phIndex >= 0 && parsed[phIndex].is_active === false) {
            parsed[phIndex].is_active = true;
            localStorage.setItem(STORAGE_KEYS.STORE_HOURS, JSON.stringify(parsed));
            console.log('✅ Pleasant Hill visibility enabled');
          }
        }
        
        // Add Gibbs-Biggsville if it doesn't exist (note the hyphen!)
        const hasGibbsBiggsville = parsed.some((hours: StoreHours) => hours.store_name === 'Gibbs-Biggsville');
        if (!hasGibbsBiggsville) {
          console.log('🔄 Adding Gibbs-Biggsville to configuration');
          parsed.push({
            store_name: 'Gibbs-Biggsville',
            open_hour: 5,
            close_hour: 23,
            timezone: 'America/Chicago',
            admin_name: 'Store Manager',
            admin_phone: '+1234567890',
            admin_email: 'manager@gibbsbiggsville.betterdayenergy.com',
            alerts_enabled: true,
            is_active: true
          });
        }
        
        // Ensure key stores are always visible
        const keyStores = ['Mascoutah', 'North City', 'Pleasant Hill', 'Gibbs-Biggsville'];
        keyStores.forEach(storeName => {
          const storeIndex = parsed.findIndex((h: StoreHours) => h.store_name === storeName);
          if (storeIndex >= 0) {
            parsed[storeIndex].is_active = true;
          }
        });
        
        // Ensure all stores have is_active property
        const migratedHours = parsed.map((hours: StoreHours) => ({
          ...hours,
          is_active: hours.is_active !== false, // Default to true if not set
        }));
        localStorage.setItem(STORAGE_KEYS.STORE_HOURS, JSON.stringify(migratedHours));
      }
      
      // Migrate tank configurations
      const storedTanks = localStorage.getItem(STORAGE_KEYS.TANK_CONFIGS);
      if (storedTanks) {
        const parsed = JSON.parse(storedTanks);
        const hasPleasantHillTanks = parsed.some((config: any) => config.store_name === 'Pleasant Hill');
        
        if (!hasPleasantHillTanks) {
          console.log('🔄 Migrating tank configurations to include Pleasant Hill');
          const pleasantHillTankConfigs = DEFAULT_TANK_CONFIGS.filter(c => c.store_name === 'Pleasant Hill');
          if (pleasantHillTankConfigs.length > 0) {
            parsed.push(...pleasantHillTankConfigs);
            localStorage.setItem(STORAGE_KEYS.TANK_CONFIGS, JSON.stringify(parsed));
            console.log(`✅ Added ${pleasantHillTankConfigs.length} Pleasant Hill tank configurations`);
          }
        }
      } else {
        // No tank configs exist, initialize with defaults
        console.log('🔄 Initializing tank configurations with defaults including Pleasant Hill');
        localStorage.setItem(STORAGE_KEYS.TANK_CONFIGS, JSON.stringify(DEFAULT_TANK_CONFIGS));
      }
      
      // Mark migration as completed
      this.migrationCompleted = true;
    } catch (error) {
      console.error('Error during configuration migration:', error);
      // Don't mark as completed if migration failed
    }
  }

  // Store Hours Management (now includes admin contact info)
  static getStoreHours(): StoreHours[] {
    // Run migration first
    this.migrateConfiguration();
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.STORE_HOURS);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure all stores have admin contact fields (migration for existing data)
        return parsed.map((hours: StoreHours) => ({
          ...hours,
          admin_name: hours.admin_name || 'Store Manager',
          admin_phone: hours.admin_phone || '+1234567890',
          admin_email: hours.admin_email || `manager@${hours.store_name.toLowerCase().replace(/\s+/g, '')}.betterdayenergy.com`,
          alerts_enabled: hours.alerts_enabled !== false, // Default to true
          is_active: hours.is_active !== false, // Default to true - preserve visibility setting
        }));
      }
    } catch (error) {
      console.error('Error loading store hours:', error);
    }
    return DEFAULT_STORE_HOURS;
  }

  static saveStoreHours(storeHours: StoreHours[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.STORE_HOURS, JSON.stringify(storeHours));
    } catch (error) {
      console.error('Error saving store hours:', error);
    }
  }

  static getStoreHoursForStore(storeName: string): StoreHours | null {
    const allHours = this.getStoreHours();
    return allHours.find(hours => hours.store_name === storeName) || null;
  }

  static updateStoreHours(
    storeName: string, 
    openHour: number, 
    closeHour: number, 
    timezone: string = 'America/Chicago',
    adminName?: string,
    adminPhone?: string,
    adminEmail?: string,
    alertsEnabled: boolean = true
  ): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    const updatedHours: StoreHours = {
      store_name: storeName,
      open_hour: openHour,
      close_hour: closeHour,
      timezone,
      admin_name: adminName || 'Store Manager',
      admin_phone: adminPhone || '+1234567890',
      admin_email: adminEmail || `manager@${storeName.toLowerCase().replace(/\s+/g, '')}.betterdayenergy.com`,
      alerts_enabled: alertsEnabled,
    };

    if (existingIndex >= 0) {
      allHours[existingIndex] = updatedHours;
    } else {
      allHours.push(updatedHours);
    }

    this.saveStoreHours(allHours);
  }

  // Enhanced method to update just admin contact info
  static updateStoreAdminContact(
    storeName: string,
    adminName: string,
    adminPhone: string,
    adminEmail?: string,
    alertsEnabled: boolean = true
  ): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        admin_name: adminName,
        admin_phone: adminPhone,
        admin_email: adminEmail || allHours[existingIndex].admin_email,
        alerts_enabled: alertsEnabled,
      };
    } else {
      // Create new store hours entry with defaults
      const newHours: StoreHours = {
        store_name: storeName,
        open_hour: 5,
        close_hour: 23,
        timezone: 'America/Chicago',
        admin_name: adminName,
        admin_phone: adminPhone,
        admin_email: adminEmail || `manager@${storeName.toLowerCase().replace(/\s+/g, '')}.betterdayenergy.com`,
        alerts_enabled: alertsEnabled,
      };
      allHours.push(newHours);
    }

    this.saveStoreHours(allHours);
  }

  // Get admin contact for a specific store
  static getStoreAdminContact(storeName: string): { name: string; phone: string; email?: string; alertsEnabled: boolean } | null {
    const storeHours = this.getStoreHoursForStore(storeName);
    if (!storeHours) return null;

    return {
      name: storeHours.admin_name || 'Store Manager',
      phone: storeHours.admin_phone || '+1234567890',
      email: storeHours.admin_email,
      alertsEnabled: storeHours.alerts_enabled !== false,
    };
  }

  // Tank Configuration Management (uses manual capacity input)
  static getTankConfigurations(): TankConfiguration[] {
    // Run migration first to ensure Pleasant Hill tanks are included (protected by flag)
    this.migrateConfiguration();
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TANK_CONFIGS);
      if (stored) {
        const configs = JSON.parse(stored);
        // Use manual capacity or default to 10,000 gallons
        return configs.map((config: TankConfiguration) => ({
          ...config,
          max_capacity_gallons: config.max_capacity_gallons || 10000, // Default capacity if not set
          alerts_enabled: config.alerts_enabled !== false, // Default to true
        }));
      }
    } catch (error) {
      console.error('Error loading tank configurations:', error);
    }
    
    // Return default configs with their configured capacity
    return DEFAULT_TANK_CONFIGS.map(config => ({
      ...config,
      max_capacity_gallons: config.max_capacity_gallons || 10000, // Use configured capacity or default
    }));
  }

  static saveTankConfigurations(tankConfigs: TankConfiguration[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TANK_CONFIGS, JSON.stringify(tankConfigs));
    } catch (error) {
      console.error('Error saving tank configurations:', error);
    }
  }

  static getTankConfiguration(storeName: string, tankId: number): TankConfiguration | null {
    const allConfigs = this.getTankConfigurations();
    return allConfigs.find(config => config.store_name === storeName && config.tank_id === tankId) || null;
  }

  static updateTankConfiguration(config: TankConfiguration): void {
    const allConfigs = this.getTankConfigurations();
    const existingIndex = allConfigs.findIndex(
      c => c.store_name === config.store_name && c.tank_id === config.tank_id
    );

    // Use the manually configured capacity
    const updatedConfig = {
      ...config,
      max_capacity_gallons: config.max_capacity_gallons || 10000, // Use configured capacity or default
      alerts_enabled: config.alerts_enabled !== false, // Default to true
    };

    if (existingIndex >= 0) {
      allConfigs[existingIndex] = updatedConfig;
    } else {
      allConfigs.push(updatedConfig);
    }

    this.saveTankConfigurations(allConfigs);
  }

  static getStoreConfigurations(storeName: string): TankConfiguration[] {
    const allConfigs = this.getTankConfigurations();
    return allConfigs.filter(config => config.store_name === storeName);
  }

  // Auto-configuration helper for new stores (enhanced with admin contact)
  static autoConfigureNewStore(storeName: string, tankCount: number, tankData?: any[]): void {
    console.log(`🔧 Auto-configuring new store: ${storeName} with ${tankCount} tanks`);
    
    // Use Mascoutah as the template for new stores
    const templateHours = this.getStoreHoursForStore('Mascoutah') || DEFAULT_STORE_HOURS[0];

    // Add store hours with admin contact
    this.updateStoreHours(
      storeName, 
      templateHours.open_hour, 
      templateHours.close_hour, 
      templateHours.timezone,
      'Store Manager', // Default admin name
      '+1234567890', // Default phone (should be updated by admin)
      `manager@${storeName.toLowerCase().replace(/\s+/g, '')}.betterdayenergy.com`, // Auto-generated email
      true // Enable alerts by default
    );

    // Auto-configure tanks based on detected data or use defaults
    for (let i = 1; i <= tankCount; i++) {
      const existingConfig = this.getTankConfiguration(storeName, i);
      if (!existingConfig) {
        let tankName = `TANK ${i}`;
        let productType = 'Regular Unleaded';

        // Try to determine tank type from data if available
        if (tankData && tankData[i - 1]) {
          const tank = tankData[i - 1];
          if (tank.latest_log?.product) {
            const product = tank.latest_log.product.toLowerCase();
            if (product.includes('unleaded') || product.includes('unl')) {
              if (product.includes('premium') || product.includes('prem')) {
                tankName = 'PREMIUM';
                productType = 'Premium Unleaded';
              } else {
                tankName = 'UNLEADED';
                productType = 'Regular Unleaded';
              }
            } else if (product.includes('diesel')) {
              tankName = 'DIESEL';
              productType = 'Diesel';
            } else if (product.includes('kerosene') || product.includes('k1')) {
              tankName = 'K1';
              productType = 'Kerosene';
            } else {
              tankName = tank.latest_log.product.toUpperCase();
              productType = tank.latest_log.product;
            }
          }
        } else {
          // Use standard naming pattern
          if (i === 1) {
            tankName = 'UNLEADED';
            productType = 'Regular Unleaded';
          } else if (i === 2) {
            tankName = 'PREMIUM';
            productType = 'Premium Unleaded';
          } else if (i === 3) {
            tankName = 'DIESEL';
            productType = 'Diesel';
          } else {
            tankName = `TANK ${i}`;
            productType = 'Regular Unleaded';
          }
        }

        const newConfig: TankConfiguration = {
          store_name: storeName,
          tank_id: i,
          tank_name: tankName,
          product_type: productType,
          max_capacity_gallons: 10000, // Default 10,000 gallon capacity
          max_height_inches: 96, // Default 96" height
          critical_height_inches: 10,
          warning_height_inches: 20,
          alerts_enabled: true, // Enable alerts by default
        };

        this.updateTankConfiguration(newConfig);
        console.log(`✅ Auto-configured tank ${i}: ${tankName} (${productType})`);
      }
    }

    console.log(`✅ Auto-configured admin contact for ${storeName} (please update phone number)`);
  }


  // Reset to defaults
  static resetToDefaults(): void {
    localStorage.removeItem(STORAGE_KEYS.STORE_HOURS);
    localStorage.removeItem(STORAGE_KEYS.TANK_CONFIGS);
  }

  // Remove specific stores from frontend configuration
  static removeTestStores(): void {
    const testStoreNames = [
      'Pioneer Express Perry', 
      "Jethro's Pontoon Beach",
      'Test Store',
      'Demo Store',
      'Gibbs Biggsville'  // Remove the old incorrect name if it exists
    ];

    // Remove from store hours
    const storeHours = this.getStoreHours();
    const filteredHours = storeHours.filter(hours => 
      !testStoreNames.includes(hours.store_name)
    );
    this.saveStoreHours(filteredHours);

    // Remove from tank configurations  
    const tankConfigs = this.getTankConfigurations();
    const filteredConfigs = tankConfigs.filter(config =>
      !testStoreNames.includes(config.store_name)
    );
    this.saveTankConfigurations(filteredConfigs);

    console.log('🧹 Removed test stores from frontend configuration:', testStoreNames);
  }

  // Export/Import functionality (enhanced to include admin contacts)
  static exportConfiguration(): string {
    const config = {
      storeHours: this.getStoreHours(),
      tankConfigurations: this.getTankConfigurations(),
      exportDate: new Date().toISOString(),
      version: '2.0', // Version with admin contacts
    };
    return JSON.stringify(config, null, 2);
  }

  static importConfiguration(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson);
      
      if (config.storeHours && Array.isArray(config.storeHours)) {
        // Migrate old format if needed
        const migratedHours = config.storeHours.map((hours: any) => ({
          ...hours,
          admin_name: hours.admin_name || 'Store Manager',
          admin_phone: hours.admin_phone || '+1234567890',
          admin_email: hours.admin_email || `manager@${hours.store_name.toLowerCase().replace(/\s+/g, '')}.betterdayenergy.com`,
          alerts_enabled: hours.alerts_enabled !== false,
        }));
        this.saveStoreHours(migratedHours);
      }
      
      if (config.tankConfigurations && Array.isArray(config.tankConfigurations)) {
        this.saveTankConfigurations(config.tankConfigurations);
      }
      
      return true;
    } catch (error) {
      console.error('Error importing configuration:', error);
      return false;
    }
  }

  // ===== CENTRAL SERVER DATABASE SYNC METHODS =====
  // These methods sync configuration with the central server database
  
  /**
   * Fetch tank configurations from central server database
   */
  static async fetchTankConfigurationsFromServer(): Promise<TankConfiguration[]> {
    try {
      // Use admin endpoint to get all tank configurations including max_fill_ullage_percentage
      const response = await fetch(`${API_BASE_URL}/admin/tanks`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      const configurations: TankConfiguration[] = [];
      
      // The admin endpoint returns an array of tanks
      if (data.tanks && Array.isArray(data.tanks)) {
        for (const tank of data.tanks) {
          configurations.push({
            store_name: tank.store_name,
            tank_id: tank.tank_id,
            tank_name: tank.tank_name,
            product_type: tank.product_type,
            max_capacity_gallons: tank.max_capacity_gallons || 10000,
            max_height_inches: tank.max_height_inches || 96,  // ADD THIS LINE!
            critical_height_inches: tank.critical_height_inches || 10,
            warning_height_inches: tank.warning_height_inches || 20,
            max_fill_ullage_percentage: tank.max_fill_ullage_percentage || 90,
            alerts_enabled: tank.alerts_enabled !== false
          });
        }
      }
      
      console.log(`✅ Fetched ${configurations.length} tank configurations from central server`);
      return configurations;
    } catch (error) {
      console.error('❌ Failed to fetch tank configurations from server:', error);
      throw error;
    }
  }

  /**
   * Push tank configuration to central server database
   */
  static async pushTankConfigurationToServer(config: TankConfiguration): Promise<void> {
    try {
      // Use the admin endpoint which supports all fields including max_fill_ullage_percentage
      const serverConfig = {
        tank_name: config.tank_name,
        product_type: config.product_type,
        max_capacity_gallons: config.max_capacity_gallons,
        critical_height_inches: config.critical_height_inches,
        warning_height_inches: config.warning_height_inches,
        max_fill_ullage_percentage: config.max_fill_ullage_percentage || 90,
        alerts_enabled: config.alerts_enabled
      };

      const response = await fetch(`${API_BASE_URL}/admin/tanks/${config.store_name}/${config.tank_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverConfig)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
      console.log(`✅ Synced tank ${config.store_name} Tank ${config.tank_id} to central server`);
    } catch (error) {
      console.error(`❌ Failed to sync tank configuration to server:`, error);
      throw error;
    }
  }

  /**
   * Enhanced updateTankConfiguration that syncs with central server
   */
  static async updateTankConfigurationWithSync(config: TankConfiguration): Promise<void> {
    try {
      // Update local storage first (for fallback)
      this.updateTankConfiguration(config);
      
      // Sync to central server database
      await this.pushTankConfigurationToServer(config);
      
      console.log(`✅ Tank configuration updated locally and synced to central server`);
    } catch (error) {
      console.error('❌ Failed to sync tank configuration. Local changes saved, server sync failed:', error);
      // Local changes are still saved, server sync failed
      throw error;
    }
  }

  /**
   * Load tank configurations from central server and cache locally
   */
  static async syncTankConfigurationsFromServer(): Promise<TankConfiguration[]> {
    try {
      const serverConfigs = await this.fetchTankConfigurationsFromServer();
      
      // Save to local storage as cache
      this.saveTankConfigurations(serverConfigs);
      
      console.log(`✅ Synced ${serverConfigs.length} tank configurations from central server`);
      return serverConfigs;
    } catch (error) {
      console.warn('⚠️ Failed to sync from server, using local cache');
      // Fall back to local storage if server is unavailable
      return this.getTankConfigurations();
    }
  }

  /**
   * Get tank configuration with automatic server sync fallback
   */
  static async getTankConfigurationWithSync(storeName: string, tankId: number): Promise<TankConfiguration | null> {
    // Try local first
    let config = this.getTankConfiguration(storeName, tankId);
    
    if (!config) {
      try {
        // If not found locally, try syncing from server
        const synced = await this.syncTankConfigurationsFromServer();
        config = synced.find(c => c.store_name === storeName && c.tank_id === tankId) || null;
      } catch (error) {
        console.warn('Failed to sync from server for tank lookup');
      }
    }
    
    return config;
  }

  // ===== STORE VISIBILITY METHODS =====
  // These methods control which stores appear in the dashboard

  /**
   * Get stores that should be visible in the dashboard (is_active = true)
   */
  static getVisibleStores(): string[] {
    const allHours = this.getStoreHours();
    return allHours
      .filter(hours => hours.is_active !== false) // Default to visible if not set
      .map(hours => hours.store_name);
  }

  /**
   * Get stores that have alerts enabled
   */
  static getActiveStores(): string[] {
    const allHours = this.getStoreHours();
    return allHours
      .filter(hours => hours.alerts_enabled !== false) // Default to enabled if not set
      .map(hours => hours.store_name);
  }

  /**
   * Check if a store should be visible in dashboard
   */
  static isStoreVisible(storeName: string): boolean {
    const storeHours = this.getStoreHoursForStore(storeName);
    return storeHours ? storeHours.is_active !== false : true; // Default to visible
  }

  /**
   * Check if a store has alerts enabled
   */
  static isStoreAlertsEnabled(storeName: string): boolean {
    const storeHours = this.getStoreHoursForStore(storeName);
    return storeHours ? storeHours.alerts_enabled !== false : true; // Default to enabled
  }

  // ===== STORE CONFIGURATION SYNC WITH CENTRAL SERVER =====
  // These methods sync store settings (hours, alerts) with the backend

  /**
   * Fetch store configurations from central server database
   */
  static async fetchStoreConfigurationsFromServer(): Promise<StoreHours[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/stores`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      const configurations: StoreHours[] = [];
      
      if (data.stores && Array.isArray(data.stores)) {
        for (const store of data.stores) {
          configurations.push({
            store_name: store.store_name,
            open_hour: store.open_hour || 5,
            close_hour: store.close_hour || 23,
            timezone: store.timezone || 'America/Chicago',
            admin_name: store.admin_name || 'Store Manager',
            admin_phone: store.admin_phone || '+1234567890',
            admin_email: store.admin_email || `manager@${store.store_name.toLowerCase().replace(/\s+/g, '')}.betterdayenergy.com`,
            alerts_enabled: store.alerts_enabled !== false,
            is_active: true // Stores from database are always visible
          });
        }
      }
      
      console.log(`✅ Fetched ${configurations.length} store configurations from central server`);
      return configurations;
    } catch (error) {
      console.error('❌ Failed to fetch store configurations from server:', error);
      throw error;
    }
  }

  /**
   * Get store configurations with server sync fallback
   */
  static async getStoreHoursWithServerSync(): Promise<StoreHours[]> {
    try {
      // Try to fetch from server first
      const serverConfigs = await this.fetchStoreConfigurationsFromServer();
      
      // Update local storage with server data
      this.saveStoreHours(serverConfigs);
      
      return serverConfigs;
    } catch (error) {
      console.warn('⚠️ Failed to sync from server, using local cache');
      // Fall back to local storage if server is unavailable
      return this.getStoreHours();
    }
  }

  /**
   * Push store configuration to central server database
   */
  static async pushStoreConfigurationToServer(storeHours: StoreHours): Promise<void> {
    try {
      const serverConfig = {
        open_hour: storeHours.open_hour,
        close_hour: storeHours.close_hour,
        timezone: storeHours.timezone,
        admin_name: storeHours.admin_name || 'Store Manager',
        admin_phone: storeHours.admin_phone || '+1234567890',
        admin_email: storeHours.admin_email || `manager@${storeHours.store_name.toLowerCase().replace(/\s+/g, '')}.betterdayenergy.com`,
        alerts_enabled: storeHours.alerts_enabled !== false
      };

      const response = await fetch(`${API_BASE_URL}/admin/stores/${storeHours.store_name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverConfig)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
      console.log(`✅ Synced store configuration for ${storeHours.store_name} to central server`);
    } catch (error) {
      console.error(`❌ Failed to sync store configuration to server:`, error);
      throw error;
    }
  }

  /**
   * Enhanced updateStoreHours that syncs with central server
   */
  static async updateStoreHoursWithSync(
    storeName: string, 
    openHour: number, 
    closeHour: number, 
    timezone: string = 'America/Chicago',
    adminName?: string,
    adminPhone?: string,
    adminEmail?: string,
    alertsEnabled: boolean = true
  ): Promise<void> {
    try {
      // Update local storage first (for fallback)
      this.updateStoreHours(storeName, openHour, closeHour, timezone, adminName, adminPhone, adminEmail, alertsEnabled);
      
      // Get the updated config and sync to central server
      const updatedConfig = this.getStoreHoursForStore(storeName);
      if (updatedConfig) {
        await this.pushStoreConfigurationToServer(updatedConfig);
      }
      
      console.log(`✅ Store configuration updated locally and synced to central server`);
    } catch (error) {
      console.error('❌ Failed to sync store configuration. Local changes saved, server sync failed:', error);
      // Local changes are still saved, server sync failed
      throw error;
    }
  }

  /**
   * Enhanced updateStoreAdminContact that syncs with central server
   */
  static async updateStoreAdminContactWithSync(
    storeName: string,
    adminName: string,
    adminPhone: string,
    adminEmail?: string,
    alertsEnabled: boolean = true
  ): Promise<void> {
    try {
      // Update local storage first
      this.updateStoreAdminContact(storeName, adminName, adminPhone, adminEmail, alertsEnabled);
      
      // Get the updated config and sync to central server
      const updatedConfig = this.getStoreHoursForStore(storeName);
      if (updatedConfig) {
        await this.pushStoreConfigurationToServer(updatedConfig);
      }
      
      console.log(`✅ Store admin contact updated locally and synced to central server`);
    } catch (error) {
      console.error('❌ Failed to sync store admin contact. Local changes saved, server sync failed:', error);
      throw error;
    }
  }
}