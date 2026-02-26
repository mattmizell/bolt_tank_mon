import React, { useState, useEffect } from 'react';
import { StoreCompliance, TankCSLDStatus, CSLDMonthResult } from '../types';
import { ApiService } from '../services/api';
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ComplianceReportProps {
  storeName: string;
}

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
        <h3 className="text-lg font-semibold text-white mb-2">No Compliance Data</h3>
        <p className="text-slate-400">No compliance data collected yet for this store.</p>
      </div>
    );
  }

  if (!compliance) return null;

  const isCompliant = compliance.overall_status === 'COMPLIANT';

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`rounded-xl p-4 border ${
        isCompliant
          ? 'bg-green-900/30 border-green-500/30'
          : 'bg-red-900/30 border-red-500/30'
      }`}>
        <div className="flex items-center space-x-3">
          {isCompliant ? (
            <CheckCircle className="w-6 h-6 text-green-400" />
          ) : (
            <XCircle className="w-6 h-6 text-red-400" />
          )}
          <div>
            <p className={`font-semibold text-lg ${isCompliant ? 'text-green-200' : 'text-red-200'}`}>
              {isCompliant ? 'ALL TANKS COMPLIANT' : 'NON-COMPLIANT'}
            </p>
            <p className={`text-sm ${isCompliant ? 'text-green-300' : 'text-red-300'}`}>
              Last collected: {compliance.last_collected
                ? format(new Date(compliance.last_collected), 'PPpp')
                : 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      {/* CSLD Chain Grid */}
      {compliance.tanks.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <span>CSLD Monthly Chain</span>
          </h3>
          <div className="space-y-4">
            {compliance.tanks.map((tank: TankCSLDStatus) => (
              <CSLDChainRow key={tank.tank_id} tank={tank} />
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
                  <th className="text-left text-slate-400 py-2 px-3">Tank</th>
                  <th className="text-left text-slate-400 py-2 px-3">Test Type</th>
                  <th className="text-left text-slate-400 py-2 px-3">Result</th>
                  <th className="text-right text-slate-400 py-2 px-3">Rate</th>
                  <th className="text-right text-slate-400 py-2 px-3">Duration</th>
                  <th className="text-right text-slate-400 py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {compliance.sld_tests.map((test, idx) => (
                  <tr key={idx} className="border-b border-slate-700/50">
                    <td className="py-2 px-3 text-white">Tank {test.tank_id}</td>
                    <td className="py-2 px-3 text-slate-300">{test.test_type}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        test.test_result === 'PASS'
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-red-900/50 text-red-400'
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alarm History */}
      {compliance.alarms && compliance.alarms.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <span>Recent Alarms ({compliance.alarm_count_30d ?? 0} in last 30 days)</span>
          </h3>
          <div className="space-y-2">
            {compliance.alarms.map((alarm, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-4 py-3">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Tank {alarm.tank_id}</p>
                    <p className="text-slate-400 text-xs">{alarm.alarm_type}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-slate-400 text-xs">
                  <Clock className="w-3 h-3" />
                  <span>{format(new Date(alarm.alarm_timestamp), 'MMM d, yyyy h:mm a')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for no alarms */}
      {(!compliance.alarms || compliance.alarms.length === 0) && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-green-300 text-sm">No alarms in the last 30 days</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component: CSLD chain row for a single tank
const CSLDChainRow: React.FC<{ tank: TankCSLDStatus }> = ({ tank }) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Build a map from month abbreviation to chain entry for quick lookup
  const monthResultMap = new Map<string, CSLDMonthResult>();
  if (tank.month_chain) {
    for (const m of tank.month_chain) {
      if (m.month) monthResultMap.set(m.month, m);
    }
  }

  return (
    <div className="bg-slate-700/50 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
        <div className="flex items-center space-x-3">
          <span className="text-white font-medium">Tank {tank.tank_id}</span>
          <span className="text-slate-400 text-sm">{tank.product}</span>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium mt-1 sm:mt-0 w-fit ${
          tank.current_result === 'PASS'
            ? 'bg-green-900/50 text-green-400'
            : tank.current_result === 'FAIL'
              ? 'bg-red-900/50 text-red-400'
              : 'bg-slate-600 text-slate-400'
        }`}>
          {tank.current_result}
        </span>
      </div>
      <div className="flex items-center space-x-1">
        {months.map((label) => {
          const entry = monthResultMap.get(label);
          let dotColor = 'bg-slate-600'; // no data
          let tooltip = 'No data';
          if (entry) {
            // I207 records a test happening that month — use current_result from CSLD (I251) for overall status
            // but per-month we just know a test occurred
            dotColor = 'bg-blue-400'; // test recorded
            tooltip = `Test recorded${entry.date ? ` on ${entry.date.split('T')[0]}` : ''}`;
          }

          return (
            <div key={label} className="flex flex-col items-center flex-1 min-w-0">
              <div className={`w-3 h-3 rounded-full ${dotColor}`} title={`${label}: ${tooltip}`}></div>
              <span className="text-slate-500 text-[10px] mt-1 hidden sm:block">{label}</span>
            </div>
          );
        })}
      </div>
      <p className="text-slate-500 text-xs mt-2">
        {tank.consecutive_passes} consecutive pass{tank.consecutive_passes !== 1 ? 'es' : ''}
      </p>
    </div>
  );
};

export default ComplianceReport;
