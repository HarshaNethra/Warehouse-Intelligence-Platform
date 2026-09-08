import React from 'react';
import { AssistantChat } from '../components/AssistantChat';

export const Assistant: React.FC = () => {
  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">AI Assistant (RAG)</h1>
        <p className="text-slate-500">Query your warehouse data, incident logs, and standard operating procedures naturally.</p>
      </div>

      <div className="h-[700px]">
        <AssistantChat className="h-full" />
      </div>
    </div>
  );
};

