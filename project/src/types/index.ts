import { TankProfile } from '../services/tankProfile';

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

export interface Tank {
  tank_id: number;
  tank_name: string;
  product: string;
  latest_log?: TankLog;
  logs?: TankLog[];
  run_rate?: number;
  hours_to_10_inches?: number;
  predicted_time?: string;
  status?: 'normal' | 'warning' | 'critical';
  profile?: TankProfile;
  capacity_percentage?: number;
}

export interface Store {
  store_name: string;
  tanks: Tank[];
  last_updated?: string;
}

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

// Configuration interfaces with admin contact info
export interface StoreHours {
  store_name: string;
  open_hour: number;
  close_hour: number;
  timezone: string;
  // Admin contact information
  admin_name?: string;
  admin_phone?: string;
  admin_email?: string;
  alerts_enabled?: boolean;
}

export interface TankConfiguration {
  store_name: string;
  tank_id: number;
  tank_name: string;
  product_type: string;
  diameter_inches: number;
  length_inches: number;
  critical_height_inches: number;
  warning_height_inches: number;
  max_capacity_gallons?: number;
  // Alert Configuration (kept for configuration purposes)
  alerts_enabled?: boolean;
  alert_phone_number?: string; // Override for specific tank
}

// Legacy interfaces for backward compatibility
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

export interface StoreContact {
  store_name: string;
  contact_name: string;
  phone_number: string;
  is_primary: boolean;
  alerts_enabled: boolean;
}