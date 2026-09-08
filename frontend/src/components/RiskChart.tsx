import React from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

export const RiskChart: React.FC = () => {
  const { analytics, loading } = useAnalytics();
  const navigate = useNavigate();

  if (loading) {
    return <div className="bg-white border border-slate-200 rounded-xl h-[300px] animate-pulse" />;
  }

  const data = [
    { name: 'Critical', value: analytics.summary.criticalEvents, color: '#DC2626' },
    { name: 'High', value: analytics.summary.highRiskEvents, color: '#F97316' },
    { name: 'Medium', value: analytics.summary.mediumRiskEvents, color: '#F59E0B' },
    { name: 'Low', value: analytics.summary.lowRiskEvents, color: '#16A34A' },
  ];

  const handleBarClick = (entry: any) => {
    if (entry && entry.name) {
      navigate(`/incidents?risk=${entry.name}`);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-[300px] flex flex-col shadow-2xs">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
        <h3 className="text-sm font-bold text-slate-900">Handling Risk Distribution</h3>
        <span className="text-[11px] text-slate-400 font-medium">Click bar to filter queue</span>
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip 
              cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
              contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#111827', boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.08)' }}
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
