import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, ExternalLink, RotateCcw, Copy, Check, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { askAssistant } from '../api/assistant';
import { sanitizeText } from '../lib/security';
import type { ChatMessage, SourceEvent } from '../types/assistant';

const INITIAL_GREETING: ChatMessage = { 
  role: 'assistant', 
  content: 'Hello! I am grounded in the warehouse incident database. You can ask me about recent events, risk trends, or recommendations.' 
};

const CHAT_STORAGE_KEY = 'wms_assistant_chat_history';

const QUICK_PROMPTS = [
  'Critical risks today',
  'Incidents in Bay 4',
  'Forklift speeding occurrences',
  'Recommended safety mitigations',
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
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Sync to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error(e);
    }
  }, [messages]);

  // Auto-scroll to bottom on new messages (skip initial mount to avoid jumping the page)
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
    } else {
      // Fallback for non-secure HTTP contexts
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        if (isMountedRef.current) {
          setCopiedIndex(index);
          setTimeout(() => {
            if (isMountedRef.current) setCopiedIndex(null);
          }, 2000);
        }
      } catch (e) {
        console.warn('Clipboard copy fallback failed:', e);
      }
    }
  };

  return (
    <div className={`glass-panel flex flex-col ${className || 'h-[500px]'}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-slate-900 text-sm">Warehouse Intelligence Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Grounded in DB
          </span>
          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/50"
            title="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            key={i} 
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            <div className={`p-3.5 rounded-xl max-w-[85%] text-xs sm:text-sm ${
              msg.role === 'user' 
                ? 'bg-primary text-white shadow-2xs' 
                : 'bg-white text-slate-800 border border-slate-200/80 shadow-2xs'
            }`}>
              {msg.role === 'user' ? (
                <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>
              ) : (
                <div className="space-y-1 leading-relaxed">
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
                          <span className="text-primary font-bold text-xs mt-0.5 shrink-0">•</span>
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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Grounded Source Evidence
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.map((src: SourceEvent) => (
                      <Link
                        key={src.event_id}
                        to={`/incident/${src.event_id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-primary border border-slate-200 hover:bg-primary hover:text-white transition-colors"
                      >
                        {src.event_id} ({src.behaviour})
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {msg.role === 'assistant' && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono text-[10px] text-slate-400">{msg.model || 'wms-intelligence-rag'}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.content, i)}
                    className="flex items-center gap-1 hover:text-slate-700 py-0.5 px-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Copy answer"
                  >
                    {copiedIndex === i ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600 font-medium text-[10px]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span className="text-[10px]">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 justify-start"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="p-3 rounded-xl bg-white text-slate-500 border border-slate-200 flex items-center gap-2 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>Synthesizing grounded warehouse incident data...</span>
            </div>
          </motion.div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Quick Prompt Suggestions */}
      <div className="px-3 pt-2 pb-1.5 border-t border-slate-100 bg-slate-50/70 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => executeQuery(prompt)}
            disabled={isTyping}
            className="text-xs px-2.5 py-1 rounded-full bg-white hover:bg-primary/10 hover:text-primary text-slate-600 border border-slate-200/80 transition-all shrink-0 disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <form onSubmit={handleSend} className="p-3 bg-white/50">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            maxLength={500}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about incidents, bays, or risk trends (e.g. 'What happened in Bay 4?')..."
            aria-label="Ask warehouse intelligence question"
            className="w-full bg-slate-50 border border-slate-200 rounded-full py-2.5 pl-4 pr-12 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/20 premium-transition"
            disabled={isTyping}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isTyping}
            className="absolute right-1 top-1 bottom-1 aspect-square flex items-center justify-center bg-primary hover:bg-blue-700 text-white rounded-full disabled:opacity-40 disabled:hover:bg-primary btn-interactive cursor-pointer"
            title="Send query"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-between items-center px-2 pt-1 text-[10px] text-slate-400">
          <span>Grounded strictly in local incident logs</span>
          <span>{input.length}/500</span>
        </div>
      </form>
    </div>
  );
};
