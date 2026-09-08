import React from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

export const RiskChart: React.FC = () => {
  const { analytics, loading } = useAnalytics();
  const navigate = useNavigate();

  if (loading) {
    return <div className="glass-panel h-[300px] animate-pulse" />;
  }

  const data = [
    { name: 'Critical', value: analytics.summary.criticalEvents, color: '#991B1B' },
    { name: 'High', value: analytics.summary.highRiskEvents, color: '#EF4444' },
    { name: 'Medium', value: analytics.summary.mediumRiskEvents, color: '#F59E0B' },
    { name: 'Low', value: analytics.summary.lowRiskEvents, color: '#10B981' },
  ];

  const handleBarClick = (entry: any) => {
    if (entry && entry.name) {
      navigate(`/incidents?risk=${entry.name}`);
    }
  };

  return (
    <div className="glass-panel p-5 h-[300px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Risk Distribution</h3>
        <span className="text-[11px] text-slate-400">Click bar to filter</span>
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              cursor={{ fill: '#F1F5F9', opacity: 0.6 }}
              contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar 
              dataKey="value" 
              radius={[4, 4, 0, 0]}
              onClick={handleBarClick}
              className="cursor-pointer"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity cursor-pointer" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

