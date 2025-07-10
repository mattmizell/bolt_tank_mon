import React, { useState, useEffect } from 'react';

interface DebugLoggerProps {
  className?: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export const DebugLogger: React.FC<DebugLoggerProps> = ({ className = '' }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    // Override console methods to capture logs
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (level: 'info' | 'warn' | 'error', ...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      const logEntry: LogEntry = {
        timestamp: new Date().toLocaleTimeString(),
        level,
        message
      };

      setLogs(prevLogs => {
        const newLogs = [...prevLogs, logEntry];
        // Keep only last 100 entries
        return newLogs.slice(-100);
      });
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('info', ...args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('warn', ...args);
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('error', ...args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-900/20';
      case 'warn': return 'bg-yellow-900/20';
      default: return 'bg-green-900/20';
    }
  };

  if (isMinimized) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-700"
        >
          Show Debug Logs ({logs.length})
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 w-96 max-h-96 bg-slate-900 border border-slate-600 rounded-lg z-50 ${className}`}>
      <div className="flex items-center justify-between p-3 border-b border-slate-600">
        <h3 className="text-white font-semibold">🔍 Debug Logs</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setLogs([])}
            className="text-slate-400 hover:text-white text-sm"
          >
            Clear
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-slate-400 hover:text-white text-sm"
          >
            Minimize
          </button>
        </div>
      </div>
      
      <div className="max-h-80 overflow-y-auto p-3 space-y-1">
        {logs.length === 0 ? (
          <div className="text-slate-400 text-sm">No logs yet...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`text-xs p-2 rounded ${getLevelBg(log.level)}`}>
              <div className="flex items-start space-x-2">
                <span className="text-slate-500 text-xs">{log.timestamp}</span>
                <span className={`font-mono text-xs ${getLevelColor(log.level)}`}>
                  {log.level.toUpperCase()}
                </span>
              </div>
              <div className="mt-1 text-slate-200 font-mono text-xs whitespace-pre-wrap break-all">
                {log.message}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};