import React from 'react';
import type { RiskLevel } from '../types/event';
import { cn } from '../lib/utils';
import { AlertTriangle, AlertCircle, Info, ShieldAlert, HelpCircle } from 'lucide-react';

interface RiskBadgeProps {
  level?: RiskLevel | string | null;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, className }) => {
  const normalizedLevel = String(level || '').trim();
  const lower = normalizedLevel.toLowerCase();

  let formattedLabel = 'Unknown';
  let color = 'bg-slate-100 text-slate-600 border-slate-200';
  let Icon = HelpCircle;

  if (lower === 'critical') {
    formattedLabel = 'Critical';
    color = 'bg-rose-50 text-rose-700 border-rose-200 font-semibold';
    Icon = ShieldAlert;
  } else if (lower === 'high') {
    formattedLabel = 'High';
    color = 'bg-red-50 text-red-600 border-red-200 font-medium';
    Icon = AlertTriangle;
  } else if (lower === 'medium') {
    formattedLabel = 'Medium';
    color = 'bg-amber-50 text-amber-700 border-amber-200 font-medium';
    Icon = AlertCircle;
  } else if (lower === 'low') {
    formattedLabel = 'Low';
    color = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium';
    Icon = Info;
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border shadow-2xs',
      color,
      className
    )}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {formattedLabel}
    </span>
  );
};
