import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, ExternalLink, RotateCcw, Copy, Check, Sparkles, ChevronDown, ChevronUp, Database, Activity, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { askAssistant } from '../api/assistant';
import { sanitizeText } from '../lib/security';
import type { ChatMessage, SourceEvent } from '../types/assistant';

const INITIAL_GREETING: ChatMessage = { 
  role: 'assistant', 
  content: 'Hello! I am the AI Operations Assistant. I analyze real-time computer vision telemetry across warehouse loading bays, explain damage risks, and recommend supervisor interventions.' 
};

const CHAT_STORAGE_KEY = 'wms_assistant_chat_history';

const QUICK_PROMPTS = [
  "Show me today's highest-risk events",
  "What were the most common risky behaviours this shift?",
  "Which loading bay has the highest risk?",
  "Why was this incident classified as high risk?",
  "What behaviours should we address in tomorrow's training?",
];

function loadStoredMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse chat history from sessionStorage:', e);
  }
  return [INITIAL_GREETING];
}

export interface AssistantChatProps {
  className?: string;
}

export const AssistantChat: React.FC<AssistantChatProps> = ({ className }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(loadStoredMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showStatisticalPanel, setShowStatisticalPanel] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error(e);
    }
  }, [messages]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isTyping]);

  const executeQuery = async (queryText: string) => {
    const sanitizedQuery = sanitizeText(queryText.slice(0, 500));
    if (!sanitizedQuery || isTyping) return;

    setMessages(prev => [...prev, { role: 'user', content: sanitizedQuery }]);
    setInput('');
    setIsTyping(true);
    
    try {
      const response = await askAssistant({ question: sanitizedQuery });
      if (!isMountedRef.current) return;
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: response.answer,
          sources: response.source_events,
          model: response.model_used
        }
      ]);
    } catch {
      if (!isMountedRef.current) return;
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: 'I encountered an error retrieving verified records from the warehouse event database. Please try again.' 
        }
      ]);
    } finally {
      if (isMountedRef.current) {
        setIsTyping(false);
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawQuery = input.trim();
    if (!rawQuery) return;
    await executeQuery(rawQuery);
  };

  const handleClearHistory = () => {
    setMessages([INITIAL_GREETING]);
    setInput('');
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = (text: string, index: number) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(() => {
        if (isMountedRef.current) {
          setCopiedIndex(index);
          setTimeout(() => {
            if (isMountedRef.current) setCopiedIndex(null);
          }, 2000);
        }
      }).catch(() => {});
    }
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-xl text-slate-900 shadow-2xs flex flex-col ${className || 'h-[580px]'}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm leading-none">AI Operations Assistant</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Grounded Telemetry & Damage Prevention Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowStatisticalPanel(!showStatisticalPanel)}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI Architecture</span>
            {showStatisticalPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            title="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable Architecture Panel */}
      <AnimatePresence>
        {showStatisticalPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-50 text-slate-700 p-4 border-b border-slate-200 text-xs overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <span className="font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5 text-[11px]">
                <GitBranch className="w-4 h-4 text-indigo-600" />
                Grounded Telemetry RAG Architecture
              </span>
              <span className="font-mono text-[10px] text-slate-500">YOLO11 + ByteTrack Telemetry</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">1. Event Probability & Risk Scoring</span>
                <p className="text-slate-600 leading-normal">
                  Combines behavior severity, drop height, impact velocity, and repeat frequency into an explainable score (0–100).
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">2. Zero-Hallucination Grounding</span>
                <p className="text-slate-600 leading-normal">
                  Structured database events (timestamps, risk scores, Bay ID, incident IDs) injected directly into LLM context.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F7FA]">
        {messages.map((msg, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            key={i} 
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 shadow-2xs">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div className={`p-3.5 rounded-xl max-w-[85%] text-xs sm:text-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white shadow-2xs' 
                : 'bg-white text-slate-900 border border-slate-200 shadow-2xs'
            }`}>
              {msg.role === 'user' ? (
                <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>
              ) : (
                <div className="space-y-1.5 leading-relaxed">
                  {msg.content.split('\n').map((line, lIdx) => {
                    const trimmed = line.trim();
                    if (!trimmed) {
                      return <div key={lIdx} className="h-1.5" />;
                    }
                    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
                    const textContent = isBullet ? trimmed.slice(2) : line;
                    const parts = textContent.split(/(\*\*[^*]+\*\*)/g);
                    const renderedParts = parts.map((part, pIdx) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return (
                          <strong key={pIdx} className="font-semibold text-slate-900">
                            {part.slice(2, -2)}
                          </strong>
                        );
                      }
                      return part;
                    });
                    if (isBullet) {
                      return (
                        <div key={lIdx} className="flex items-start gap-2 ml-1">
                          <span className="text-blue-600 font-bold text-xs mt-0.5 shrink-0">•</span>
                          <span>{renderedParts}</span>
                        </div>
                      );
                    }
                    return <div key={lIdx}>{renderedParts}</div>;
                  })}
                </div>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Database className="w-3 h-3 text-blue-600" />
                    Grounded Incident Citations
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.map((src: SourceEvent) => (
                      <Link
                        key={src.event_id}
                        to={`/incident/${src.event_id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition-colors font-mono"
                      >
                        {src.event_id} ({src.behaviour})
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {msg.role === 'assistant' && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-end">
                  <button
                    onClick={() => handleCopy(msg.content, i)}
                    className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-[10px] font-medium transition-colors"
                    title="Copy response"
                  >
                    {copiedIndex === i ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedIndex === i ? 'Copied to clipboard' : 'Copy response'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 justify-start"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 rounded-xl bg-white text-slate-500 border border-slate-200 flex items-center gap-2 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Analyzing grounded database events...</span>
            </div>
          </motion.div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Suggested Enterprise Prompt Pills */}
      <div className="px-3 pt-2 pb-2 border-t border-slate-200 bg-white flex items-center gap-1.5 overflow-x-auto">
        <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" />
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => executeQuery(prompt)}
            disabled={isTyping}
            className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition-all shrink-0 cursor-pointer shadow-2xs font-medium"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            maxLength={500}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about warehouse activity, incidents, risk and prevention..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-4 pr-12 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
            disabled={isTyping}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isTyping}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold disabled:opacity-40 cursor-pointer flex items-center justify-center shadow-2xs"
            title="Send query"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
