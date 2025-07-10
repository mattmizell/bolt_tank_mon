# Tank Monitoring Database Scaling Plan

## Current Problem
- 30+ second load times due to complex calculations
- Will scale to 1M+ IoT records over time
- Need sub-3 second response times
- Real-time updates required

## Recommended Solution: Multi-Tier Architecture

### Tier 1: Time-Series Database (Data Storage)
**InfluxDB** - Purpose-built for IoT time-series data
```
Benefits:
- Handles billions of data points
- Automatic data compression (10:1 ratio)
- Built-in retention policies
- Optimized for time-based queries
- Continuous queries for real-time aggregation
```

### Tier 2: Cache Layer (Fast Access)
**Redis** - In-memory cache for instant responses
```
Benefits:
- Sub-100ms response times
- Stores pre-calculated results
- Automatic expiration
- Pub/sub for real-time updates
```

### Tier 3: Background Processor (Calculations)
**Node.js Service** - Handles all complex calculations
```
Benefits:
- Runs every 30 seconds
- Pre-calculates run rates, predictions
- Updates cache automatically
- Handles alerting logic
```

## Data Flow Architecture
```
IoT Devices → Central Tank Server → InfluxDB → Background Processor → Redis Cache → Frontend App
                                                      ↓
                                              Alert System (SMS/Email)
```

## Data Retention Strategy

### 5-Day Rolling Window for Raw Data
```sql
-- InfluxDB retention policy
CREATE RETENTION POLICY "5_days" ON "tank_monitoring" 
DURATION 5d REPLICATION 1 DEFAULT

-- Continuous query for hourly aggregates
CREATE CONTINUOUS QUERY "hourly_averages" ON "tank_monitoring"
BEGIN
  SELECT mean("tc_volume") AS "avg_volume",
         mean("height") AS "avg_height",
         min("tc_volume") AS "min_volume",
         max("tc_volume") AS "max_volume"
  INTO "tank_monitoring"."1_year"."tank_hourly"
  FROM "tank_monitoring"."5_days"."tank_logs"
  GROUP BY time(1h), "store_name", "tank_id"
END
```

### Storage Optimization
- **Raw Data:** 5 days at full resolution
- **Hourly Aggregates:** 1 year for trends
- **Daily Summaries:** 5 years for historical analysis
- **Automatic Cleanup:** No manual intervention needed

## Performance Targets

| Metric | Current | Target | Solution |
|--------|---------|--------|----------|
| Initial Load | 30+ sec | <3 sec | Redis cache |
| Background Updates | N/A | 30 sec | Background processor |
| Data Growth | Unlimited | Managed | 5-day retention |
| API Response | Variable | <200ms | Pre-calculated data |
| Concurrent Users | 1-2 | 100+ | Cache layer |
| Storage Efficiency | 100% | 10% | Compression + retention |

## Implementation Phases

### Phase 1: Quick Fix (2-3 days)
**Goal:** Reduce load time to under 5 seconds

1. **Enhanced Central Tank Server**
   ```javascript
   // Add background processor
   setInterval(async () => {
     const stores = await processAllStores();
     await cacheResults(stores);
   }, 30000);
   
   // New endpoint for pre-calculated data
   app.get('/stores/processed', (req, res) => {
     res.json(getCachedResults());
   });
   ```

2. **Frontend Optimization**
   - Use `/stores/processed` endpoint
   - Remove complex calculations
   - Add loading states with progress

### Phase 2: Scale Preparation (1 week)
**Goal:** Handle 10x current data volume

1. **Database Optimization**
   ```sql
   -- Add indexes for performance
   CREATE INDEX idx_tank_logs_time ON tank_logs(timestamp);
   CREATE INDEX idx_tank_logs_store_tank ON tank_logs(store_name, tank_id);
   
   -- Implement data retention
   DELETE FROM tank_logs WHERE timestamp < NOW() - INTERVAL '5 days';
   ```

2. **Redis Cache Layer**
   ```javascript
   const redis = require('redis');
   const client = redis.createClient();
   
   // Cache structure
   const cacheKey = `store:${storeName}`;
   const cacheData = {
     last_updated: new Date().toISOString(),
     tanks: processedTanks,
     expires_at: Date.now() + (30 * 60 * 1000) // 30 minutes
   };
   
   await client.setex(cacheKey, 1800, JSON.stringify(cacheData));
   ```

### Phase 3: IoT Ready (2 weeks)
**Goal:** Handle millions of records efficiently

1. **InfluxDB Migration**
   ```javascript
   const { InfluxDB, Point } = require('@influxdata/influxdb-client');
   
   // Write IoT data
   const point = new Point('tank_reading')
     .tag('store_name', storeName)
     .tag('tank_id', tankId)
     .floatField('tc_volume', volume)
     .floatField('height', height)
     .timestamp(new Date());
   
   writeApi.writePoint(point);
   ```

2. **Continuous Aggregation**
   ```sql
   -- Real-time run rate calculation
   SELECT derivative(mean("tc_volume"), 1h) as "run_rate"
   FROM "tank_logs"
   WHERE time >= now() - 24h
   GROUP BY time(1h), "store_name", "tank_id"
   ```

## Cost Analysis

### Cloud Infrastructure Costs
```
InfluxDB Cloud (10GB): $45/month
Redis Cloud (1GB): $15/month
Background Processor (VPS): $20/month
Total: $80/month for production-ready system
```

### Storage Projections
```
Current: 2 stores × 8 tanks × 4 readings/hour = 64 readings/hour
5 days: 64 × 24 × 5 = 7,680 records (~8MB)

Future: 100 stores × 10 tanks × 4 readings/hour = 4,000 readings/hour
5 days: 4,000 × 24 × 5 = 480,000 records (~500MB)

With compression: ~50MB actual storage needed
```

## Alternative Solutions

### Option A: PostgreSQL + TimescaleDB
```
Pros: SQL-based, easier migration
Cons: More complex setup, less IoT-optimized
Cost: $50/month managed service
```

### Option B: Extend Current System
```
Pros: Minimal changes, quick implementation
Cons: Won't scale to millions of records
Cost: $0 (use existing infrastructure)
```

### Option C: Serverless (AWS Lambda + DynamoDB)
```
Pros: Auto-scaling, pay-per-use
Cons: Cold start latency, vendor lock-in
Cost: $30-100/month depending on usage
```

## Recommended Implementation

### Week 1: Immediate Performance Fix
1. Add background processor to Central Tank Server
2. Create `/stores/processed` endpoint
3. Update frontend to use cached data
4. **Result:** Load time reduced to 3-5 seconds

### Week 2: Data Management
1. Implement 5-day data retention
2. Add Redis cache layer
3. Optimize database queries
4. **Result:** Sub-2 second load times

### Week 3-4: IoT Preparation
1. Set up InfluxDB instance
2. Migrate historical data
3. Implement continuous queries
4. **Result:** Ready for millions of records

## Monitoring & Alerts

### Key Metrics to Track
- API response times
- Cache hit rates
- Database storage growth
- Background processor performance
- Data retention effectiveness

### Alert Thresholds
- Response time > 5 seconds
- Cache hit rate < 80%
- Storage growth > 1GB/day
- Background processor failures

This architecture will handle your current needs while scaling seamlessly to millions of IoT records over the coming years.