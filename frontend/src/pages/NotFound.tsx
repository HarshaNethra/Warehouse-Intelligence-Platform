import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LayoutDashboard, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export const NotFound: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto my-16 glass-panel p-8 text-center space-y-5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-100 shadow-xl"
    >
      <div className="w-14 h-14 rounded-full bg-amber-950/80 border border-amber-800 text-amber-400 flex items-center justify-center mx-auto">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white">404 - Terminal View Not Found</h1>
        <p className="text-sm text-slate-400 mt-2">
          The warehouse view or parameter you requested does not exist or has been relocated.
        </p>
      </div>
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          to="/"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-semibold btn-interactive shadow-md"
        >
          <ArrowLeft className="w-4 h-4" /> Live Monitoring
        </Link>
        <Link
          to="/dashboard"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold btn-interactive border border-slate-700"
        >
          <LayoutDashboard className="w-4 h-4" /> Overview
        </Link>
        <Link
          to="/incidents"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold btn-interactive border border-slate-700"
        >
          <AlertTriangle className="w-4 h-4" /> Incidents
        </Link>
      </div>
    </motion.div>
  );
};
