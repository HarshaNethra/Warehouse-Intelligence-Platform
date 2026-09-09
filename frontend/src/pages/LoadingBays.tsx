import React, { useState, useEffect } from 'react';
import { Truck, Video, ArrowUpRight, Loader2, MapPin, LayoutGrid } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getLoadingBays, type LoadingBay as ApiLoadingBay } from '../api/facilities';
import { WarehouseFloorMap } from '../components/WarehouseFloorMap';
import { DataProvenanceOverlay } from '../components/DataProvenanceOverlay';

export const LoadingBays: React.FC = () => {
  const navigate = useNavigate();
  const [bays, setBays] = useState<ApiLoadingBay[]>([]);
  const [loading, setLoading] = useState(true);
  const [bayView, setBayView] = useState<'MAP' | 'CARDS'>('MAP');

  useEffect(() => {
    let isMounted = true;
    getLoadingBays()
      .then((data) => {
        if (!isMounted) return;
        setBays(data);
      })
      .catch((err) => console.warn('Failed to fetch loading bays:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <DataProvenanceOverlay endpoint="GET /api/bays" entity="loading_bays">
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1440px] mx-auto space-y-6 p-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" /> Facility Loading Bays & Digital Twin Control
          </h1>
          <p className="text-sm text-slate-500">
            Real-time status, multi-zone risk heat mapping, and active camera telemetry across warehouse dock bays.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setBayView('MAP')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                bayView === 'MAP' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Digital Twin Map</span>
            </button>
            <button
              type="button"
              onClick={() => setBayView('CARDS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                bayView === 'CARDS' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Bay Cards</span>
            </button>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {bays.length} Active Loading Bays Monitored
          </span>
        </div>
      </div>

      {/* View Switcher: Interactive Floor Plan vs Grid */}
      {bayView === 'MAP' ? (
        <WarehouseFloorMap
          onSelectZone={(zone) => {
            navigate(`/?video=${encodeURIComponent(zone.videoTitle)}`);
          }}
        />
      ) : loading ? (
        <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Loading facility loading bays...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {bays.map((bay) => {
            const isHigh = bay.risk_level === 'Critical' || bay.risk_level === 'High';
            const isMed = bay.risk_level === 'Medium';

            return (
              <div
                key={bay.id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition-all hover:shadow-md ${
                  isHigh ? 'border-orange-300 ring-1 ring-orange-500/20' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {bay.id}
                      </span>
                      <h3 className="font-semibold text-base text-slate-900">{bay.name}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-slate-400" />
                      {bay.camera_count} Optical Cameras Monitored
                    </p>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono uppercase ${
                    isHigh ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                    isMed ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                    'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    Risk: {bay.risk_level}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="text-slate-500 font-medium">Status</p>
                    <p className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {bay.status}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="text-slate-500 font-medium">Active Incidents</p>
                    <p className="font-bold text-slate-900 mt-0.5 text-sm font-mono">{bay.active_events_count} Active</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="text-slate-500 font-medium">AI Stream</p>
                    <p className="font-semibold text-blue-600 mt-0.5">● 1080p 30fps</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/70 border border-slate-200/60 rounded-lg flex items-center justify-between text-xs mb-4">
                  <span className="text-slate-600 truncate">
                    {bay.latest_incident_behaviour ? `Latest: ${bay.latest_incident_behaviour}` : 'Nominal handling observed'}
                  </span>
                  <span className="text-slate-400 text-[11px] shrink-0">Updated live</span>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full py-2 px-4 bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white rounded-lg text-xs font-semibold btn-interactive flex items-center justify-center gap-1.5"
                >
                  <span>Launch Live Operation Stream</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
    </DataProvenanceOverlay>
  );
};
