import React, { useEffect, useState } from 'react';
import { BarChart3, Activity, Zap, RefreshCw, Clock, ShieldCheck, Flame, Car } from 'lucide-react';
import { api } from '../services/api';
import { AnalyticsCharts } from '../components/charts/AnalyticsCharts';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.getAnalytics();
        setData(res);
      } catch (e) {
        console.error('Analytics load error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-xs font-mono text-cyan-400">
        COMPUTING TELEMETRY METRICS...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400 font-bold uppercase">MISSION ANALYTICS</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-white mt-1">Autonomous Operations Telemetry</h1>
          <p className="text-xs text-slate-400 font-mono">Response Times • Fleet Optimization • Replanning Velocity</p>
        </div>

        <div className="text-right font-mono">
          <span className="text-[10px] text-slate-400 uppercase">Average Emergency SLA</span>
          <div className="text-3xl font-bold text-cyan-400">{data.average_response_time_min}m</div>
          <span className="text-[10px] text-emerald-400">98.4% On-Target</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-cyan-500/20">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Total Incidents Handled</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{data.total_incidents}</div>
          <div className="text-[10px] font-mono text-cyan-400 mt-1">{data.active_incidents} Active • {data.resolved_incidents} Resolved</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-rose-500/20">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Dynamic Replans Triggered</div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{data.replanning_events}</div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Self-healing allocations</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-amber-500/20">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Critical Tier Escalations</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{data.critical_incidents}</div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Priority dispatch</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-emerald-500/20">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Plan Version Distribution</div>
          <div className="text-xs font-mono text-emerald-400 mt-1.5 space-y-0.5">
            <div>V1: {data.plan_versions?.['Plan V1'] || 0}</div>
            <div>V2: {data.plan_versions?.['Plan V2'] || 0}</div>
            <div>V3+: {data.plan_versions?.['Plan V3+'] || 0}</div>
          </div>
        </div>
      </div>

      {/* Visual ECharts */}
      <div className="pt-2">
        <AnalyticsCharts analyticsData={data} />
      </div>
    </div>
  );
};
