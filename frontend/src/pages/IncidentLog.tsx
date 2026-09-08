import React from 'react';
import { EventList } from '../components/EventList';
import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { DataProvenanceOverlay } from '../components/DataProvenanceOverlay';

export const IncidentLog: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1440px] mx-auto space-y-6 text-slate-900"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-orange-600" /> Incidents & Handling Event Queue
        </h1>
        <p className="text-sm text-slate-500">
          AI-detected handling events requiring supervisor review, intervention, and corrective action logging.
        </p>
      </div>

      <DataProvenanceOverlay
        endpoint="/api/events"
        facilityScope="FAC-001"
        entity="Event"
        filter="Status / Risk / Facility Filtered"
      >
        <div className="h-[720px]">
          <EventList />
        </div>
      </DataProvenanceOverlay>
    </motion.div>
  );
};

