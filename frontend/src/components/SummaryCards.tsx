import React from 'react';
import { Activity, AlertOctagon, TrendingUp, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export const SummaryCards: React.FC = () => {
  const { analytics, loading } = useAnalytics();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 glass-panel rounded-xl" />
        ))}
      </div>
    );
  }

  const { summary } = analytics;

  const cards = [
    { 
      title: 'Total Events', 
      value: summary.totalEvents, 
      icon: Activity, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      href: '/incidents'
    },
    { 
      title: 'Critical Risk', 
      value: summary.criticalEvents, 
      icon: ShieldAlert, 
      color: 'text-rose-600', 
      bg: 'bg-rose-50',
      href: '/incidents?risk=Critical'
    },
    { 
      title: 'High Risk', 
      value: summary.highRiskEvents, 
      icon: AlertOctagon, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50',
      href: '/incidents?risk=High'
    },
    { 
      title: 'Medium/Low', 
      value: summary.mediumRiskEvents + summary.lowRiskEvents, 
      icon: TrendingUp, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      href: '/incidents?risk=Medium/Low'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card, idx) => (
        <Link
          key={card.title}
          to={card.href}
          className="block group"
        >
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-panel p-5 flex items-center justify-between hover:border-slate-300 hover:shadow-lg active:scale-[0.98] premium-transition cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${card.bg} group-hover:scale-110 group-hover:-rotate-3 premium-transition`}>
                <card.icon className={`w-7 h-7 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">{card.title}</p>
                <h3 className="text-2xl font-semibold text-slate-900 tracking-tight">{card.value}</h3>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
          </motion.div>
        </Link>
      ))}
    </div>
  );
};


