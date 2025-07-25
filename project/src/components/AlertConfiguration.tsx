import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api';

interface AlertConfig {
  email_recipients: string[];
  daily_summary_time: string;
  enabled: boolean;
}

export const AlertConfiguration: React.FC = () => {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [summaryTime, setSummaryTime] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://central-tank-server.onrender.com'}/api/alert-config`);
      const data = await response.json();
      
      if (data.success) {
        setConfig(data.config);
        setSummaryTime(data.config.daily_summary_time);
      } else {
        setError(data.message || 'Failed to load configuration');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const addRecipient = async () => {
    if (!config || !newEmail) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://central-tank-server.onrender.com'}/api/alert-config/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: [...config.email_recipients, newEmail] })
      });
      
      const data = await response.json();
      if (data.success) {
        setConfig({ ...config, email_recipients: [...config.email_recipients, newEmail] });
        setNewEmail('');
        setError(null);
      } else {
        setError(data.message || 'Failed to add recipient');
      }
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const removeRecipient = async (email: string) => {
    if (!config) return;

    try {
      setSaving(true);
      const updatedEmails = config.email_recipients.filter(e => e !== email);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://central-tank-server.onrender.com'}/api/alert-config/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: updatedEmails })
      });
      
      const data = await response.json();
      if (data.success) {
        setConfig({ ...config, email_recipients: updatedEmails });
        setError(null);
      } else {
        setError(data.message || 'Failed to remove recipient');
      }
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const updateSummaryTime = async () => {
    if (!config) return;

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(summaryTime)) {
      setError('Please enter time in HH:MM format (e.g., 08:00)');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://central-tank-server.onrender.com'}/api/alert-config/summary-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: summaryTime })
      });
      
      const data = await response.json();
      if (data.success) {
        setConfig({ ...config, daily_summary_time: summaryTime });
        setError(null);
      } else {
        setError(data.message || 'Failed to update time');
      }
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const toggleAlerts = async () => {
    if (!config) return;

    try {
      setSaving(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://central-tank-server.onrender.com'}/api/alert-config/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !config.enabled })
      });
      
      const data = await response.json();
      if (data.success) {
        setConfig({ ...config, enabled: !config.enabled });
        setError(null);
      } else {
        setError(data.message || 'Failed to toggle alerts');
      }
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          <p className="text-slate-400 mt-2">Loading alert configuration...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="text-center text-red-400">
          Failed to load alert configuration
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Email Alert Configuration</h2>
        <button
          onClick={toggleAlerts}
          disabled={saving}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            config.enabled
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          } disabled:opacity-50`}
        >
          {config.enabled ? 'Alerts Enabled' : 'Alerts Disabled'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Email Recipients */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Email Recipients</h3>
        <div className="space-y-2">
          {config.email_recipients.map((email) => (
            <div key={email} className="flex items-center justify-between bg-slate-700 p-3 rounded-lg">
              <span className="text-slate-200">{email}</span>
              <button
                onClick={() => removeRecipient(email)}
                disabled={saving}
                className="text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        
        <div className="flex gap-2 mt-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Enter email address"
            className="flex-1 bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addRecipient}
            disabled={saving || !newEmail}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
          >
            Add Recipient
          </button>
        </div>
      </div>

      {/* Daily Summary Time */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Daily Summary Time</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={summaryTime}
            onChange={(e) => setSummaryTime(e.target.value)}
            placeholder="HH:MM (e.g., 08:00)"
            className="bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={updateSummaryTime}
            disabled={saving || summaryTime === config.daily_summary_time}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
          >
            Update Time
          </button>
        </div>
        <p className="text-sm text-slate-400 mt-2">
          Daily summary emails will be sent at {config.daily_summary_time} every day
        </p>
      </div>

      {/* Test Actions */}
      <div className="pt-4 border-t border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-3">Test Actions</h3>
        <div className="flex gap-2">
          <a
            href="https://central-tank-server.onrender.com/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-slate-600 hover:bg-slate-700 px-4 py-2 rounded-lg text-white font-medium"
          >
            Open Admin Panel
          </a>
        </div>
      </div>
    </div>
  );
};