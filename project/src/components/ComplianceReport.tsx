import React, { useState, useEffect } from 'react';
import { StoreCompliance, TankCSLDStatus, CSLDMonthResult, ComplianceAlarm } from '../types';
import { ApiService } from '../services/api';
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, ChevronDown, Download, Printer, Info } from 'lucide-react';
import { format } from 'date-fns';

interface ComplianceReportProps {
  storeName: string;
}

// --- Veeder-Root TLS code lookups (client-side fallback) ---

const ALARM_FALLBACK: Record<string, { name: string; severity: string; action: string }> = {
  "0001": { name: "Setup Data Warning", severity: "warning", action: "Verify tank configuration" },
  "0002": { name: "High Product Alarm", severity: "alarm", action: "Check for overfill condition" },
  "0003": { name: "High Water Alarm", severity: "alarm", action: "Schedule water removal" },
  "0004": { name: "Overfill Alarm", severity: "critical", action: "Stop delivery immediately" },
  "0005": { name: "Low Product Alarm", severity: "alarm", action: "Schedule delivery" },
  "0006": { name: "Sudden Loss Alarm", severity: "critical", action: "POSSIBLE LEAK — investigate immediately" },
  "0007": { name: "Fuel Out Alarm", severity: "critical", action: "Tank empty — emergency delivery" },
  "0008": { name: "Invalid Fuel Level", severity: "alarm", action: "Probe malfunction — schedule technician" },
  "0009": { name: "Probe Out Alarm", severity: "alarm", action: "Probe disconnected — schedule repair" },
  "000A": { name: "Temperature Alarm", severity: "alarm", action: "Investigate abnormal temperature" },
  "000B": { name: "Delivery Needed", severity: "warning", action: "Schedule delivery" },
  "000C": { name: "Maximum Product Alarm", severity: "alarm", action: "Tank at maximum capacity" },
  "000D": { name: "Gross Leak Test FAIL", severity: "critical", action: "LEAK DETECTED — shut down line, notify state" },
  "000E": { name: "Periodic Leak Test FAIL", severity: "critical", action: "LEAK DETECTED — investigate, report to state" },
  "000F": { name: "Annual Leak Test FAIL", severity: "critical", action: "LEAK DETECTED — state reporting required" },
  "001B": { name: "Delivery In Progress", severity: "info", action: "Normal operation" },
};

const CSLD_FALLBACK: Record<string, { name: string; status: string }> = {
  "00": { name: "No Data", status: "unknown" },
  "01": { name: "Pass", status: "pass" },
  "02": { name: "Fail", status: "fail" },
  "50": { name: "In Progress", status: "pending" },
  "FF": { name: "Error", status: "error" },
  "PASS": { name: "Pass", status: "pass" },
  "FAIL": { name: "Fail", status: "fail" },
  "PENDING": { name: "Pending", status: "pending" },
};

function decodeAlarm(alarm: ComplianceAlarm) {
  if (alarm.alarm_name) return { name: alarm.alarm_name, severity: alarm.severity || 'warning', action: alarm.recommended_action || '' };
  const fb = ALARM_FALLBACK[alarm.alarm_type?.toUpperCase()];
  if (fb) return fb;
  return { name: `Alarm ${alarm.alarm_type}`, severity: 'warning', action: 'Investigate alarm condition' };
}

function decodeTankResult(tank: TankCSLDStatus) {
  if (tank.result_name) return { name: tank.result_name, status: tank.result_status || 'unknown' };
  const fb = CSLD_FALLBACK[tank.current_result];
  if (fb) return fb;
  return { name: tank.current_result, status: 'unknown' };
}

function daysUntilDue(lastTestDate?: string): number | null {
  if (!lastTestDate) return null;
  try {
    const last = new Date(lastTestDate);
    const due = new Date(last.getTime() + 30 * 24 * 60 * 60 * 1000);
    return Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  } catch { return null; }
}

// --- CSV export ---

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// --- Severity icon ---

