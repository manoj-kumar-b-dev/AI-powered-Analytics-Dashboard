import React from 'react';
import { Target, Zap } from 'lucide-react';

/**
 * OpportunityCard
 * Displays evidence-based growth or optimization opportunity.
 */
export default function OpportunityCard({ opportunity }) {
  if (!opportunity) return null;

  const { title, description, potentialImpact = 'high', evidence, confidence = 0.9 } = opportunity;

  const impactStyles = {
    high: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    medium: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    low: 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-500/20'
  };

  const confidencePct = Math.round((confidence > 1 ? confidence / 100 : confidence) * 100);

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs dark:shadow-md">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white font-display">{title}</h4>
        </div>
        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${impactStyles[potentialImpact] || impactStyles.high}`}>
          {potentialImpact} Impact
        </span>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">{description}</p>

      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/60">
        {evidence && <span>Evidence: <strong className="text-slate-700 dark:text-slate-200">{evidence}</strong></span>}
        <span className="text-slate-500 dark:text-slate-400 ml-auto">Confidence: <strong className="text-emerald-600 dark:text-emerald-400">{confidencePct}%</strong></span>
      </div>
    </div>
  );
}

