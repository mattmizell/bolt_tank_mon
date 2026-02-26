import React, { useState, useEffect } from 'react';
import { FleetCompliance } from '../types';
import { ApiService } from '../services/api';
import { ArrowLeft, Shield, CheckCircle, XCircle, AlertTriangle, Building2 } from 'lucide-react';
import { format } from 'date-fns';

interface ComplianceFleetViewProps {
  onBack: () => void;
  onStoreSelect: (storeName: string) => void;
}

export const ComplianceFleetView: React.FC<ComplianceFleetViewProps> = ({ onBack, onStoreSelect }) => {
  const [fleet, setFleet] = useState<FleetCompliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFleet = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await ApiService.getFleetCompliance();
        setFleet(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load fleet compliance');
      } finally {
        setLoading(false);
      }
    };
    fetchFleet();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg">Loading fleet compliance data...</p>
        </div>
      </div>
    );
  }

  if (error || !fleet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Stores</span>
          </button>
          <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 text-center">
            <Shield className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Compliance Data</h3>
            <p className="text-slate-400">Fleet compliance data is not available yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const compliantCount = fleet.stores.filter(s => s.overall_status === 'COMPLIANT').length;
  const nonCompliantCount = fleet.stores.filter(s => s.overall_status === 'NON-COMPLIANT').length;
  const noDataCount = fleet.stores.filter(s => s.overall_status !== 'COMPLIANT' && s.overall_status !== 'NON-COMPLIANT').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Stores</span>
            </button>
            <div className="flex items-center space-x-3">
              <img
                src="/betterday-energy-logo_trans.png"
                alt="Better Day Energy"
                className="h-8 w-auto"
              />
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Environmental Compliance Fleet Report</h1>
                <p className="text-slate-400">CSLD/SLD monitoring across all stores</p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Stores</p>
                <p className="text-2xl font-bold text-white">{fleet.stores.length}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-5 border border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Compliant</p>
                <p className="text-2xl font-bold text-green-400">{compliantCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-5 border border-red-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Non-Compliant</p>
                <p className="text-2xl font-bold text-red-400">{nonCompliantCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">No Data</p>
                <p className="text-2xl font-bold text-slate-400">{noDataCount}</p>
              </div>
              <Shield className="w-8 h-8 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Store Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600 bg-slate-800/80">
                  <th className="text-left text-slate-400 py-3 px-4">Store</th>
                  <th className="text-left text-slate-400 py-3 px-4">Status</th>
                  <th className="text-right text-slate-400 py-3 px-4">Tanks</th>
                  <th className="text-right text-slate-400 py-3 px-4">Compliant</th>
                  <th className="text-right text-slate-400 py-3 px-4">Alarms (30d)</th>
                  <th className="text-right text-slate-400 py-3 px-4">Last Collected</th>
                </tr>
              </thead>
              <tbody>
                {fleet.stores.map((store) => (
                  <tr
                    key={store.store_name}
                    onClick={() => onStoreSelect(store.store_name)}
                    className="border-b border-slate-700/50 hover:bg-slate-700/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-white font-medium">{store.store_name}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={store.overall_status} />
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">{store.tank_count}</td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      {store.compliant_tanks}/{store.tank_count}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={store.alarm_count_30d > 0 ? 'text-red-400 font-medium' : 'text-slate-400'}>
                        {store.alarm_count_30d}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      {store.last_collected
                        ? format(new Date(store.last_collected), 'MMM d, yyyy')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            Environmental compliance data collected via automated tank gauge monitoring
          </p>
        </div>
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'COMPLIANT') {
    return (
      <span className="inline-flex items-center space-x-1 bg-green-900/50 text-green-400 px-2 py-0.5 rounded text-xs font-medium">
        <CheckCircle className="w-3 h-3" />
        <span>COMPLIANT</span>
      </span>
    );
  }
  if (status === 'NON-COMPLIANT') {
    return (
      <span className="inline-flex items-center space-x-1 bg-red-900/50 text-red-400 px-2 py-0.5 rounded text-xs font-medium">
        <XCircle className="w-3 h-3" />
        <span>NON-COMPLIANT</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center space-x-1 bg-slate-600 text-slate-400 px-2 py-0.5 rounded text-xs font-medium">
      <AlertTriangle className="w-3 h-3" />
      <span>{status || 'NO DATA'}</span>
    </span>
  );
};

export default ComplianceFleetView;