const SeverityIcon: React.FC<{ severity: string }> = ({ severity }) => {
  switch (severity) {
    case 'critical':
      return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-900/50 flex-shrink-0"><AlertTriangle className="w-3.5 h-3.5 text-red-400" /></span>;
    case 'alarm':
      return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-900/50 flex-shrink-0"><AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /></span>;
    case 'info':
      return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-900/50 flex-shrink-0"><Info className="w-3.5 h-3.5 text-blue-400" /></span>;
    default:
      return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-900/50 flex-shrink-0"><AlertTriangle className="w-3.5 h-3.5 text-orange-400" /></span>;
  }
};

// --- Month dot with popover ---

const MonthDot: React.FC<{ label: string; entry?: CSLDMonthResult }> = ({ label, entry }) => {
  const [open, setOpen] = useState(false);
  const hasData = !!entry;

  return (
    <div className="flex flex-col items-center flex-1 min-w-0 relative">
      <button
        type="button"
        className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 focus:ring-offset-slate-800 ${
          hasData ? 'bg-green-400 cursor-pointer' : 'bg-slate-600 cursor-default'
        }`}
        onClick={() => hasData && setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label={`${label}: ${hasData ? 'Test recorded' : 'No data'}`}
      />
      <span className="text-slate-500 text-[10px] mt-1 hidden sm:block">{label}</span>

      {open && entry && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 bg-slate-700 border border-slate-600 rounded-lg shadow-lg p-3 w-48 text-left">
          <div className="text-xs space-y-1">
            {entry.date && <p><span className="font-medium text-slate-300">Date:</span> <span className="text-slate-400">{format(new Date(entry.date), 'MMM d, yyyy h:mm a')}</span></p>}
            {entry.report_type && <p><span className="font-medium text-slate-300">Type:</span> <span className="text-slate-400">{entry.report_type}</span></p>}
            {entry.duration != null && <p><span className="font-medium text-slate-300">Duration:</span> <span className="text-slate-400">{entry.duration}h</span></p>}
            {entry.volume != null && <p><span className="font-medium text-slate-300">Volume:</span> <span className="text-slate-400">{entry.volume} gal</span></p>}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-700 border-b border-r border-slate-600 rotate-45 -mt-1"></div>
        </div>
      )}
    </div>
  );
};

// --- Tank compliance card (dark theme) ---

const TankCard: React.FC<{ tank: TankCSLDStatus }> = ({ tank }) => {
  const decoded = decodeTankResult(tank);
  const isPass = decoded.status === 'pass';
  const isFail = decoded.status === 'fail';
  const days = daysUntilDue(tank.last_test_date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const monthResultMap = new Map<string, CSLDMonthResult>();
  if (tank.month_chain) {
    for (const m of tank.month_chain) {
      if (m.month) monthResultMap.set(m.month, m);
    }
  }

  return (
    <div className={`rounded-lg p-4 border ${
      isPass ? 'bg-green-900/20 border-green-500/30' : isFail ? 'bg-red-900/20 border-red-500/30' : 'bg-slate-700/50 border-slate-600'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
        <div className="flex items-center space-x-3">
          <span className="text-white font-medium">Tank {tank.tank_id}</span>
          <span className="text-slate-400 text-sm">{tank.product}</span>
        </div>
        <span className={`px-3 py-0.5 rounded-full text-xs font-bold mt-1 sm:mt-0 w-fit ${
          isPass ? 'bg-green-900/50 text-green-400' : isFail ? 'bg-red-900/50 text-red-400' : 'bg-slate-600 text-slate-400'
        }`}>
          {decoded.name.toUpperCase()}
        </span>
      </div>

      <p className="text-sm text-slate-400 mb-3">
        {isPass && 'Tank system is tight — no leak detected'}
        {isFail && 'Tank system FAILED leak detection — investigate immediately'}
        {decoded.status === 'pending' && 'Leak detection test in progress'}
        {decoded.status === 'unknown' && 'No CSLD test data available'}
        {decoded.status === 'error' && 'CSLD test encountered an error'}
      </p>

      <div className="flex flex-wrap gap-4 text-xs text-slate-500 mb-3">
        {tank.last_test_date && (
          <span>Last test: <span className="text-slate-300 font-medium">{format(new Date(tank.last_test_date), 'MMM d, yyyy')}</span></span>
        )}
        <span>Chain: <span className="text-slate-300 font-medium">{tank.consecutive_passes} pass{tank.consecutive_passes !== 1 ? 'es' : ''}</span></span>
        {days !== null && (
          <span>
            Next due:{' '}
            <span className={`font-medium ${days <= 5 ? 'text-red-400' : days <= 10 ? 'text-yellow-400' : 'text-slate-300'}`}>
              {days <= 0 ? 'OVERDUE' : `${days}d`}
            </span>
          </span>
        )}
      </div>

      <div className="flex items-center space-x-1">
        {months.map((label) => (
          <MonthDot key={label} label={label} entry={monthResultMap.get(label)} />
        ))}
      </div>
    </div>
  );
};

// --- Alarm section ---

const AlarmSection: React.FC<{ alarms: ComplianceAlarm[]; alarmCount30d: number }> = ({ alarms, alarmCount30d }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? alarms : alarms.slice(0, 5);
  const hiddenCount = alarms.length - 5;

  if (alarms.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-green-300 text-sm">No alarms in the last 30 days</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
        <AlertTriangle className="w-5 h-5 text-yellow-400" />
        <span>Alarm History</span>
        <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 text-xs font-normal">{alarmCount30d} in last 30 days</span>
      </h3>
      <div className="space-y-2">
        {visible.map((alarm, idx) => {
          const decoded = decodeAlarm(alarm);
          return (
            <div key={idx} className="flex items-start space-x-3 bg-slate-700/50 rounded-lg px-4 py-3">
              <SeverityIcon severity={decoded.severity} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-medium">{decoded.name}</p>
                  <div className="flex items-center space-x-2 text-slate-400 text-xs ml-2 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{format(new Date(alarm.alarm_timestamp), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                </div>
                <p className="text-slate-500 text-xs">Tank {alarm.tank_id}</p>
                {decoded.action && <p className="text-slate-500 text-xs mt-0.5">{decoded.action}</p>}
              </div>
            </div>
          );
        })}
      </div>
      {!showAll && hiddenCount > 0 && (
        <button onClick={() => setShowAll(true)} className="mt-3 text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center">
          <ChevronDown className="w-4 h-4 mr-1" />
          Show {hiddenCount} more
        </button>
      )}
      {showAll && hiddenCount > 0 && (
        <button onClick={() => setShowAll(false)} className="mt-3 text-sm text-slate-400 hover:text-slate-300 font-medium">
          Show fewer
        </button>
      )}
    </div>
  );
};

// --- Export section ---

const ExportBar: React.FC<{ compliance: StoreCompliance }> = ({ compliance }) => {
  const handleExportAlarms = () => {
    downloadCSV(
      `${compliance.store_name}_alarm_history.csv`,
      ['Tank', 'Alarm Code', 'Alarm Name', 'Severity', 'Action', 'Timestamp'],
      (compliance.alarms || []).map(a => {
        const d = decodeAlarm(a);
        return [`Tank ${a.tank_id}`, a.alarm_type, d.name, d.severity, d.action, a.alarm_timestamp];
      })
    );
  };

  const handleExportTests = () => {
    downloadCSV(
      `${compliance.store_name}_test_history.csv`,
      ['Tank', 'Test Type', 'Result', 'Leak Rate (gal/hr)', 'Duration (hours)', 'Date'],
      (compliance.sld_tests || []).map(t => [
        `Tank ${t.tank_id}`, t.test_type, t.test_result,
        t.test_rate != null ? t.test_rate.toFixed(3) : '',
        t.duration_hours != null ? t.duration_hours.toFixed(1) : '',
        t.test_date || ''
      ])
    );
  };

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {(compliance.alarms?.length ?? 0) > 0 && (
        <button onClick={handleExportAlarms} className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 transition-colors">
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export Alarms (CSV)
        </button>
      )}
      {(compliance.sld_tests?.length ?? 0) > 0 && (
        <button onClick={handleExportTests} className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 transition-colors">
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export Tests (CSV)
        </button>
      )}
      <button onClick={() => window.print()} className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 transition-colors">
        <Printer className="w-3.5 h-3.5 mr-1.5" />
        Print Report
      </button>
      <span className="text-xs text-slate-600 self-center ml-2">Records retained per EPA 40 CFR 280</span>
    </div>
  );
};

