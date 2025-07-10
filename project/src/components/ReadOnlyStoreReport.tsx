// Configuration service for managing store hours and tank specifications
import { StoreHours, TankConfiguration } from '../types';

const STORAGE_KEYS = {
  STORE_HOURS: 'tank_monitor_store_hours',
  TANK_CONFIGS: 'tank_monitor_tank_configs',
};

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
  },
];

// Default tank configurations based on your original system
const DEFAULT_TANK_CONFIGS: TankConfiguration[] = [
  // Mascoutah tanks
  {
    store_name: 'Mascoutah',
    tank_id: 1,
    tank_name: 'UNLEADED',
    product_type: 'Regular Unleaded',
    diameter_inches: 96,
    length_inches: 319.3,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'Mascoutah',
    tank_id: 2,
    tank_name: 'PREMIUM',
    product_type: 'Premium Unleaded',
    diameter_inches: 96,
    length_inches: 319.3,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'Mascoutah',
    tank_id: 3,
    tank_name: 'DIESEL',
    product_type: 'Diesel',
    diameter_inches: 96,
    length_inches: 319.3,
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
    diameter_inches: 96,
    length_inches: 319.3,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'North City',
    tank_id: 2,
    tank_name: 'UNL T2',
    product_type: 'Regular Unleaded',
    diameter_inches: 96,
    length_inches: 319.3,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'North City',
    tank_id: 3,
    tank_name: 'UNL T3',
    product_type: 'Regular Unleaded',
    diameter_inches: 96,
    length_inches: 319.3,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'North City',
    tank_id: 4,
    tank_name: 'PREM',
    product_type: 'Premium Unleaded',
    diameter_inches: 96,
    length_inches: 319.3,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
  {
    store_name: 'North City',
    tank_id: 5,
    tank_name: 'K1',
    product_type: 'Kerosene',
    diameter_inches: 96,
    length_inches: 319.3,
    critical_height_inches: 10,
    warning_height_inches: 20,
    alerts_enabled: true,
  },
];

export class ConfigService {
  // Store Hours Management (now includes admin contact info)
  static getStoreHours(): StoreHours[] {
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

  // Tank Configuration Management (unchanged)
  static getTankConfigurations(): TankConfiguration[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TANK_CONFIGS);
      if (stored) {
        const configs = JSON.parse(stored);
        // Calculate max capacity for each tank if not already set
        return configs.map((config: TankConfiguration) => ({
          ...config,
          max_capacity_gallons: config.max_capacity_gallons || this.calculateMaxCapacity(config.diameter_inches, config.length_inches),
          alerts_enabled: config.alerts_enabled !== false, // Default to true
        }));
      }
    } catch (error) {
      console.error('Error loading tank configurations:', error);
    }
    
    // Return default configs with calculated capacities
    return DEFAULT_TANK_CONFIGS.map(config => ({
      ...config,
      max_capacity_gallons: this.calculateMaxCapacity(config.diameter_inches, config.length_inches),
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

    // Calculate max capacity
    const updatedConfig = {
      ...config,
      max_capacity_gallons: this.calculateMaxCapacity(config.diameter_inches, config.length_inches),
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
    console.log(`📊 Tank data provided:`, tankData);
    console.log(`📊 Tank data provided:`, tankData);
    console.log(`📊 Tank data provided:`, tankData);
    console.log(`📊 Tank data provided:`, tankData);
    console.log(`📊 Tank data provided:`, tankData);
    console.log(`📊 Tank data provided:`, tankData);
    
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
        let diameter = 96; // Default
        let length = 319.3; // Default
        let diameter = 96; // Default
        let length = 319.3; // Default
        let diameter = 96; // Default
        let length = 319.3; // Default
        let diameter = 96; // Default
        let length = 319.3; // Default
        let diameter = 96; // Default
        let length = 319.3; // Default
        let diameter = 96; // Default
        let length = 319.3; // Default

        // Try to determine tank type from data if available
        if (tankData && tankData[i - 1]) {
          const tank = tankData[i - 1];
          
          // Use tank name from API if available
          if (tank.tank_name) {
            tankName = tank.tank_name;
          }
          
          // Determine product type from tank name or latest log
          const productSource = tank.tank_name || tank.latest_log?.product || '';
          if (productSource) {
            const product = productSource.toLowerCase();
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
              tankName = productSource.toUpperCase();
              productType = productSource;
            }
          }
          
          console.log(`🔧 Auto-configured tank ${i}: ${tankName} (${productType})`);
          
          console.log(`🔧 Auto-configured tank ${i}: ${tankName} (${productType})`);
          
          console.log(`🔧 Auto-configured tank ${i}: ${tankName} (${productType})`);
          
          console.log(`🔧 Auto-configured tank ${i}: ${tankName} (${productType})`);
          
          console.log(`🔧 Auto-configured tank ${i}: ${tankName} (${productType})`);
          
          console.log(`🔧 Auto-configured tank ${i}: ${tankName} (${productType})`);
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
          diameter_inches: diameter,
          length_inches: length,
          critical_height_inches: 10,
          warning_height_inches: 20,
          alerts_enabled: true, // Enable alerts by default
        };

        this.updateTankConfiguration(newConfig);
        console.log(`✅ Auto-configured tank ${i}: ${tankName} (${productType}) - ${diameter}" × ${length}"`);
      }
    }

    console.log(`✅ Auto-configured admin contact for ${storeName} (please update phone number)`);
  }

  // Enhanced method to mark stores as test data
  static markStoreAsTestData(storeName: string, isTestData: boolean): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        is_test_data: isTestData,
      };
      this.saveStoreHours(allHours);
    }
  }

  // Enhanced method to toggle store visibility
  static toggleStoreVisibility(storeName: string): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        is_active: !allHours[existingIndex].is_active,
      };
      this.saveStoreHours(allHours);
    }
  }

  // Get visible stores (not hidden)
  static getVisibleStores(): string[] {
    return this.getStoreHours()
      .filter(hours => hours.is_active !== false)
      .map(hours => hours.store_name);
  }

  // Get active stores (visible and not test data)
  static getActiveStores(): string[] {
    return this.getStoreHours()
      .filter(hours => hours.is_active !== false && !hours.is_test_data)
      .map(hours => hours.store_name);
  }

  // Enhanced method to mark stores as test data
  static markStoreAsTestData(storeName: string, isTestData: boolean): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        is_test_data: isTestData,
      };
      this.saveStoreHours(allHours);
    }
  }

  // Enhanced method to toggle store visibility
  static toggleStoreVisibility(storeName: string): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        is_active: !allHours[existingIndex].is_active,
      };
      this.saveStoreHours(allHours);
    }
  }

  // Get visible stores (not hidden)
  static getVisibleStores(): string[] {
    return this.getStoreHours()
      .filter(hours => hours.is_active !== false)
      .map(hours => hours.store_name);
  }

  // Get active stores (visible and not test data)
  static getActiveStores(): string[] {
    return this.getStoreHours()
      .filter(hours => hours.is_active !== false && !hours.is_test_data)
      .map(hours => hours.store_name);
  }

  // Enhanced method to mark stores as test data
  static markStoreAsTestData(storeName: string, isTestData: boolean): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        is_test_data: isTestData,
      };
      this.saveStoreHours(allHours);
    }
  }

  // Enhanced method to toggle store visibility
  static toggleStoreVisibility(storeName: string): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        is_active: !allHours[existingIndex].is_active,
      };
      this.saveStoreHours(allHours);
    }
  }

  // Get visible stores (not hidden)
  static getVisibleStores(): string[] {
    return this.getStoreHours()
      .filter(hours => hours.is_active !== false)
      .map(hours => hours.store_name);
  }

  // Get active stores (visible and not test data)
  static getActiveStores(): string[] {
    return this.getStoreHours()
      .filter(hours => hours.is_active !== false && !hours.is_test_data)
      .map(hours => hours.store_name);
  }

  // Enhanced method to mark stores as test data
  static markStoreAsTestData(storeName: string, isTestData: boolean): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        is_test_data: isTestData,
      };
      this.saveStoreHours(allHours);
    }
  }

  // Enhanced method to toggle store visibility
  static toggleStoreVisibility(storeName: string): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        is_active: !allHours[existingIndex].is_active,
      };
      this.saveStoreHours(allHours);
    }
  }

  // Get visible stores (not hidden)
  static getVisibleStores(): string[] {
    return this.getStoreHours()
      .filter(hours => hours.is_active !== false)
      .map(hours => hours.store_name);
  }

  // Get active stores (visible and not test data)
  static getActiveStores(): string[] {
    return this.getStoreHours()
      .filter(hours => hours.is_active !== false && !hours.is_test_data)
      .map(hours => hours.store_name);
  }

  // Enhanced method to mark stores as test data
  static markStoreAsTestData(storeName: string, isTestData: boolean): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        is_test_data: isTestData,
      };
      this.saveStoreHours(allHours);
    }
  }

  // Enhanced method to toggle store visibility
  static toggleStoreVisibility(storeName: string): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        is_active: !allHours[existingIndex].is_active,
      };
      this.saveStoreHours(allHours);
    }
  }

  // Get visible stores (not hidden)
  static getVisibleStores(): string[] {
    return this.getStoreHours()
      .filter(hours => hours.is_active !== false)
      .map(hours => hours.store_name);
  }

  // Get active stores (visible and not test data)
  static getActiveStores(): string[] {
    return this.getStoreHours()
      .filter(hours => hours.is_active !== false && !hours.is_test_data)
      .map(hours => hours.store_name);
  }

  // Enhanced method to mark stores as test data
  static markStoreAsTestData(storeName: string, isTestData: boolean): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        is_test_data: isTestData,
      };
      this.saveStoreHours(allHours);
    }
  }

  // Enhanced method to toggle store visibility
  static toggleStoreVisibility(storeName: string): void {
    const allHours = this.getStoreHours();
    const existingIndex = allHours.findIndex(hours => hours.store_name === storeName);
    
    if (existingIndex >= 0) {
      allHours[existingIndex] = {
        ...allHours[existingIndex],
        is_active: !allHours[existingIndex].is_active,
      };
      this.saveStoreHours(allHours);
    }
  }

  // Get visible stores (not hidden)
  static getVisibleStores(): string[] {
    return this.getStoreHours()
      .filter(hours => hours.is_active !== false)
      .map(hours => hours.store_name);
  }

  // Get active stores (visible and not test data)
  static getActiveStores(): string[] {
    return this.getStoreHours()
      .filter(hours => hours.is_active !== false && !hours.is_test_data)
      .map(hours => hours.store_name);
  }

  // Helper method to calculate tank capacity using cylindrical geometry
  private static calculateMaxCapacity(diameterInches: number, lengthInches: number): number {
    try {
      const r = diameterInches / 2;
      const h = diameterInches; // Full height
      const L = lengthInches;
      
      if (h <= 0 || h > diameterInches || !isFinite(h) || !isFinite(r) || !isFinite(L)) {
        return 8000; // Default capacity
      }
      
      const theta = Math.acos((r - h) / r);
      if (!isFinite(theta)) return 8000;
      
      const segmentArea = (r ** 2) * (theta - Math.sin(2 * theta) / 2);
      if (!isFinite(segmentArea)) return 8000;
      
      const volumeCubicInches = segmentArea * L;
      const gallons = volumeCubicInches / 231; // Convert to gallons
      
      return isFinite(gallons) ? Math.round(Math.max(0, gallons)) : 8000;
    } catch (error) {
      console.error('Error calculating tank capacity:', error);
      return 8000;
    }
  }

  // Reset to defaults
  static resetToDefaults(): void {
    localStorage.removeItem(STORAGE_KEYS.STORE_HOURS);
    localStorage.removeItem(STORAGE_KEYS.TANK_CONFIGS);
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
          is_active: hours.is_active !== false,
          is_test_data: hours.is_test_data || false,
          is_active: hours.is_active !== false,
          is_test_data: hours.is_test_data || false,
          is_active: hours.is_active !== false,
          is_test_data: hours.is_test_data || false,
          is_active: hours.is_active !== false,
          is_test_data: hours.is_test_data || false,
          is_active: hours.is_active !== false,
          is_test_data: hours.is_test_data || false,
          is_active: hours.is_active !== false,
          is_test_data: hours.is_test_data || false,
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
}