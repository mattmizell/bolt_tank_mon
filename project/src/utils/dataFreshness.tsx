import React from 'react';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';

export interface DataFreshness {
  status: 'fresh' | 'stale' | 'critical';
  minutesAgo: number;
  message: string;
}

export function getDataFreshness(timestamp: string | Date): DataFreshness {
  try {
    const now = new Date();
    const dataTime = new Date(timestamp);
    const diffMs = now.getTime() - dataTime.getTime();
    const minutesAgo = Math.floor(diffMs / (1000 * 60));

    if (minutesAgo < 5) {
      return {
        status: 'fresh',
        minutesAgo,
        message: 'Live data'
      };
    } else if (minutesAgo < 30) {
      return {
        status: 'stale',
        minutesAgo,
        message: `${minutesAgo} minutes ago`
      };
    } else {
      return {
        status: 'critical',
        minutesAgo,
        message: `${minutesAgo} minutes ago`
      };
    }
  } catch (error) {
    return {
      status: 'critical',
      minutesAgo: 0,
      message: 'Unknown'
    };
  }
}

interface DataFreshnessIndicatorProps {
  timestamp: string | Date;
  className?: string;
}

export const DataFreshnessIndicator: React.FC<DataFreshnessIndicatorProps> = ({ 
  timestamp, 
  className = '' 
}) => {
  const freshness = getDataFreshness(timestamp);

  const getIcon = () => {
    switch (freshness.status) {
      case 'fresh':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'stale':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
    }
  };

  const getTextColor = () => {
    switch (freshness.status) {
      case 'fresh':
        return 'text-green-400';
      case 'stale':
        return 'text-yellow-400';
      case 'critical':
        return 'text-red-400';
    }
  };

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {getIcon()}
      <span className={`text-sm ${getTextColor()}`}>
        {freshness.message}
      </span>
    </div>
  );
};