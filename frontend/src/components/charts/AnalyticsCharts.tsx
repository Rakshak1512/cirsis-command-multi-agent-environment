import React from 'react';
import ReactECharts from 'echarts-for-react';

interface AnalyticsChartsProps {
  analyticsData: any;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ analyticsData }) => {
  if (!analyticsData) return null;

  // 1. Incident Breakdown Pie Chart
  const incidentPieOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      orient: 'horizontal',
      bottom: '0',
      textStyle: { color: '#94a3b8', fontSize: 11 },
    },
    series: [
      {
        name: 'Incidents',
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#0b1329',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 12,
            fontWeight: 'bold',
            color: '#fff',
          },
        },
        data: [
          { value: analyticsData.fire_incidents, name: 'Fires', itemStyle: { color: '#ff334b' } },
          { value: analyticsData.road_accidents, name: 'Road Accidents', itemStyle: { color: '#38bdf8' } },
          { value: analyticsData.critical_incidents, name: 'Critical Escalations', itemStyle: { color: '#f59e0b' } },
        ],
      },
    ],
  };

  // 2. Resource Utilization Bar Chart
  const utilizationOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['Fire Teams', 'Ambulances', 'Hospital Beds'],
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%', color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        data: [
          { value: analyticsData.resource_utilization?.fire_teams || 60, itemStyle: { color: '#ef4444' } },
          { value: analyticsData.resource_utilization?.ambulances || 75, itemStyle: { color: '#38bdf8' } },
          { value: analyticsData.resource_utilization?.hospitals || 40, itemStyle: { color: '#00f0ff' } },
        ],
        type: 'bar',
        barWidth: '40%',
        showBackground: true,
        backgroundStyle: { color: 'rgba(255, 255, 255, 0.04)', borderRadius: 6 },
        itemStyle: { borderRadius: [6, 6, 0, 0] },
      },
    ],
  };

  // 3. Hourly Incident Flow Line Chart
  const hourlyOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: (analyticsData.hourly_distribution || []).map((h: any) => h.hour),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: 'Incidents Reported',
        type: 'line',
        smooth: true,
        data: (analyticsData.hourly_distribution || []).map((h: any) => h.count),
        lineStyle: { color: '#00f0ff', width: 3 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 240, 255, 0.35)' },
              { offset: 1, color: 'rgba(0, 240, 255, 0.01)' },
            ],
          },
        },
        itemStyle: { color: '#00f0ff', borderColor: '#fff', borderWidth: 2 },
      },
    ],
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Chart 1 */}
      <div className="glass-panel p-4 rounded-2xl border border-cyan-500/20">
        <h4 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider mb-2">
          Incident Categories
        </h4>
        <ReactECharts option={incidentPieOption} style={{ height: '220px' }} />
      </div>

      {/* Chart 2 */}
      <div className="glass-panel p-4 rounded-2xl border border-cyan-500/20">
        <h4 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider mb-2">
          Fleet & Hospital Utilization
        </h4>
        <ReactECharts option={utilizationOption} style={{ height: '220px' }} />
      </div>

      {/* Chart 3 */}
      <div className="glass-panel p-4 rounded-2xl border border-cyan-500/20">
        <h4 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider mb-2">
          Incident Dispatch Velocity (Today)
        </h4>
        <ReactECharts option={hourlyOption} style={{ height: '220px' }} />
      </div>
    </div>
  );
};
