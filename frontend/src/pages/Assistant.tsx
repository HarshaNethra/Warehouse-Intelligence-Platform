import React from 'react';
import { AssistantChat } from '../components/AssistantChat';
import { Bot } from 'lucide-react';
import { motion } from 'framer-motion';
import { DataProvenanceOverlay } from '../components/DataProvenanceOverlay';

export const Assistant: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1280px] mx-auto space-y-6 text-slate-900"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
          <Bot className="w-6 h-6 text-indigo-600" /> AI Operations Assistant
        </h1>
        <p className="text-sm text-slate-500">
          Ask questions about warehouse activity, incidents, risk scores, and damage prevention recommendations.
        </p>
      </div>

      <DataProvenanceOverlay
        endpoint="/api/assistant/chat"
        facilityScope="FAC-001"
        entity="RAG Vector Engine + SQLite DB"
        filter="Conversational Grounded Query"
      >
        <div className="h-[700px]">
          <AssistantChat className="h-full" />
        </div>
      </DataProvenanceOverlay>
    </motion.div>
  );
};

