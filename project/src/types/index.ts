// ===== CONFIGURATION DATA (Database-stored, Admin-managed) =====

export interface StoreConfiguration {
  store_name: string;
  open_hour: number;
  close_hour: number;
  timezone: string;
  admin_name?: string;
  admin_phone?: string;
  admin_email?: string;
  alerts_enabled?: boolean;
  // Alert frequency settings
  critical_height_hours?: number;
  warning_height_hours?: number;
  predictive_warning_hours?: number;
  daily_summary_enabled?: boolean;
  daily_summary_time?: string;
  offline_threshold_hours?: number;
  offline_alerts_enabled?: boolean;
}

// StoreHours interface for legacy compatibility and dashboard visibility
export interface StoreHours {
  store_name: string;
  open_hour: number;
  close_hour: number;
  timezone: string;
  admin_name?: string;
  admin_phone?: string;
  admin_email?: string;
  alerts_enabled?: boolean;
  is_active?: boolean; // Controls dashboard visibility
}

export interface StoreContact {
  id?: number;
  store_name: string;
  contact_name: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
  alerts_enabled: boolean;
  contact_type: 'operations' | 'manager' | 'owner' | 'emergency';
}

export interface TankConfiguration {
  store_name: string;
  tank_id: number;
  tank_name: string;
  product_type: string;
  max_capacity_gallons: number;
  max_height_inches: number; // Total tank height in inches (for chart axis)
  critical_height_inches: number;
  warning_height_inches: number;
  max_fill_ullage_percentage: number; // Configurable max fill ullage (default 90%)
  // Alert configuration
  alerts_enabled?: boolean;
  critical_height_enabled?: boolean;
  warning_height_enabled?: boolean;
  predictive_enabled?: boolean;
  custom_critical_height?: number;
  custom_warning_height?: number;
  custom_warning_hours?: number;
  alert_phone_number?: string; // Override for specific tank
}

// ===== MEASUREMENT DATA (Central Server) =====

export interface TankLog {
  id?: number;
  store_name: string;
  tank_id: number;
  product: string;
  volume: number;
  tc_volume: number;
  ullage: number;
  height: number;
  water: number;
  temp: number;
  timestamp: string;
}

export interface TankAnalytics {
  run_rate?: number;
  hours_to_critical?: number;
  predicted_empty?: string;
  predicted_height_48h?: number;
}

// ===== COMBINED INTERFACES =====

export interface Tank {
  tank_id: number;
  tank_name: string;
  product: string;
  display_alias?: string;  // New field for custom display name
  ninety_percent_ullage?: number;  // New field for 90% ullage calculation
  // Measurement data from central server
  latest_log?: TankLog;
  logs?: TankLog[];
  run_rate?: number;
  hours_to_10_inches?: number;
  predicted_time?: string;
  status?: 'normal' | 'warning' | 'critical';
  analytics?: TankAnalytics;
  capacity_percentage?: number;
  // Configuration data from database
  configuration?: TankConfiguration;
}

export interface Store {
  store_name: string;
  tanks: Tank[];
  last_updated?: string;
  // Configuration data from database
  configuration?: StoreConfiguration;
}

// ===== API & CHART INTERFACES =====

export interface ChartDataPoint {
  timestamp: string;
  tc_volume: number;
  height: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

// ===== ALERT SYSTEM =====

export interface AlertHistory {
  id: string;
  store_name: string;
  tank_id: number;
  alert_type: 'warning' | 'critical';
  phone_number: string;
  message: string;
  sent_at: string;
  status: 'sent' | 'failed' | 'pending';
  hours_to_empty: number;
  message_sid?: string;
}

export interface SMSConfig {
  enabled: boolean;
  service_provider: 'twilio' | 'textbelt' | 'custom';
  api_key?: string;
  from_number?: string;
  webhook_url?: string;
  test_mode: boolean;
}