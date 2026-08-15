import React from 'react';
import { TrendingUp, TrendingDown, Layers, Calendar, MapPin } from 'lucide-react';

/**
 * PatternCard
 * Displays recurring pattern (seasonal, category, regional, growth, decline).
 */
export default function PatternCard({ pattern }) {
  if (!pattern) return null;

  const { title, description, patternType = 'category', evidence, confidence = 0.9 } = pattern;

  const getIcon = () => {
    switch (patternType?.toLowerCase()) {
      case 'growth':
        return <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />;
      case 'decline':
        return <TrendingDown className="w-4 h-4 text-rose-500 dark:text-rose-400" />;
      case 'seasonal':
        return <Calendar className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />;
      case 'regional':
        return <MapPin className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />;
      default:
        return <Layers className="w-4 h-4 text-purple-500 dark:text-purple-400" />;
    }
  };

  const confidencePct = Math.round((confidence > 1 ? confidence / 100 : confidence) * 100);

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs dark:shadow-md">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center shrink-0">
          {getIcon()}
        </div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-white font-display">{title}</h4>
        <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/20">
          {patternType}
        </span>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">{description}</p>

      {evidence && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/60">
          <span>Evidence: <strong className="text-slate-700 dark:text-slate-200">{evidence}</strong></span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{confidencePct}% match</span>
        </div>
      )}
    </div>
  );
}

