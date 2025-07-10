# 🚀 Real Data Sync Guide

## Step 1: Run Clean Migration (No Fake Data)

1. **Open Supabase Dashboard**: https://supabase.com/dashboard/project/xxcpqjtnsjoxmlqokuj
2. **Go to SQL Editor** → **New Query**
3. **Copy and paste** the clean migration SQL from `supabase/migrations/clean_tank_monitoring.sql`
4. **Click Run** - this creates empty tables ready for real data

## Step 2: Sync Real Data from Central Tank Server

### Option A: One-Time Historical Sync
```bash
# Sync last 5 days of historical data
npm run sync-historical

# Or sync specific number of days
npm run sync-historical 7
```

### Option B: Start Continuous Real-Time Sync
```bash
# Start continuous sync (updates every 30 seconds)
npm run sync-data
```

## Step 3: Verify Real Data

1. **Check Supabase Tables**:
   - Go to **Table Editor** in Supabase
   - Check `tank_logs` table - should have real data from your Central Tank Server
   - Check `processed_tank_data` table - should have calculated run rates

2. **Test Your App**:
   - Restart dev server: `npm run dev`
   - Should load in 2-3 seconds with your real store data
   - No more fake "Mascoutah" or "North City" - just your actual stores

## What the Sync Does

### Real Data Flow:
```
Central Tank Server → Fetch Live Data → Supabase Cache → Your App (Fast!)
```

### Data Synced:
- **Latest tank readings** (volume, height, temperature, etc.)
- **Calculated metrics** (run rates, hours to 10", status)
- **Historical data** (last 5 days for charts)
- **Automatic cleanup** (keeps only recent data)

### Performance Benefits:
- **Load time**: 30+ seconds → 2-3 seconds
- **Real-time updates**: Every 30 seconds
- **No fake data**: Only your actual tank readings
- **Automatic calculations**: Run rates pre-computed

## Sync Script Features

### Continuous Sync (`npm run sync-data`):
- Fetches from `https://central-tank-server.onrender.com/stores/full`
- Updates Supabase cache every 30 seconds
- Handles errors gracefully
- Logs sync progress

### Historical Sync (`npm run sync-historical`):
- Populates 5 days of historical data for charts
- Batch inserts for performance
- One-time operation to seed the cache

### Data Validation:
- Validates all connections before starting
- Handles missing data gracefully
- Prevents duplicate entries
- Maintains data quality

## Monitoring the Sync

### Console Output:
```
🚀 Starting Real Data Sync from Central Tank Server...
✅ Central Tank Server connection successful
✅ Supabase connection successful
🔄 Syncing real data from Central Tank Server...
📊 Retrieved 2 stores from Central Tank Server
✅ Sync completed in 1250ms
📈 Synced: 8 tank logs, 8 processed records
```

### Check Sync Status:
- Monitor console for sync messages
- Check Supabase table row counts
- Use "Database Status" in your app

## Production Deployment

For production, run the sync script on a server:

```bash
# Install dependencies
npm install

# Start continuous sync (runs forever)
npm run sync-data
```

Or use a process manager like PM2:
```bash
pm2 start "npm run sync-data" --name "tank-sync"
```

## Troubleshooting

### No Data After Sync:
- Check Central Tank Server is accessible
- Verify Supabase credentials in sync script
- Check console for error messages

### Sync Errors:
- Ensure Central Tank Server returns valid JSON
- Check network connectivity
- Verify Supabase service key permissions

### Performance Issues:
- Monitor sync frequency (30 seconds default)
- Check Supabase usage limits
- Verify data cleanup is working

## Result: Lightning Fast App with Real Data

After running the sync:
- ✅ **No fake data** - only your real tank readings
- ✅ **Sub-3 second load times** - data served from Supabase cache
- ✅ **Real-time updates** - fresh data every 30 seconds
- ✅ **Production ready** - automatic cleanup and error handling

Your tank monitoring system is now powered by real data with enterprise-level performance!