// --- Main component ---

export const ComplianceReport: React.FC<ComplianceReportProps> = ({ storeName }) => {
  const [compliance, setCompliance] = useState<StoreCompliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompliance = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await ApiService.getStoreCompliance(storeName);
        setCompliance(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load compliance data');
      } finally {
        setLoading(false);
      }
    };
    fetchCompliance();
  }, [storeName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 text-center">
        <Shield className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Compliance Data</h3>
        <p className="text-slate-400">{error}</p>
      </div>
    );
  }

  if (!compliance) return null;

  const isCompliant = compliance.overall_status === 'COMPLIANT';
  const totalTanks = compliance.tanks?.length || 0;

  return (
    <div className="space-y-6">
      {/* Executive Summary Banner */}
      <div className={`rounded-xl p-5 border ${
        isCompliant ? 'bg-green-900/30 border-green-500/30' : 'bg-red-900/30 border-red-500/30'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            {isCompliant ? (
              <CheckCircle className="w-8 h-8 text-green-400" />
            ) : (
              <XCircle className="w-8 h-8 text-red-400" />
            )}
            <div>
              <p className={`font-bold text-lg ${isCompliant ? 'text-green-200' : 'text-red-200'}`}>
                {isCompliant ? 'ALL TANKS COMPLIANT' : 'NON-COMPLIANT — ACTION REQUIRED'}
              </p>
              <p className={`text-sm ${isCompliant ? 'text-green-300' : 'text-red-300'}`}>
                {totalTanks} tank{totalTanks !== 1 ? 's' : ''}
                {compliance.alarm_count_30d > 0 && ` · ${compliance.alarm_count_30d} alarm${compliance.alarm_count_30d !== 1 ? 's' : ''} (30d)`}
                {' · '}Last collected: {compliance.last_collected
                  ? format(new Date(compliance.last_collected), 'PPpp')
                  : 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tank Compliance Cards */}
      {compliance.tanks.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <span>Tank Compliance — CSLD Chain</span>
          </h3>
          <div className="space-y-4">
            {compliance.tanks.map((tank: TankCSLDStatus) => (
              <TankCard key={tank.tank_id} tank={tank} />
            ))}
          </div>
        </div>
      )}

      {/* SLD Test Results */}
      {compliance.sld_tests && compliance.sld_tests.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">SLD Test Results</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-400 py-2 px-3 font-medium">Tank</th>
                  <th className="text-left text-slate-400 py-2 px-3 font-medium">Test Type</th>
                  <th className="text-left text-slate-400 py-2 px-3 font-medium">Result</th>
                  <th className="text-right text-slate-400 py-2 px-3 font-medium">Leak Rate</th>
                  <th className="text-right text-slate-400 py-2 px-3 font-medium">Duration</th>
                  <th className="text-right text-slate-400 py-2 px-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {compliance.sld_tests.map((test, idx) => {
                  const isPassing = test.test_result === 'PASS' || test.test_result === 'Pass';
                  return (
                    <tr key={idx} className="border-b border-slate-700/50">
                      <td className="py-2 px-3 text-white">Tank {test.tank_id}</td>
                      <td className="py-2 px-3 text-slate-300">{test.test_type}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          isPassing ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                        }`}>
                          {test.test_result}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-300">
                        {test.test_rate != null ? `${test.test_rate.toFixed(3)} gal/hr` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-300">
                        {test.duration_hours != null ? `${test.duration_hours.toFixed(1)}h` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400">
                        {test.test_date ? format(new Date(test.test_date), 'MMM d, yyyy') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alarm History */}
      <AlarmSection alarms={compliance.alarms || []} alarmCount30d={compliance.alarm_count_30d ?? 0} />

      {/* Export */}
      <ExportBar compliance={compliance} />
    </div>
  );
};

export default ComplianceReport;
