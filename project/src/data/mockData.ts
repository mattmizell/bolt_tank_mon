import { Store, TankLog } from '../types';

// Generate realistic mock data based on the original system
const generateTankLogs = (baseVolume: number, hours: number = 48): TankLog[] => {
  const logs: TankLog[] = [];
  const now = new Date();
  
  for (let i = hours; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
    const variance = (Math.random() - 0.5) * 200; // Random variance
    const volume = Math.max(baseVolume + variance - (hours - i) * 15, 500); // Gradual decrease
    const tc_volume = volume * (1 + Math.random() * 0.02); // Temperature compensation
    const ullage = 8000 - tc_volume;
    const height = (tc_volume / 8000) * 96; // Scale to inches
    
    logs.push({
      id: i,
      store_name: '',
      tank_id: 0,
      product: '',
      volume,
      tc_volume,
      ullage,
      height,
      water: Math.random() * 0.5,
      temp: 65 + Math.random() * 10,
      timestamp: timestamp.toISOString(),
    });
  }
  
  return logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

const calculateRunRate = (logs: TankLog[]): number => {
  if (logs.length < 2) return 0;
  
  const recentLogs = logs.slice(-24); // Last 24 hours
  const firstLog = recentLogs[0];
  const lastLog = recentLogs[recentLogs.length - 1];
  
  const timeDiff = (new Date(lastLog.timestamp).getTime() - new Date(firstLog.timestamp).getTime()) / (1000 * 60 * 60);
  const volumeDiff = firstLog.tc_volume - lastLog.tc_volume;
  
  return timeDiff > 0 ? Math.max(volumeDiff / timeDiff, 0) : 0;
};

const calculateHoursTo10Inches = (currentHeight: number, runRate: number): number => {
  if (runRate <= 0) return 0;
  const currentVolume = (currentHeight / 96) * 8000;
  const volumeAt10Inches = (10 / 96) * 8000;
  const gallonsUntil10 = currentVolume - volumeAt10Inches;
  return Math.max(gallonsUntil10 / runRate, 0);
};

const getTankStatus = (height: number, hoursTo10: number): 'normal' | 'warning' | 'critical' => {
  if (height < 15 || hoursTo10 < 24) return 'critical';
  if (height < 25 || hoursTo10 < 48) return 'warning';
  return 'normal';
};

// Mock stores use Lighthouse standard names
export const mockStores: Store[] = [
  {
    store_name: 'Speedi Check',
    tanks: [
      {
        tank_id: 1,
        tank_name: 'UNLEADED',
        product: '87 Reformulated',
        logs: generateTankLogs(6500),
      },
      {
        tank_id: 2,
        tank_name: 'PREMIUM',
        product: '93 Reformulated',
        logs: generateTankLogs(4200),
      },
      {
        tank_id: 3,
        tank_name: 'BIODIESEL',
        product: 'B11',
        logs: generateTankLogs(7200),
      },
    ],
    last_updated: new Date().toISOString(),
  },
  {
    store_name: 'PH Petroleum',
    tanks: [
      {
        tank_id: 1,
        tank_name: 'UNLEADED',
        product: 'Conv 87E10',
        logs: generateTankLogs(5800),
      },
      {
        tank_id: 2,
        tank_name: 'PREMIUM',
        product: 'Conv 91E10',
        logs: generateTankLogs(3900),
      },
      {
        tank_id: 3,
        tank_name: 'DIESEL',
        product: '#2 ULS',
        logs: generateTankLogs(6100),
      },
    ],
    last_updated: new Date().toISOString(),
  },
];

// Process the mock data to include calculated fields
mockStores.forEach(store => {
  store.tanks.forEach(tank => {
    if (tank.logs && tank.logs.length > 0) {
      const latestLog = tank.logs[tank.logs.length - 1];
      tank.latest_log = {
        ...latestLog,
        store_name: store.store_name,
        tank_id: tank.tank_id,
        product: tank.product,
      };
      
      tank.run_rate = calculateRunRate(tank.logs);
      tank.hours_to_10_inches = calculateHoursTo10Inches(latestLog.height, tank.run_rate);
      tank.status = getTankStatus(latestLog.height, tank.hours_to_10_inches);
      
      if (tank.hours_to_10_inches > 0) {
        const predictedTime = new Date(Date.now() + tank.hours_to_10_inches * 60 * 60 * 1000);
        tank.predicted_time = predictedTime.toISOString();
      }
    }
  });
});