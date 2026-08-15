import React from 'react';
import { Lightbulb, Tag, CheckCircle2 } from 'lucide-react';

/**
 * InsightCard
 * Displays a key insight with title, description, evidence reference, and confidence bar.
 * Consumes normalized JSON. Performs NO calculations.
 */
export default function InsightCard({ insight }) {
  if (!insight) return null;

  const { title, description, importance = 'medium', confidence = 0.9, evidence } = insight;

  const importanceStyles = {
    high: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
    medium: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    low: 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-500/20'
  };

  const confidencePct = Math.round((confidence > 1 ? confidence / 100 : confidence) * 100);

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 shadow-xs dark:shadow-md">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight font-display">{title}</h4>
        </div>
        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${importanceStyles[importance] || importanceStyles.medium}`}>
          {importance.toUpperCase()}
        </span>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
        {description}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/60 text-[11px]">
        {evidence && (
          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/50">
            <Tag className="w-3 h-3 text-slate-400 dark:text-slate-500" /> Evidence: <strong className="text-slate-700 dark:text-slate-200 font-medium">{evidence}</strong>
          </span>
        )}
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 ml-auto">
          <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
          <span>Confidence: <strong className="text-emerald-600 dark:text-emerald-400">{confidencePct}%</strong></span>
        </div>
      </div>
    </div>
  );
}

