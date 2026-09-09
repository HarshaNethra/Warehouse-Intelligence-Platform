import React, { useState } from 'react';
import { Database } from 'lucide-react';

interface DataLineageTooltipProps {
  endpoint: string;
  table: string;
  queryParam?: string;
  children: React.ReactNode;
}

export const DataLineageTooltip: React.FC<DataLineageTooltipProps> = ({
  endpoint,
  table,
  queryParam,
  children,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isDev = import.meta.env.DEV;

  if (!isDev) {
    return <>{children}</>;
  }

  return (
    <div 
      className="relative group inline-block w-full"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-slate-100 rounded-lg text-[10px] font-mono shadow-xl border border-slate-700 pointer-events-none whitespace-nowrap animate-in fade-in">
          <div className="flex items-center gap-1.5 font-bold text-blue-400 border-b border-slate-800 pb-1 mb-1">
            <Database className="w-3 h-3 text-blue-400" /> Data Lineage Provenance
          </div>
          <div><span className="text-slate-400">Endpoint:</span> <code className="text-emerald-400">{endpoint}</code></div>
          <div><span className="text-slate-400">DB Table:</span> <code className="text-amber-400">{table}</code></div>
          {queryParam && <div><span className="text-slate-400">Filter:</span> <code className="text-indigo-400">{queryParam}</code></div>}
        </div>
      )}
    </div>
  );
};
