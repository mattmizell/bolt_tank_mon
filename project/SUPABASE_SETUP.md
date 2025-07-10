# Supabase Setup Guide for Tank Monitoring Cache

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in with your account (matt.mizell@gmail.com)
3. Click "New Project"
4. Choose your organization
5. Fill in project details:
   - **Name**: `tank-monitoring-cache`
   - **Database Password**: Use a strong password (save this!)
   - **Region**: Choose closest to your location
6. Click "Create new project"
7. Wait for the project to be created (2-3 minutes)

## Step 2: Get Your Project Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://abcdefghijklmnop.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## Step 3: Update Environment Variables

Create a `.env` file in your project root with:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-actual-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here

# Central Tank Server Configuration (keep as backup)
VITE_REACT_APP_API_URL=https://central-tank-server.onrender.com
```

## Step 4: Run Database Migration

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the migration SQL from `supabase/migrations/20250628114212_light_swamp.sql`
4. Click "Run" to execute the migration

This will create:
- `tank_logs` table (5-day rolling cache)
- `tank_logs_hourly` table (1-year aggregated data)
- `processed_tank_data` table (pre-calculated metrics)
- Optimized indexes and views
- Sample data for testing

## Step 5: Verify Setup

1. After running the migration, go to **Table Editor** in Supabase
2. You should see these tables:
   - `tank_logs` (with sample data)
   - `tank_logs_hourly`
   - `processed_tank_data` (with calculated metrics)

3. Test the connection in your app:
   - Restart your development server (`npm run dev`)
   - The app should now show "Connected to Supabase" in the console
   - Load times should be under 3 seconds

## Step 6: Configure Background Data Population

The cache will be populated by:

1. **Manual data insertion** (for testing):
   ```sql
   INSERT INTO tank_logs (store_name, tank_id, product, tc_volume, height, temp, recorded_at)
   VALUES ('Mascoutah', 1, 'Regular Unleaded', 6500, 78.5, 68.2, NOW());
   ```

2. **Background processor** (recommended for production):
   - The `background-processor-example.js` can be modified to write to Supabase
   - Runs every 30 seconds to update cache tables
   - Automatically calculates run rates and predictions

## Performance Benefits

With Supabase configured as cache:

- **Load Time**: 30+ seconds → 2-3 seconds
- **Data Freshness**: Updates every 30 seconds via background processor
- **Scalability**: Handles millions of IoT records with 5-day retention
- **Reliability**: Automatic cleanup and data management

## Troubleshooting

### Connection Issues
- Verify your `.env` file has correct credentials
- Check that your Supabase project is active
- Ensure RLS policies allow public access (already configured in migration)

### No Data Showing
- Run the migration SQL to create sample data
- Check the `tank_dashboard_data` view in Supabase
- Verify the background processor is populating data

### Slow Performance
- Check if indexes were created properly
- Verify the 5-day data retention is working
- Monitor the `processed_tank_data` table for fresh calculations

## Next Steps

1. **Set up the migration** (Step 4 above)
2. **Update your .env file** with real credentials
3. **Test the connection** - you should see fast loading
4. **Configure background processor** to populate real data from your Central Tank Server

The cache system will dramatically improve your app's performance while maintaining real-time data freshness!