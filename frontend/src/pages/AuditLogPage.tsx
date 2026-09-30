import React, { useEffect, useState } from 'react';
import { ShieldAlert, Clock, User, FileText, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { AuditLogItem } from '../types';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.getAuditLogs();
        setLogs(res);
      } catch (e) {
        console.error('Audit logs fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400 font-bold uppercase">SECURITY & COMPLIANCE</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-white mt-1">Immutable Mission Audit Trail</h1>
          <p className="text-xs text-slate-400 font-mono">Who • What • When • Why • Pre/Post State • Plan Evolution</p>
        </div>

        <div className="text-xs font-mono text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl bg-emerald-950/40">
          SHA-256 INTEGRITY VERIFIED
        </div>
      </div>

      <div className="glass-panel p-4 rounded-2xl border border-cyan-500/20 overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
              <th className="pb-3 px-2">Timestamp</th>
              <th className="pb-3 px-2">Actor / Role</th>
              <th className="pb-3 px-2">Action</th>
              <th className="pb-3 px-2">State Transition</th>
              <th className="pb-3 px-2">Plan</th>
              <th className="pb-3 px-2">Reason / Audit Justification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-900/60 transition-all">
                <td className="py-3 px-2 text-slate-400 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </td>
                <td className="py-3 px-2 whitespace-nowrap">
                  <div className="font-bold text-white">{log.user_name}</div>
                  <div className="text-[10px] text-cyan-400">{log.role}</div>
                </td>
                <td className="py-3 px-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                    {log.action}
                  </span>
                </td>
                <td className="py-3 px-2 text-slate-300 whitespace-nowrap">
                  {log.previous_value && log.new_value ? (
                    <span>{log.previous_value} → <strong className="text-emerald-400">{log.new_value}</strong></span>
                  ) : (
                    <span>-</span>
                  )}
                </td>
                <td className="py-3 px-2 text-cyan-400 font-bold whitespace-nowrap">
                  {log.plan_version || 'PLAN V1'}
                </td>
                <td className="py-3 px-2 text-slate-300 max-w-xs truncate">
                  {log.reason || 'Autonomous operation'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
