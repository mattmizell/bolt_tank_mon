/*
  # Tank Monitoring Database Schema - Fixed Migration

  1. New Tables
    - `tank_logs` - Raw tank readings with 5-day retention
    - `tank_logs_hourly` - Hourly aggregated data with 1-year retention  
    - `processed_tank_data` - Pre-calculated metrics cache

  2. Security
    - Enable RLS on all tables
    - Add policies for public read access (with proper conflict handling)
    - Add policies for data insertion and updates

  3. Performance
    - Optimized indexes for fast queries
    - Views for easy data access
    - Functions for data management and cleanup
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main tank logs table with optimizations for millions of records
CREATE TABLE IF NOT EXISTS tank_logs (
    id BIGSERIAL PRIMARY KEY,
    store_name VARCHAR(100) NOT NULL,
    tank_id INTEGER NOT NULL,
    product VARCHAR(50),
    volume DECIMAL(10,2),
    tc_volume DECIMAL(10,2),
    ullage DECIMAL(10,2),
    height DECIMAL(6,2),
    water DECIMAL(6,2),
    temp DECIMAL(6,2),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Add constraints for data quality
    CONSTRAINT valid_volume CHECK (volume >= 0 AND volume <= 50000),
    CONSTRAINT valid_height CHECK (height >= 0 AND height <= 200),
    CONSTRAINT valid_temp CHECK (temp >= -50 AND temp <= 150)
);

-- Enable RLS
ALTER TABLE tank_logs ENABLE ROW LEVEL SECURITY;

-- Optimized indexes for performance
CREATE INDEX IF NOT EXISTS idx_tank_logs_recorded_at ON tank_logs(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tank_logs_store_tank ON tank_logs(store_name, tank_id);
CREATE INDEX IF NOT EXISTS idx_tank_logs_store_tank_time ON tank_logs(store_name, tank_id, recorded_at DESC);

-- Composite index for recent data queries
CREATE INDEX IF NOT EXISTS idx_tank_logs_recent_composite ON tank_logs(store_name, tank_id, recorded_at DESC);

-- Hourly aggregates table for historical data
CREATE TABLE IF NOT EXISTS tank_logs_hourly (
    id BIGSERIAL PRIMARY KEY,
    store_name VARCHAR(100) NOT NULL,
    tank_id INTEGER NOT NULL,
    hour_bucket TIMESTAMPTZ NOT NULL,
    avg_volume DECIMAL(10,2),
    avg_height DECIMAL(6,2),
    min_volume DECIMAL(10,2),
    max_volume DECIMAL(10,2),
    reading_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(store_name, tank_id, hour_bucket)
);

-- Enable RLS
ALTER TABLE tank_logs_hourly ENABLE ROW LEVEL SECURITY;

-- Index for hourly aggregates
CREATE INDEX IF NOT EXISTS idx_tank_logs_hourly_time ON tank_logs_hourly(hour_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_tank_logs_hourly_store ON tank_logs_hourly(store_name, tank_id, hour_bucket DESC);

-- Processed cache table (alternative to Redis for Supabase)
CREATE TABLE IF NOT EXISTS processed_tank_data (
    id BIGSERIAL PRIMARY KEY,
    store_name VARCHAR(100) NOT NULL,
    tank_id INTEGER NOT NULL,
    run_rate DECIMAL(8,3),
    hours_to_10_inches DECIMAL(8,2),
    status VARCHAR(20),
    capacity_percentage DECIMAL(5,2),
    predicted_time TIMESTAMPTZ,
    last_calculated TIMESTAMPTZ DEFAULT NOW(),
    data_quality_score DECIMAL(3,2),
    
    -- Unique constraint for upserts
    UNIQUE(store_name, tank_id)
);

-- Enable RLS
ALTER TABLE processed_tank_data ENABLE ROW LEVEL SECURITY;

-- Index for processed data
CREATE INDEX IF NOT EXISTS idx_processed_tank_data_store ON processed_tank_data(store_name);
CREATE INDEX IF NOT EXISTS idx_processed_tank_data_calculated ON processed_tank_data(last_calculated DESC);

-- Function to automatically clean old data
CREATE OR REPLACE FUNCTION cleanup_old_tank_data()
RETURNS void AS $$
DECLARE
    deleted_logs INTEGER;
    deleted_hourly INTEGER;
    deleted_processed INTEGER;
    cutoff_date TIMESTAMPTZ;
    hourly_cutoff_date TIMESTAMPTZ;
    processed_cutoff_date TIMESTAMPTZ;
BEGIN
    -- Calculate cutoff dates
    cutoff_date := NOW() - INTERVAL '5 days';
    hourly_cutoff_date := NOW() - INTERVAL '1 year';
    processed_cutoff_date := NOW() - INTERVAL '1 hour';
    
    -- Delete raw data older than 5 days
    DELETE FROM tank_logs 
    WHERE recorded_at < cutoff_date;
    GET DIAGNOSTICS deleted_logs = ROW_COUNT;
    
    -- Delete hourly aggregates older than 1 year
    DELETE FROM tank_logs_hourly 
    WHERE hour_bucket < hourly_cutoff_date;
    GET DIAGNOSTICS deleted_hourly = ROW_COUNT;
    
    -- Delete stale processed data (older than 1 hour)
    DELETE FROM processed_tank_data 
    WHERE last_calculated < processed_cutoff_date;
    GET DIAGNOSTICS deleted_processed = ROW_COUNT;
    
    -- Log cleanup results
    RAISE NOTICE 'Cleanup completed at %. Deleted: % logs, % hourly, % processed', 
        NOW(), deleted_logs, deleted_hourly, deleted_processed;
END;
$$ LANGUAGE plpgsql;

-- Create a function to upsert processed data
CREATE OR REPLACE FUNCTION upsert_processed_tank_data(
    p_store_name VARCHAR(100),
    p_tank_id INTEGER,
    p_run_rate DECIMAL(8,3),
    p_hours_to_10_inches DECIMAL(8,2),
    p_status VARCHAR(20),
    p_capacity_percentage DECIMAL(5,2),
    p_predicted_time TIMESTAMPTZ DEFAULT NULL,
    p_data_quality_score DECIMAL(3,2) DEFAULT 1.0
)
RETURNS void AS $$
BEGIN
    INSERT INTO processed_tank_data (
        store_name, tank_id, run_rate, hours_to_10_inches, 
        status, capacity_percentage, predicted_time, data_quality_score
    )
    VALUES (
        p_store_name, p_tank_id, p_run_rate, p_hours_to_10_inches,
        p_status, p_capacity_percentage, p_predicted_time, p_data_quality_score
    )
    ON CONFLICT (store_name, tank_id)
    DO UPDATE SET
        run_rate = EXCLUDED.run_rate,
        hours_to_10_inches = EXCLUDED.hours_to_10_inches,
        status = EXCLUDED.status,
        capacity_percentage = EXCLUDED.capacity_percentage,
        predicted_time = EXCLUDED.predicted_time,
        data_quality_score = EXCLUDED.data_quality_score,
        last_calculated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy access to latest tank data
CREATE OR REPLACE VIEW latest_tank_data AS
SELECT DISTINCT ON (store_name, tank_id)
    store_name,
    tank_id,
    product,
    tc_volume,
    height,
    temp,
    water,
    recorded_at
FROM tank_logs
ORDER BY store_name, tank_id, recorded_at DESC;

-- Create a view for processed data with latest readings
CREATE OR REPLACE VIEW tank_dashboard_data AS
SELECT 
    p.store_name,
    p.tank_id,
    COALESCE(l.product, 'Unknown') as product,
    l.tc_volume,
    l.height,
    l.temp,
    l.water,
    l.recorded_at as last_reading,
    p.run_rate,
    p.hours_to_10_inches,
    p.status,
    p.capacity_percentage,
    p.predicted_time,
    p.last_calculated,
    p.data_quality_score
FROM processed_tank_data p
LEFT JOIN latest_tank_data l ON p.store_name = l.store_name AND p.tank_id = l.tank_id
ORDER BY p.store_name, p.tank_id;

-- Function to get recent tank data efficiently
CREATE OR REPLACE FUNCTION get_recent_tank_data(
    p_store_name VARCHAR(100) DEFAULT NULL,
    p_tank_id INTEGER DEFAULT NULL,
    p_hours INTEGER DEFAULT 168 -- 7 days
)
RETURNS TABLE (
    store_name VARCHAR(100),
    tank_id INTEGER,
    product VARCHAR(50),
    tc_volume DECIMAL(10,2),
    height DECIMAL(6,2),
    temp DECIMAL(6,2),
    water DECIMAL(6,2),
    recorded_at TIMESTAMPTZ
) AS $$
DECLARE
    cutoff_time TIMESTAMPTZ;
BEGIN
    cutoff_time := NOW() - (p_hours || ' hours')::INTERVAL;
    
    RETURN QUERY
    SELECT 
        tl.store_name,
        tl.tank_id,
        tl.product,
        tl.tc_volume,
        tl.height,
        tl.temp,
        tl.water,
        tl.recorded_at
    FROM tank_logs tl
    WHERE tl.recorded_at >= cutoff_time
        AND (p_store_name IS NULL OR tl.store_name = p_store_name)
        AND (p_tank_id IS NULL OR tl.tank_id = p_tank_id)
    ORDER BY tl.store_name, tl.tank_id, tl.recorded_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get database statistics
CREATE OR REPLACE FUNCTION get_tank_monitoring_stats()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    size_pretty TEXT,
    oldest_record TIMESTAMPTZ,
    newest_record TIMESTAMPTZ
) AS $$
BEGIN
    -- Tank logs statistics
    RETURN QUERY
    SELECT 
        'tank_logs'::TEXT,
        (SELECT COUNT(*) FROM tank_logs),
        (SELECT pg_size_pretty(pg_total_relation_size('tank_logs'))),
        (SELECT MIN(recorded_at) FROM tank_logs),
        (SELECT MAX(recorded_at) FROM tank_logs);
    
    -- Hourly aggregates statistics
    RETURN QUERY
    SELECT 
        'tank_logs_hourly'::TEXT,
        (SELECT COUNT(*) FROM tank_logs_hourly),
        (SELECT pg_size_pretty(pg_total_relation_size('tank_logs_hourly'))),
        (SELECT MIN(hour_bucket) FROM tank_logs_hourly),
        (SELECT MAX(hour_bucket) FROM tank_logs_hourly);
    
    -- Processed data statistics
    RETURN QUERY
    SELECT 
        'processed_tank_data'::TEXT,
        (SELECT COUNT(*) FROM processed_tank_data),
        (SELECT pg_size_pretty(pg_total_relation_size('processed_tank_data'))),
        (SELECT MIN(last_calculated) FROM processed_tank_data),
        (SELECT MAX(last_calculated) FROM processed_tank_data);
END;
$$ LANGUAGE plpgsql;

-- Drop existing policies if they exist (to avoid conflicts)
DO $$ 
BEGIN
    -- Drop policies if they exist
    DROP POLICY IF EXISTS "Allow public read access to tank_logs" ON tank_logs;
    DROP POLICY IF EXISTS "Allow public read access to tank_logs_hourly" ON tank_logs_hourly;
    DROP POLICY IF EXISTS "Allow public read access to processed_tank_data" ON processed_tank_data;
    DROP POLICY IF EXISTS "Allow public insert to tank_logs" ON tank_logs;
    DROP POLICY IF EXISTS "Allow public insert to tank_logs_hourly" ON tank_logs_hourly;
    DROP POLICY IF EXISTS "Allow public insert to processed_tank_data" ON processed_tank_data;
    DROP POLICY IF EXISTS "Allow public update to processed_tank_data" ON processed_tank_data;
EXCEPTION
    WHEN undefined_object THEN
        NULL; -- Ignore if policies don't exist
END $$;

-- Create RLS policies for public access
CREATE POLICY "Allow public read access to tank_logs" ON tank_logs FOR SELECT USING (true);
CREATE POLICY "Allow public read access to tank_logs_hourly" ON tank_logs_hourly FOR SELECT USING (true);
CREATE POLICY "Allow public read access to processed_tank_data" ON processed_tank_data FOR SELECT USING (true);

-- Create policies for insert/update
CREATE POLICY "Allow public insert to tank_logs" ON tank_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert to tank_logs_hourly" ON tank_logs_hourly FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert to processed_tank_data" ON processed_tank_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to processed_tank_data" ON processed_tank_data FOR UPDATE USING (true);

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Tank monitoring database initialized successfully at %', NOW();
    RAISE NOTICE 'Database is ready for real data sync from Central Tank Server';
    RAISE NOTICE 'Tables created: tank_logs, tank_logs_hourly, processed_tank_data';
    RAISE NOTICE 'Next step: Deploy the background sync service to populate with real data';
END $$;