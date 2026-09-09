import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle2, XCircle, Info, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { getBehaviourAnalytics } from '../api/analytics';

import { DataProvenanceOverlay } from '../components/DataProvenanceOverlay';

interface TaxonomyItem {
  id: string;
  category: 'Handling' | 'Stacking' | 'Equipment' | 'Process';
  name: string;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  aiObservedBad: string;
  expectedGoodPractice: string;
  whyItMatters: string;
  occurrencesThisShift: number;
}

export const BehaviourLibrary: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [occurrencesMap, setOccurrencesMap] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;
    getBehaviourAnalytics()
      .then((data) => {
        if (!isMounted) return;
        const map: Record<string, number> = {};
        data.forEach(item => {
          map[item.name.toLowerCase()] = item.value;
        });
        setOccurrencesMap(map);
      })
      .catch((err) => console.warn('Failed to load behaviour analytics:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  const taxonomy: TaxonomyItem[] = [
    {
      id: 'BEH-001',
      category: 'Handling',
      name: 'Product Dropped / Impact Spike',
      riskLevel: 'Critical',
      aiObservedBad: 'Package released mid-air or allowed to fall with excessive vertical velocity (>15 m/s²).',
      expectedGoodPractice: 'Lift and place products gently in a controlled manner. Never throw or drop packages.',
      whyItMatters: 'Impact deceleration creates severe internal product deformation, frame bending, or hidden carton damage.',
      occurrencesThisShift: occurrencesMap['product dropped'] ?? 0
    },
    {
      id: 'BEH-002',
      category: 'Handling',
      name: 'Dragging Cartons or KD Packets',
      riskLevel: 'High',
      aiObservedBad: 'Carton dragged across warehouse floor surface instead of being lifted or placed on a trolley.',
      expectedGoodPractice: 'Use a trolley, pallet truck, or team lifting for moving heavy cartons.',
      whyItMatters: 'Floor friction causes outer packaging tearing, corner collapse, and moisture transfer from wet floors.',
      occurrencesThisShift: occurrencesMap['product dragged'] ?? 0
    },
    {
      id: 'BEH-003',
      category: 'Stacking',
      name: 'Improper Stacking (Heavy over Light)',
      riskLevel: 'High',
      aiObservedBad: 'Heavy cartons placed on top of smaller or lighter fragile packaging.',
      expectedGoodPractice: 'Stack larger, heavier packets at the base and smaller/lighter packages on top.',
      whyItMatters: 'Uneven load distribution crushes bottom packages, causing stack destabilization and tipping risks.',
      occurrencesThisShift: occurrencesMap['improper stacking'] ?? 0
    },
    {
      id: 'BEH-004',
      category: 'Handling',
      name: 'Rolling Cartons or Mattresses',
      riskLevel: 'High',
      aiObservedBad: 'End-over-end rolling of product cartons or mattress packages across loading bay.',
      expectedGoodPractice: 'Carry or transport products using appropriate material-handling equipment.',
      whyItMatters: 'Rolling creates uncontrolled trajectory movement, repeated impact points, and edge destruction.',
      occurrencesThisShift: occurrencesMap['rough handling'] ?? 0
    },
    {
      id: 'BEH-005',
      category: 'Process',
      name: 'Stepping or Standing on Cartons',
      riskLevel: 'Critical',
      aiObservedBad: 'Operator stepping, walking, or standing directly on top of stored product packages.',
      expectedGoodPractice: 'Never step or stand on packages. Maintain clear designated walking paths.',
      whyItMatters: 'Concentrated foot pressure collapses carton structural integrity and creates personnel fall hazards.',
      occurrencesThisShift: occurrencesMap['unstable stacking'] ?? 0
    },
    {
      id: 'BEH-006',
      category: 'Equipment',
      name: 'Using Packaging Straps as Handles',
      riskLevel: 'Medium',
      aiObservedBad: 'Lifting or pulling heavy cartons using plastic packaging securing straps.',
      expectedGoodPractice: 'Handle cartons using designated hand-holes or proper lifting equipment.',
      whyItMatters: 'Packaging straps can snap under tension, dropping the load instantly.',
      occurrencesThisShift: occurrencesMap['rough handling'] ?? 0
    }
  ];

  const filteredTaxonomy = taxonomy.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.whyItMatters.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <DataProvenanceOverlay endpoint="/api/analytics/behaviours" entity="BehaviourAnalytics" filter="Shift Behaviour Occurrences">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-[1280px] mx-auto space-y-6 p-4"
      >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" /> Material Handling Behaviour Taxonomy
          </h1>
          <p className="text-sm text-slate-500">
            Operational guide mapping AI-detected handling behaviors to expected good practices and damage prevention reasoning.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
            6 Predefined Behaviours Cataloged
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold btn-interactive transition-all ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search taxonomy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Taxonomy Cards Grid */}
      <div className="space-y-4">
        {filteredTaxonomy.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4"
          >
            {/* Title & Metadata */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {item.id}
                </span>
                <h3 className="font-bold text-base text-slate-900">{item.name}</h3>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                  {item.category}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  Occurrences this shift: <strong className="font-mono text-slate-900">{item.occurrencesThisShift}</strong>
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase ${
                  item.riskLevel === 'Critical' ? 'bg-red-100 text-red-800 border border-red-200' :
                  item.riskLevel === 'High' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                  'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {item.riskLevel} Risk
                </span>
              </div>
            </div>

            {/* Comparison Grid: Good vs Bad Practice */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bad Behavior */}
              <div className="p-4 bg-red-50/60 border border-red-200/80 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-red-700 font-bold text-xs">
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>AI OBSERVED BAD PRACTICE</span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed">
                  {item.aiObservedBad}
                </p>
              </div>

              {/* Good Behavior */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>EXPECTED GOOD PRACTICE</span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed">
                  {item.expectedGoodPractice}
                </p>
              </div>
            </div>

            {/* Why It Matters Explanation */}
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg flex items-start gap-2 text-xs text-slate-700">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-blue-900 font-semibold">Why It Matters (Damage Prevention Reasoning): </strong>
                {item.whyItMatters}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
    </DataProvenanceOverlay>
  );
};
