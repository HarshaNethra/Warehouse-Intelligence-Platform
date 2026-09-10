import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  Cpu, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown
} from 'lucide-react';

export interface GovernanceControlItem {
  title: string;
  category: 'PRIVACY' | 'SECURITY' | 'GOVERNANCE';
  status: 'IMPLEMENTED' | 'GOVERNANCE_PRINCIPLE' | 'PLANNED_CONTROL';
  description: string;
  detail: string;
}

const GOVERNANCE_CONTROLS: GovernanceControlItem[] = [
  {
    title: 'Human-in-the-Loop Review Enforcement',
    category: 'GOVERNANCE',
    status: 'IMPLEMENTED',
    description: 'AI detections represent potential safety risks and require explicit human supervisor review.',
    detail: 'No AI detection automatically converts into a worker violation, disciplinary log, or punitive employment action. All incidents remain in PENDING_REVIEW until confirmed or marked false positive by a authorized human supervisor.'
  },
  {
    title: 'Separation of AI Evidence & Human Decisions',
    category: 'GOVERNANCE',
    status: 'IMPLEMENTED',
    description: 'AI perception scores and original video evidence remain 100% immutable.',
    detail: 'When a reviewer marks an alert as False Positive or Dismissed, the underlying YOLO11 kinematic detection score is preserved for AI model bias auditability without altering evidence history.'
  },
  {
    title: 'Transparent AI Explainability',
    category: 'GOVERNANCE',
    status: 'IMPLEMENTED',
    description: 'Kinematic tracking telemetry provides structured explanations for every flagged anomaly.',
    detail: 'Explanations communicate What Happened, Why It Was Flagged, and What a Human Should Review based directly on vertical acceleration spikes and velocity vectors.'
  },
  {
    title: 'Role-Based Access Control (RBAC)',
    category: 'SECURITY',
    status: 'IMPLEMENTED',
    description: 'JWT authenticated sessions strictly scope access by facility site and role.',
    detail: 'Supervisor review actions and incident status updates require valid session authorization. User identities are audited in IncidentReview records.'
  },
  {
    title: 'Minimal Data Collection',
    category: 'PRIVACY',
    status: 'IMPLEMENTED',
    description: 'Optical telemetry processes bounding boxes and kinematic signals without collecting personal biometrics.',
    detail: 'ByteTrack tracks object IDs (e.g. OBJ_CARTON #42) across dock zones rather than personal worker identities.'
  },
  {
    title: 'Informed Worker Consent & Safety Training',
    category: 'PRIVACY',
    status: 'GOVERNANCE_PRINCIPLE',
    description: 'Optical monitoring operates in designated loading bays as a collaborative safety tool.',
    detail: 'Facility operators are notified of optical surveillance zones designed to prevent merchandise damage and ergonomic strain.'
  },
  {
    title: 'Automated Video Data Retention Controls',
    category: 'SECURITY',
    status: 'PLANNED_CONTROL',
    description: 'Configurable storage lifecycle rules for automatic video archive purge.',
    detail: 'Planned feature: Unreviewed nominal video clips will automatically expire after 30 days unless tagged in an active safety incident investigation.'
  },
  {
    title: 'Facial Anonymization & Privacy Blurring Filters',
    category: 'PRIVACY',
    status: 'PLANNED_CONTROL',
    description: 'Real-time video stream privacy masking for non-active background personnel.',
    detail: 'Planned feature: Automated Gaussian blur filter applied to non-essential personnel frames before video export.'
  }
];

export const ResponsibleAiGovernance: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'PRIVACY' | 'SECURITY' | 'GOVERNANCE'>('ALL');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filteredControls = GOVERNANCE_CONTROLS.filter(
    (c) => activeCategory === 'ALL' || c.category === activeCategory
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Responsible AI & Governance Safeguards
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            WitWatch is committed to ethical computer vision, human-in-the-loop decision support, worker privacy, and zero automated punitive actions.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeCategory === 'ALL' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Controls
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('GOVERNANCE')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeCategory === 'GOVERNANCE' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Governance
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('PRIVACY')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeCategory === 'PRIVACY' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Privacy
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('SECURITY')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeCategory === 'SECURITY' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Security
          </button>
        </div>
      </div>

      {/* Prominent Non-Punitive System Disclaimer */}
      <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
        <div className="flex items-center gap-2 font-bold text-blue-900">
          <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Core System Disclaimer & Safeguard Architecture</span>
        </div>
        <p className="leading-relaxed text-blue-800">
          WitWatch serves strictly as an <strong>AI-assisted safety monitoring and decision-support system</strong>. Computer-vision predictions detect potential operational risk for human supervisor evaluation and <strong>do not independently execute employment, disciplinary, or punitive decisions</strong>.
        </p>
      </div>

      {/* Control Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredControls.map((control, idx) => {
          const isExpanded = expandedIndex === idx;

          return (
            <div
              key={control.title}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {control.category === 'GOVERNANCE' && <Cpu className="w-4 h-4 text-blue-600 shrink-0" />}
                  {control.category === 'PRIVACY' && <Eye className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {control.category === 'SECURITY' && <Lock className="w-4 h-4 text-amber-600 shrink-0" />}
                  
                  <h3 className="text-xs font-bold text-slate-900">
                    {control.title}
                  </h3>
                </div>

                {/* Explicit Credibility Badges (Implemented vs Governance Principle vs Planned Control) */}
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0 uppercase border ${
                  control.status === 'IMPLEMENTED' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                  control.status === 'GOVERNANCE_PRINCIPLE' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                  'bg-slate-200 text-slate-600 border-slate-300'
                }`}>
                  {control.status.replace('_', ' ')}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {control.description}
              </p>

              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{isExpanded ? 'Hide implementation details' : 'View governance details'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-600 leading-relaxed font-mono bg-white p-2.5 rounded-lg border border-slate-200"
                  >
                    {control.detail}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Footer Credibility Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 pt-3 border-t border-slate-100 font-mono">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Audit Log Version: <strong>GOV-v1.4.2</strong></span>
        </span>
        <span>Human Oversight Mandatory Across All Operational Bays</span>
      </div>
    </div>
  );
};

export default ResponsibleAiGovernance;
