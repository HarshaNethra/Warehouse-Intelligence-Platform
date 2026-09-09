import React, { useState } from 'react';
import { Database, Clock, Server, Building2, Code2 } from 'lucide-react';
import { useProvenance } from '../context/ProvenanceContext';

export interface DataProvenanceOverlayProps {
  endpoint: string;
  facilityScope?: string;
  filter?: string;
  entity: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

export const DataProvenanceOverlay: React.FC<DataProvenanceOverlayProps> = ({
  endpoint,
  facilityScope = 'FAC-001',
  filter,
  entity,
  lastUpdated,
  children,
}) => {
  const { provenanceEnabled } = useProvenance();
  const [showDetails, setShowDetails] = useState(false);
  const nowStr = lastUpdated || new Date().toISOString().substring(11, 19) + ' UTC';

  if (!provenanceEnabled) {
    return <>{children}</>;
  }

  return (
    <div 
      className="relative group rounded-xl transition-all"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      {/* Dev Provenance Badge Header */}
      <div className="flex items-center justify-between px-3 py-1 bg-slate-100 text-slate-700 rounded-t-xl text-[10px] font-mono border-b border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-bold text-blue-600">
            <Database className="w-3 h-3 text-blue-600" /> {entity}
          </span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1 text-emerald-700 font-semibold">
            <Server className="w-3 h-3 text-emerald-600" /> {endpoint}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-amber-800 font-semibold">
            <Building2 className="w-3 h-3 text-amber-600" /> {facilityScope}
          </span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1 text-slate-500">
            <Clock className="w-3 h-3 text-slate-400" /> {nowStr}
          </span>
        </div>
      </div>

      {/* Main Wrapped UI Component */}
      <div className="border border-slate-800/20 rounded-b-xl overflow-hidden">
        {children}
      </div>

      {/* Detailed Lineage Hover Tooltip */}
      {showDetails && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-slate-950 text-slate-100 rounded-xl text-[11px] font-mono shadow-2xl border border-slate-800 pointer-events-none whitespace-nowrap animate-in fade-in space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-blue-400 border-b border-slate-800 pb-1.5 mb-1.5">
            <Code2 className="w-3.5 h-3.5 text-blue-400" /> Developer Data Provenance Overlay
          </div>
          <div><span className="text-slate-400">Source API Endpoint:</span> <code className="text-emerald-400 font-bold">{endpoint}</code></div>
          <div><span className="text-slate-400">Facility Scope:</span> <code className="text-amber-300 font-bold">{facilityScope}</code></div>
          {filter && <div><span className="text-slate-400">Query / Filter:</span> <code className="text-indigo-300 font-bold">{filter}</code></div>}
          <div><span className="text-slate-400">Mapped DB Entity:</span> <code className="text-cyan-400 font-bold">{entity}</code></div>
          <div><span className="text-slate-400">Last Telemetry Fetch:</span> <code className="text-slate-300 font-bold">{nowStr}</code></div>
        </div>
      )}
    </div>
  );
};
