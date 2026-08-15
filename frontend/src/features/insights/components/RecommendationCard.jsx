import React from 'react';
import { ArrowRightCircle, CheckCircle2 } from 'lucide-react';

/**
 * RecommendationCard
 * Displays prioritized actionable recommendation.
 */
export default function RecommendationCard({ recommendation }) {
  if (!recommendation) return null;

  const { title, explanation, evidence, priority = 'medium', confidence = 0.94 } = recommendation;

  const priorityStyles = {
    high: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
    medium: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
    low: 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-500/20'
  };

  const confidencePct = Math.round((confidence > 1 ? confidence / 100 : confidence) * 100);

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-5 hover:border-indigo-400 dark:hover:border-indigo-500/40 transition-all shadow-md relative">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <ArrowRightCircle className="w-4.5 h-4.5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white font-display">{title}</h4>
        </div>
        <span className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-full border ${priorityStyles[priority] || priorityStyles.medium}`}>
          {priority} Priority
        </span>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">{explanation}</p>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[11px]">
        {evidence && (
          <span className="text-slate-500 dark:text-slate-400">
            Evidence: <strong className="text-indigo-700 dark:text-indigo-300 font-medium">{evidence}</strong>
          </span>
        )}
        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium ml-auto">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{confidencePct}% Confidence</span>
        </div>
      </div>
    </div>
  );
}

