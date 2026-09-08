import React from 'react';
import { SummaryCards } from '../components/SummaryCards';
import { RiskChart } from '../components/RiskChart';
import { BehaviourChart } from '../components/BehaviourChart';
import { EventList } from '../components/EventList';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Eye } from 'lucide-react';

export const Dashboard: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1600px] mx-auto space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Operational Overview</h1>
          <p className="text-slate-500">Real-time risk monitoring and behaviour intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 btn-interactive shadow-2xs"
          >
            <Eye className="w-4 h-4 text-primary" /> Live Feeds
          </Link>
          <Link
            to="/incidents"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white text-sm font-semibold btn-interactive shadow-2xs"
          >
            Incident Log <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <SummaryCards />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskChart />
        <BehaviourChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EventList />
        </div>
        
        <div className="space-y-6">
          <div className="glass-panel p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Active Safety Rules
            </h3>
            
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-semibold text-slate-900">Rule 01: Freefall Drop Detection</p>
                <p className="text-slate-500 mt-0.5">Threshold: Acceleration spike &gt; 9.8m/s² with ground collision</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-semibold text-slate-900">Rule 02: Forceful Rough Handling</p>
                <p className="text-slate-500 mt-0.5">Threshold: Horizontal translation delta &gt; 4.5m/s²</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-semibold text-slate-900">Rule 03: Pallet Overhang Limit</p>
                <p className="text-slate-500 mt-0.5">Threshold: Box bounding box footprint &gt; 30% border margin</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
