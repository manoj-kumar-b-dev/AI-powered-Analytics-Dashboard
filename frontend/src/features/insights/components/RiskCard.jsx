import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

/**
 * RiskCard
 * Displays evidence-based risk without speculation.
 */
export default function RiskCard({ risk }) {
  if (!risk) return null;

  const { title, description, severity = 'medium', evidence, confidence = 0.85 } = risk;

  const severityStyles = {
    high: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
    medium: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    low: 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-500/20'
  };

  const confidencePct = Math.round((confidence > 1 ? confidence / 100 : confidence) * 100);

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs dark:shadow-md">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white font-display">{title}</h4>
        </div>
        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${severityStyles[severity] || severityStyles.medium}`}>
          {severity} Risk
        </span>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">{description}</p>

      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/60">
        {evidence && <span>Evidence: <strong className="text-slate-700 dark:text-slate-200">{evidence}</strong></span>}
        <span className="text-slate-500 dark:text-slate-400 ml-auto">Confidence: <strong className="text-amber-600 dark:text-amber-400">{confidencePct}%</strong></span>
      </div>
    </div>
  );
}

