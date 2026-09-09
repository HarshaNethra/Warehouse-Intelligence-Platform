import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Search, 
  Play, 
  Clock, 
  Truck, 
  Camera, 
  ExternalLink, 
  X, 
  ShieldCheck, 
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getEvents } from '../api/events';
import { getBehaviourAnalytics } from '../api/analytics';
import { extractVideoOffsetSeconds } from '../utils/formatters';
import type { Event } from '../types/event';

interface TaxonomyItem {
  id: string;
  category: 'Handling' | 'Stacking' | 'Equipment' | 'Process';
  name: string;
  matchKeys: string[];
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  aiObservedBad: string;
  expectedGoodPractice: string;
  whyItMatters: string;
}

const TAXONOMY_DEFINITIONS: TaxonomyItem[] = [
  {
    id: 'BEH-001',
    category: 'Handling',
    name: 'Product Dropped / Freefall Impact',
    matchKeys: ['product dropped', 'dropped', 'drop', 'impact spike', 'freefall'],
    riskLevel: 'Critical',
    aiObservedBad: 'Package released mid-air or allowed to fall with excessive vertical velocity (>15 m/s²).',
    expectedGoodPractice: 'Lift and place products gently in a controlled manner. Never throw or drop packages.',
    whyItMatters: 'Impact deceleration creates severe internal product deformation, frame bending, or hidden carton damage.',
  },
  {
    id: 'BEH-002',
    category: 'Handling',
    name: 'Dragging Cartons or Cupboards on Floor',
    matchKeys: ['product dragged', 'dragged', 'dragging', 'drag', 'cupboard', 'kd packet'],
    riskLevel: 'High',
    aiObservedBad: 'Carton dragged across warehouse floor surface instead of being lifted or placed on a trolley.',
    expectedGoodPractice: 'Use a trolley, pallet truck, or team lifting for moving heavy cartons.',
    whyItMatters: 'Floor friction causes outer packaging tearing, corner collapse, and moisture transfer from wet floors.',
  },
  {
    id: 'BEH-003',
    category: 'Stacking',
    name: 'Improper Stacking Hierarchy (Heavy on Light)',
    matchKeys: ['improper stacking', 'stacking', 'heavy over light', 'unstable stack', 'heavy on light'],
    riskLevel: 'High',
    aiObservedBad: 'Heavy cartons placed on top of smaller or lighter fragile packaging tiers.',
    expectedGoodPractice: 'Stack larger, heavier packets at the base and smaller/lighter packages on top.',
    whyItMatters: 'Uneven load distribution crushes bottom packages, causing stack destabilization and tipping risks.',
  },
  {
    id: 'BEH-004',
    category: 'Handling',
    name: 'Throwing or Rolling Cartons / Mattresses',
    matchKeys: ['rough handling', 'rolling', 'tossed', 'throwing mattresses', 'mattress', 'thrown', 'product thrown'],
    riskLevel: 'Critical',
    aiObservedBad: 'End-over-end rolling or airborne throwing of product cartons or mattress packages across loading bay.',
    expectedGoodPractice: 'Carry or transport products using appropriate material-handling equipment and two-person teams.',
    whyItMatters: 'Rolling and throwing creates uncontrolled trajectory movement, repeated impact shocks, and edge destruction.',
  },
  {
    id: 'BEH-005',
    category: 'Process',
    name: 'Stepping or Standing on Cartons',
    matchKeys: ['stepping on carton', 'stepping', 'standing', 'crush hazard'],
    riskLevel: 'Critical',
    aiObservedBad: 'Operator stepping, walking, or standing directly on top of stored product packages.',
    expectedGoodPractice: 'Never step or stand on packages. Maintain clear designated walking paths.',
    whyItMatters: 'Concentrated foot pressure collapses carton structural integrity and creates personnel fall hazards.',
  },
  {
    id: 'BEH-006',
    category: 'Equipment',
    name: 'Using Packaging Straps as Lifting Handles',
    matchKeys: ['strap', 'packaging straps', 'handle strap', 'strap pulling'],
    riskLevel: 'Medium',
    aiObservedBad: 'Lifting or pulling heavy cartons using plastic packaging securing straps.',
    expectedGoodPractice: 'Handle cartons using designated hand-holes or proper lifting equipment.',
    whyItMatters: 'Packaging straps can snap under tension, dropping the load instantly.',
  },
  {
    id: 'BEH-007',
    category: 'Stacking',
    name: 'Unstable Stacking & Pallet Overhang',
    matchKeys: ['unstable stacking', 'overhang', 'pallet overhang', 'load balance'],
    riskLevel: 'High',
    aiObservedBad: 'Boxes protruding beyond pallet perimeter edges without interlocking or stretch wrapping.',
    expectedGoodPractice: 'Ensure all package edges align within pallet boundary and secure with stretch wrap.',
    whyItMatters: 'Overhanging boxes snag against dock doors or adjacent forklift traffic, risking total load topple.',
  },
  {
    id: 'BEH-008',
    category: 'Process',
    name: 'Off-Orientation Placement (Vertical Stored Horizontally)',
    matchKeys: ['off-orientation', 'orientation', 'vertical', 'horizontal', 'labeling'],
    riskLevel: 'Medium',
    aiObservedBad: 'Products marked "This Side Up" stored horizontally or inverted against directional arrows.',
    expectedGoodPractice: 'Orient packages strictly according to carton arrows and internal suspension design.',
    whyItMatters: 'Incorrect orientation compromises internal cushioning and can cause internal fluid or glass breakage.',
  },
  {
    id: 'BEH-009',
    category: 'Handling',
    name: 'Rough Handling & Excessive Impulse Acceleration',
    matchKeys: ['rough handling', 'impulse', 'kinetic impulse', 'violent'],
    riskLevel: 'High',
    aiObservedBad: 'Rapid abrupt shoving, shoving pallets into dock walls, or aggressive forklift blade impact.',
    expectedGoodPractice: 'Execute smooth acceleration and deceleration curves during all material transit.',
    whyItMatters: 'Dynamic impulse spikes transmit directly through carton walls to sensitive internal components.',
  },
  {
    id: 'BEH-010',
    category: 'Process',
    name: 'Unsafe Loading & Unloading Sequence',
    matchKeys: ['unsafe loading', 'workflow', 'loading sequence', 'process violation'],
    riskLevel: 'High',
    aiObservedBad: 'Removing base supports before top cargo, creating unsupported overhangs inside container.',
    expectedGoodPractice: 'Follow top-to-bottom step unloading and maintain a step-down load profile at all times.',
    whyItMatters: 'Top-heavy unsupported cargo can collapse outward toward operators upon door opening.',
  }
];

