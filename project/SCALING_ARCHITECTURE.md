# Scalable Tank Monitoring Cache Architecture

## Problem Statement
- Current app takes 30+ seconds to load due to complex calculations
- IoT expansion will generate 1M+ records over time
- Need sub-3 second load times
- Must handle real-time updates efficiently

## Recommended Architecture: Time-Series Database + Cache Layer

### Option 1: InfluxDB + Redis (Recommended)
```
IoT Devices → Central Tank Server → InfluxDB → Background Processor → Redis Cache → Frontend
```

**Benefits:**
- InfluxDB designed for time-series data (perfect for tank logs)
- Automatic data retention policies (keep last 5 days, downsample older data)
- Redis provides sub-100ms response times
- Scales to billions of data points
- Built-in data compression and aggregation

**Implementation:**
1. **InfluxDB Setup:**
   - Store raw tank readings with automatic retention
   - Keep 5 days of full-resolution data
   - Downsample to hourly averages for historical data
   - Automatic cleanup of old data

2. **Background Processor:**
   - Runs every 30 seconds
   - Calculates run rates, status, predictions
   - Stores results in Redis cache
   - Uses InfluxDB's built-in aggregation functions

3. **Redis Cache Structure:**
   ```json
   {
     "store:Mascoutah": {
       "last_updated": "2025-01-25T10:30:00Z",
       "tanks": [
         {
           "tank_id": 1,
           "run_rate": 12.5,
           "hours_to_10": 48.2,
           "status": "warning",
           "latest_reading": {...}
         }
       ]
     }
   }
   ```

### Option 2: PostgreSQL + TimescaleDB Extension
```
IoT Devices → Central Tank Server → TimescaleDB → Background Jobs → Materialized Views → Frontend
```

**Benefits:**
- PostgreSQL with time-series optimization
- Automatic data partitioning by time
- Continuous aggregates for real-time calculations
- SQL-based, easier to manage

### Option 3: Extend Central Tank Server (Simplest)
```
IoT Devices → Enhanced Central Tank Server (with background processor) → SQLite/PostgreSQL → Frontend
```

**Implementation:**
1. Add background job to Central Tank Server
2. Create `/stores/processed` endpoint
3. Pre-calculate all run rates every 30 seconds
4. Store in database table: `processed_tank_data`

## Data Retention Strategy

### 5-Day Rolling Window Approach
```sql
-- Keep only last 5 days of raw data
DELETE FROM tank_logs 
WHERE timestamp < NOW() - INTERVAL '5 days';

-- Keep aggregated hourly data for historical trends
CREATE TABLE tank_logs_hourly AS
SELECT 
  store_name,
  tank_id,
  DATE_TRUNC('hour', timestamp) as hour,
  AVG(tc_volume) as avg_volume,
  AVG(height) as avg_height,
  MIN(tc_volume) as min_volume,
  MAX(tc_volume) as max_volume
FROM tank_logs
GROUP BY store_name, tank_id, DATE_TRUNC('hour', timestamp);
```

### Automatic Cleanup Job
```javascript
// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  // Delete raw data older than 5 days
  await db.query(`
    DELETE FROM tank_logs 
    WHERE timestamp < NOW() - INTERVAL '5 days'
  `);
  
  // Keep hourly aggregates for 1 year
  await db.query(`
    DELETE FROM tank_logs_hourly 
    WHERE hour < NOW() - INTERVAL '1 year'
  `);
});
```

## Performance Targets

| Metric | Current | Target | Solution |
|--------|---------|--------|----------|
| Initial Load | 30+ seconds | 2-3 seconds | Pre-calculated cache |
| Background Updates | N/A | 30 seconds | Background processor |
| Data Storage | Unlimited growth | 5-day rolling | Automatic cleanup |
| Concurrent Users | 1-2 | 50+ | Redis cache layer |
| API Response Time | Variable | <200ms | Cached responses |

## Implementation Phases

### Phase 1: Quick Win (1-2 days)
- Extend Central Tank Server with background processor
- Add `/stores/processed` endpoint
- Pre-calculate run rates every 30 seconds
- Frontend fetches pre-calculated data

### Phase 2: Scale Preparation (1 week)
- Implement 5-day data retention
- Add hourly aggregation tables
- Optimize database queries
- Add Redis cache layer

### Phase 3: IoT Ready (2 weeks)
- Migrate to InfluxDB or TimescaleDB
- Implement automatic data lifecycle
- Add monitoring and alerting
- Load testing for 1M+ records

## Cost Considerations

### Cloud Hosting Options
1. **InfluxDB Cloud:** $45/month for 10GB storage
2. **Redis Cloud:** $15/month for 1GB cache
3. **TimescaleDB Cloud:** $50/month for managed service
4. **Self-hosted:** $20/month VPS can handle everything

### Storage Estimates
- Raw data: ~1KB per reading
- 5 tanks × 4 readings/hour × 24 hours × 5 days = 2,400 records
- Storage needed: ~2.4MB for 5 days of data
- With 100 stores: ~240MB total

## Recommended Next Steps

1. **Immediate (Today):** Extend Central Tank Server with background processor
2. **This Week:** Implement 5-day data retention policy
3. **Next Week:** Add Redis cache layer for sub-second responses
4. **Month 2:** Migrate to InfluxDB for IoT scalability

This architecture will handle millions of IoT records while maintaining 2-3 second load times and automatic data management.