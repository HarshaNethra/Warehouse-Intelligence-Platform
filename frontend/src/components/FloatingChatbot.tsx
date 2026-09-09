import React, { useState } from 'react';
import { Bot, X, Sparkles, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AssistantChat } from './AssistantChat';

export const FloatingChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Action Launcher Button (Always visible in bottom-right corner) */}
      <div className="fixed bottom-6 right-6 z-50 select-none">
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              className="relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-full shadow-2xl hover:shadow-indigo-500/25 border border-white/20 transition-all group cursor-pointer"
              title="Open Warehouse AI Assistant"
            >
              {/* Pulsing online indicator */}
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 border border-white" />
              </span>

              <div className="p-1 rounded-full bg-white/10 group-hover:rotate-12 transition-transform">
                <Bot className="w-5 h-5 text-white" />
              </div>

              <span className="text-xs font-bold tracking-wide pr-1 hidden sm:inline-block">
                AI Assistant
              </span>

              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Chatbot Modal / Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[420px] md:w-[460px] h-[600px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden text-slate-900"
          >
            {/* Custom Top Navigation Bar */}
            <div className="p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                  <Bot className="w-4 h-4 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5 leading-none">
                    Warehouse AI Assistant
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono border border-emerald-500/30 font-bold">
                      GEMINI 2.5
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Real-time Grounded Facility Copilot</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title="Minimize Chat"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title="Close Chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Core Assistant Chat Container */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <AssistantChat className="h-full border-0 rounded-none shadow-none" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingChatbot;
