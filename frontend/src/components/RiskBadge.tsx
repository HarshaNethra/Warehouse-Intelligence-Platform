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
    formattedLabel = 'Critical Risk';
    color = 'bg-red-50 text-red-800 border-red-200 font-bold';
    Icon = ShieldAlert;
  } else if (lower === 'high') {
    formattedLabel = 'High Risk';
    color = 'bg-orange-50 text-orange-800 border-orange-200 font-semibold';
    Icon = AlertTriangle;
  } else if (lower === 'medium') {
    formattedLabel = 'Medium Risk';
    color = 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
    Icon = AlertCircle;
  } else if (lower === 'low') {
    formattedLabel = 'Low Risk';
    color = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
    Icon = Info;
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono border shadow-2xs uppercase tracking-wider',
      color,
      className
    )}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {formattedLabel}
    </span>
  );
};
