import React from 'react';
import { EventList } from '../components/EventList';

export const IncidentLog: React.FC = () => {
  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Violations & Incident Log</h1>
        <p className="text-slate-500">Complete historical record of detected anomalies and safety violations.</p>
      </div>

      {/* Wrapping EventList in a taller container since it's the main focus of this page */}
      <div className="h-[750px]">
        <EventList />
      </div>
    </div>
  );
};

