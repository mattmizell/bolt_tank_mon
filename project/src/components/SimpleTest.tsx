import React, { useState, useEffect } from 'react';

export const SimpleTest: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Making direct API call...');
        const response = await fetch('https://central-tank-server.onrender.com/dashboard/stores/Speedi%20Check');
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Raw API response:', result);
        setData(result);
      } catch (err) {
        console.error('API call failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="text-white">Loading...</div>;
  if (error) return <div className="text-red-400">Error: {error}</div>;

  const tank = data?.tanks?.[0];

  return (
    <div className="bg-slate-800 p-6 rounded text-white">
      <h2 className="text-xl mb-4">Raw API Test - Speedi Check Store</h2>
      
      {tank && (
        <div className="space-y-2">
          <div><strong>Tank Name:</strong> {tank.tank_name}</div>
          <div><strong>Run Rate:</strong> {tank.analytics?.run_rate} gal/hr</div>
          <div><strong>Max Capacity:</strong> {tank.configuration?.max_capacity_gallons} gal</div>
          <div><strong>Current Volume:</strong> {tank.latest_reading?.volume} gal</div>
          <div><strong>Status:</strong> {tank.current_status}</div>
          <div><strong>Height:</strong> {tank.latest_reading?.height} in</div>
        </div>
      )}
      
      <details className="mt-4">
        <summary className="cursor-pointer">Raw JSON Data</summary>
        <pre className="text-xs mt-2 bg-slate-900 p-2 rounded overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
};