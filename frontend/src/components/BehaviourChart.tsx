import React from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { BehaviourMetric } from '../types/analytics';

const BEHAVIOUR_COLORS: Record<string, string> = {
  'Product Dropped': '#E11D48',      // rose-600
  'Rough Handling': '#F97316',       // orange-500
  'Product Dragged': '#F59E0B',      // amber-500
  'Unstable Stacking': '#0284C7',    // sky-600
  'Fast Movement': '#8B5CF6',        // violet-500
  'Blocked Aisle': '#64748B',        // slate-500
};

export const BehaviourChart: React.FC = () => {
  const { analytics, loading } = useAnalytics();
  const navigate = useNavigate();

  if (loading) {
    return <div className="glass-panel h-[300px] animate-pulse" />;
  }

  const data = (analytics.behaviours || []).map((b: BehaviourMetric) => ({
    name: b.name,
    count: b.value,
    color: BEHAVIOUR_COLORS[b.name] || '#3B82F6',
  }));

  const handleBarClick = (entry: any) => {
    if (entry && entry.name) {
      navigate(`/incidents?search=${encodeURIComponent(entry.name)}`);
    }
  };

  return (
    <div className="glass-panel p-5 h-[300px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Behaviour Frequency
        </h3>
        <span className="text-[11px] text-slate-400">Click bar to filter</span>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
            <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
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
              cursor={{ fill: '#F1F5F9', opacity: 0.6 }}
              contentStyle={{ 
                backgroundColor: '#FFFFFF', 
                border: '1px solid #E2E8F0', 
                borderRadius: '8px', 
                color: '#0F172A', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
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
    </div>
  );
};
