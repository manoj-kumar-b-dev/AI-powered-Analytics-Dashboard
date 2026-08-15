import React from 'react';
import { Sparkles, FileText, CheckCircle2, ShieldAlert } from 'lucide-react';

/**
 * ExecutiveSummaryCard
 * Displays concise executive summary (~150 words) consuming normalized JSON context.
 * Performs NO calculations inside React.
 */
export default function ExecutiveSummaryCard({ summary, domainLabel, cleanliness, rowCount, columnCount }) {
  if (!summary) return null;

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md dark:shadow-xl backdrop-blur-md relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-slate-800/60">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">Executive Summary</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Domain-Aware Executive Overview</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {domainLabel && (
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300">
              {domainLabel}
            </span>
          )}
          {cleanliness && (
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Cleanliness: {cleanliness}
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-sans font-normal">
        {summary}
      </p>

      {(rowCount || columnCount) && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/40 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> {rowCount?.toLocaleString()} Records
          </span>
          <span>•</span>
          <span>{columnCount} Standard Columns</span>
        </div>
      )}
    </div>
  );
}

