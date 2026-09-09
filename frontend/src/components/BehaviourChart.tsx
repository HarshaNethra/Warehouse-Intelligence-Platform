import React from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { BehaviourMetric } from '../types/analytics';

const BEHAVIOUR_COLORS: Record<string, string> = {
  'Product Dropped': '#DC2626',      // Red 600
  'Rough Handling': '#F97316',       // Orange 500
  'Product Dragged': '#F59E0B',      // Amber 500
  'Unstable Stacking': '#2563EB',    // Blue 600
  'Improper Stacking': '#6366F1',    // Indigo 600
  'Product Thrown': '#7C3AED',       // Violet 600
};

export const BehaviourChart: React.FC = () => {
  const { analytics, loading } = useAnalytics();
  const navigate = useNavigate();

  if (loading) {
    return <div className="bg-white border border-slate-200 rounded-xl h-[300px] animate-pulse" />;
  }

  const data = (analytics.behaviours || []).map((b: BehaviourMetric) => ({
    name: b.name,
    count: b.value,
    color: BEHAVIOUR_COLORS[b.name] || '#2563EB',
  }));

  const handleBarClick = (entry: any) => {
    if (entry && entry.name) {
      navigate(`/incidents?search=${encodeURIComponent(entry.name)}`);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-[300px] flex flex-col shadow-2xs">
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" /> Top Risky Behaviours
        </h3>
        <span className="text-[11px] text-slate-400 font-medium">Click bar to filter queue</span>
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-400 font-mono bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
          No behaviour patterns recorded yet.
        </div>
      ) : (
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
              <XAxis type="number" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="#64748B" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
                width={110}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  border: '1px solid #E2E8F0', 
                  borderRadius: '8px', 
                  color: '#111827', 
                  boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.08)',
                  fontSize: '12px'
                }}
                formatter={(value: any) => [`${value} incidents`, 'Detected Count']}
              />
              <Bar 
                dataKey="count" 
                radius={[0, 4, 4, 0]}
                onClick={handleBarClick}
                className="cursor-pointer"
              >
                {data.map((entry: { name: string; count: number; color: string }, index: number) => (
                  <Cell key={`behaviour-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity cursor-pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