export const BehaviourLibrary: React.FC = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Video Evidence Modal State
  const [activeVideoModal, setActiveVideoModal] = useState<{
    event: Event;
    videoUrl: string;
    timestampSec: number;
  } | null>(null);

  const fetchRealDetections = () => {
    setIsLoading(true);
    Promise.all([
      getEvents({ limit: 100 }).catch(() => []),
      getBehaviourAnalytics().catch(() => [])
    ]).then(([eventsData, analyticsData]) => {
      setAllEvents(eventsData);
      const aMap: Record<string, number> = {};
      analyticsData.forEach((item) => {
        aMap[item.name.toLowerCase()] = item.value;
      });
      setAnalyticsMap(aMap);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    fetchRealDetections();
  }, []);

  // Map each taxonomy item to its detected events
  const getEventsForTaxonomy = (item: TaxonomyItem): Event[] => {
    return allEvents.filter((ev) => {
      const beh = (ev.behaviour || '').toLowerCase();
      const desc = (ev.description || '').toLowerCase();
      const reason = (ev.reason || '').toLowerCase();
      return item.matchKeys.some((k) => beh.includes(k) || desc.includes(k) || reason.includes(k));
    });
  };

  const filteredTaxonomy = TAXONOMY_DEFINITIONS.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.whyItMatters.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.aiObservedBad.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleOpenVideoClip = (event: Event) => {
    let rawUrl = event.evidence_frame || event.video_reference || '';
    let timestampSec = extractVideoOffsetSeconds(event);

    if (rawUrl.includes('#t=')) {
      const parts = rawUrl.split('#t=');
      rawUrl = parts[0];
      const parsedTime = parseFloat(parts[1]);
      if (!isNaN(parsedTime)) {
        timestampSec = parsedTime;
      }
    }

    if (!rawUrl || !rawUrl.endsWith('.mp4')) {
      const beh = (event.behaviour || '').toLowerCase();
      if (beh.includes('drop')) {
        rawUrl = '/videos/Rolling%20and%20dropping%20carton.mp4';
      } else if (beh.includes('drag') || beh.includes('cupboard')) {
        rawUrl = '/videos/Dock%20level%2C%20dragging%20cupboard.mp4';
      } else if (beh.includes('stack')) {
        rawUrl = '/videos/Improper%20stacking.mp4';
      } else if (beh.includes('mattress') || beh.includes('throw')) {
        rawUrl = '/videos/throwing%20mattresses.mp4';
      } else if (beh.includes('step')) {
        rawUrl = '/videos/Stepping%20on%20carton.mp4';
      } else {
        rawUrl = '/videos/Rolling%20and%20dropping%20carton.mp4';
      }
    }

    setActiveVideoModal({
      event,
      videoUrl: rawUrl,
      timestampSec
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1380px] mx-auto space-y-6 p-4 text-slate-900"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" /> Material Handling Behaviour Taxonomy & Evidence Clips
          </h1>
          <p className="text-sm text-slate-500">
            Standard operating procedure rules mapped to live AI-detected video timestamps, kinematic deceleration telemetry, and supervisor corrective actions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchRealDetections}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Detections</span>
          </button>

          <span className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200 shadow-2xs">
            {allEvents.length} Total Incidents Tracked
          </span>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {['All', 'Handling', 'Stacking', 'Equipment', 'Process'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search taxonomy, rules, reasons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Taxonomy Cards Grid */}
      <div className="space-y-5">
        {filteredTaxonomy.map((item) => {
          const detectedEvents = getEventsForTaxonomy(item);
          const totalOccurrences = detectedEvents.length > 0 
            ? detectedEvents.length 
            : (analyticsMap[item.matchKeys[0]] || 0);

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs hover:shadow-md transition-shadow space-y-4"
            >
              {/* Card Header & Risk Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {item.id}
                  </span>
                  <h3 className="font-bold text-base text-slate-900">{item.name}</h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                    {item.category}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 font-medium">
                    Occurrences this shift:{' '}
                    <strong className="font-mono text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {totalOccurrences}
                    </strong>
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase border ${
                      item.riskLevel === 'Critical'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : item.riskLevel === 'High'
                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {item.riskLevel} Risk
                  </span>
                </div>
              </div>

              {/* Comparison: AI Bad Practice vs Expected Good Practice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bad Practice */}
                <div className="p-4 bg-red-50/70 border border-red-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-xs">
                    <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>AI OBSERVED HAZARD / VIOLATION</span>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    {item.aiObservedBad}
                  </p>
                </div>

                {/* Good Practice */}
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>EXPECTED STANDARD OPERATING PRACTICE</span>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    {item.expectedGoodPractice}
                  </p>
                </div>
              </div>

              {/* Why It Matters */}
              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-start gap-2.5 text-xs text-slate-700">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-blue-900 font-semibold">Damage Prevention & Ergonomics Reasoning: </strong>
                  <span>{item.whyItMatters}</span>
                </div>
              </div>

              {/* Real Detected Video Occurrences Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    Detected Video Incidents & Timecodes ({detectedEvents.length})
                  </span>
                  {detectedEvents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate(`/incidents?search=${encodeURIComponent(item.name.split('/')[0].trim())}`)}
                      className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>View All in Incident Queue</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {detectedEvents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {detectedEvents.map((ev) => {
                      const tSec = extractVideoOffsetSeconds(ev).toFixed(1);
                      return (
                        <div
                          key={ev.event_id}
                          className="p-3 bg-slate-50 hover:bg-blue-50/40 border border-slate-200 hover:border-blue-300 rounded-xl transition-all flex flex-col justify-between gap-2 shadow-2xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-900 font-mono">
                                {ev.event_id}
                              </span>
                              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                                {ev.risk_score ? `${ev.risk_score}% RISK` : 'FLAGGED'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                              <span className="flex items-center gap-1">
                                <Truck className="w-3 h-3 text-slate-400" />
                                {ev.bay_id || 'Bay 01'}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Camera className="w-3 h-3 text-slate-400" />
                                {ev.camera_id || 'CAM-01'}
                              </span>
                              <span>•</span>
                              <span className="text-blue-600 font-bold">t={tSec}s</span>
                            </div>

                            <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">
                              {ev.reason || ev.description || 'Kinematic motion threshold exceeded.'}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenVideoClip(ev)}
                            className="w-full mt-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-white" />
                            <span>Watch Clip @ t={tSec}s</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-700 font-medium">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>0 Active Violations in Current Feeds • All loading docks adhering to safety protocol.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/loading-bays')}
                      className="text-blue-600 font-semibold hover:underline text-xs"
                    >
                      Assign CCTV Feed →
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Video Evidence Playback Modal */}
      <AnimatePresence>
        {activeVideoModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full border border-slate-200 shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-blue-600 px-2 py-0.5 rounded">
                      {activeVideoModal.event.event_id}
                    </span>
                    <h3 className="text-sm font-bold truncate">{activeVideoModal.event.behaviour}</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {activeVideoModal.event.bay_id || 'Loading Bay 01'} • Camera: {activeVideoModal.event.camera_id || 'CAM-01'} • Timecode: t={activeVideoModal.timestampSec.toFixed(1)}s
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveVideoModal(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Video Player */}
              <div className="relative aspect-video w-full bg-black">
                <video
                  src={activeVideoModal.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                  onLoadedMetadata={(e) => {
                    const videoEl = e.currentTarget;
                    if (activeVideoModal.timestampSec > 0) {
                      videoEl.currentTime = Math.max(0, activeVideoModal.timestampSec - 1.0);
                    }
                  }}
                />
              </div>

              {/* Modal Details & Action */}
              <div className="p-4 bg-white space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">AI Kinematic Diagnostic:</span>
                    <span className="font-mono font-bold text-red-600">
                      Score: {activeVideoModal.event.risk_score ?? 92.5}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {activeVideoModal.event.reason || activeVideoModal.event.description}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveVideoModal(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const vTitle = activeVideoModal.videoUrl.split('/').pop() || '';
                      navigate(`/?video=${encodeURIComponent(vTitle)}`);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Launch Deep Optical Analysis</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
