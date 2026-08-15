import React, { useState } from 'react';
import { Database, FileSpreadsheet, Table, ChevronDown, ChevronUp, Layers, CheckCircle2 } from 'lucide-react';

export function DatasetProfileHeader({ profile }) {
  const [showSampleRows, setShowSampleRows] = useState(false);

  if (!profile) return null;

  const { fileName, rowCount, columns = [], sampleRows = [], createdAt } = profile;

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'number':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'date':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'boolean':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-[#1F2937]';
    }
  };

  return (
    <div className="bg-white/90 dark:bg-[#0E1527]/80 border border-slate-200 dark:border-[#1F2937] rounded-2xl p-5 backdrop-blur-md space-y-4 shadow-xl text-slate-900 dark:text-white transition-colors">
      {/* Top Metadata Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-[#8B5CF6] dark:text-[#c084fc] shrink-0 shadow-inner">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display truncate max-w-xs sm:max-w-md">
                {fileName}
              </h3>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Active Dataset
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 flex items-center gap-3">
              <span>{rowCount?.toLocaleString()} total rows</span>
              <span>•</span>
              <span>{columns.length} columns detected</span>
              {createdAt && (
                <>
                  <span>•</span>
                  <span>Uploaded {new Date(createdAt).toLocaleDateString()}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {sampleRows.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSampleRows(!showSampleRows)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-[#1F2937] text-xs font-semibold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer self-start sm:self-center"
          >
            <Table className="h-3.5 w-3.5 text-[#8B5CF6]" />
            <span>{showSampleRows ? 'Hide Sample Preview' : 'View Sample Data (10 Rows)'}</span>
            {showSampleRows ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Column Schema Badges */}
      <div className="pt-2 border-t border-slate-200 dark:border-[#1F2937]/50">
        <div className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-[#8B5CF6]" />
          <span>Inferred Column Schema:</span>
        </div>
        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar">
          {columns.map((col, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-medium ${getTypeBadgeColor(
                col.type
              )}`}
            >
              <span>{col.name}</span>
              <span className="text-[9px] uppercase font-bold px-1 py-0.2 rounded bg-black/10 dark:bg-black/30 opacity-80">
                {col.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Expandable Sample Rows Table */}
      {showSampleRows && sampleRows.length > 0 && (
        <div className="pt-3 border-t border-slate-200 dark:border-[#1F2937]/50 overflow-x-auto custom-scrollbar max-h-64">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1F2937] bg-slate-100/70 dark:bg-slate-900/60">
                {columns.map((c) => (
                  <th key={c.name} className="p-2 font-bold text-slate-700 dark:text-gray-300 whitespace-nowrap font-mono text-[11px]">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1F2937]/40 text-slate-600 dark:text-gray-400">
              {sampleRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/30">
                  {columns.map((c) => (
                    <td key={c.name} className="p-2 whitespace-nowrap text-[11px]">
                      {row[c.name] !== null && row[c.name] !== undefined ? String(row[c.name]) : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
