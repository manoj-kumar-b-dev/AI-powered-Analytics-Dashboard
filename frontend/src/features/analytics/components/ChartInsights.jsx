import React from 'react';
import { AlertCircle, Lightbulb, TrendingUp, Info } from 'lucide-react';

export const ChartInsights = ({ insights, yField }) => {
  if (!insights) return null;

  const yName = yField && yField !== '_count' ? yField : 'Record Count';

  const formatStat = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '—';
    if (num % 1 === 0) return num.toLocaleString();
    return num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  const isCurrency = yField && /revenue|sales_amount|amount|income|expenses|profit|cost/i.test(yField);
  const prefix = isCurrency ? '$' : '';

  return (
    <div className="flex flex-col h-full min-w-0 max-w-full overflow-hidden bg-[#0A0E1A]/40 border border-[#1F2937]/50 rounded-2xl p-5 space-y-5 select-text">
      <div>
        <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[#8B5CF6]" />
          AI Analytics & Insights
        </h4>
        <p className="text-[10px] text-gray-500 mt-0.5">Automated statistics and trend analysis</p>
      </div>

      {/* Quantitative summary cards */}
      <div className="grid grid-cols-2 gap-3.5 select-none">
        {/* Total Summary */}
        <div className="p-3 bg-slate-900/10 border border-[#1F2937]/40 rounded-xl">
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono">Total {yName}</span>
          <span className="text-sm font-bold text-white mt-1 block truncate">
            {prefix}{formatStat(insights.total)}
          </span>
        </div>

        {/* Average Summary */}
        <div className="p-3 bg-slate-900/10 border border-[#1F2937]/40 rounded-xl">
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono">Average</span>
          <span className="text-sm font-bold text-white mt-1 block truncate">
            {prefix}{formatStat(insights.average)}
          </span>
        </div>

        {/* Median Summary */}
        <div className="p-3 bg-slate-900/10 border border-[#1F2937]/40 rounded-xl">
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono">Median</span>
          <span className="text-sm font-bold text-white mt-1 block truncate">
            {prefix}{formatStat(insights.median)}
          </span>
        </div>

        {/* High / Peak Summary */}
        <div className="p-3 bg-slate-900/10 border border-[#1F2937]/40 rounded-xl">
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono">Highest Peak</span>
          <span className="text-sm font-bold text-white mt-1 block truncate" title={`${insights.highest.x}: ${insights.highest.y}`}>
            {prefix}{formatStat(insights.highest.y)}
          </span>
          <span className="text-[8px] text-gray-400 mt-0.5 block truncate font-mono">
            {insights.highest.x}
          </span>
        </div>
      </div>

      {/* Qualitative NLP Insights List */}
      <div className="flex-1 space-y-3 pt-2 border-t border-[#1F2937]/20">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1.5 select-none">
          <TrendingUp className="h-3.5 w-3.5 text-[#8B5CF6]" />
          Key Observations
        </span>

        <ul className="space-y-2.5 text-xs text-gray-300 leading-relaxed font-sans">
          {insights.bulletInsights.map((bullet, idx) => (
            <li key={idx} className="flex gap-2 items-start">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c084fc] shrink-0 mt-1.5" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Missing Cells Alert / Warning Indicator */}
      {insights.missingCount > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-300 text-[10px] flex gap-2 items-start font-mono leading-normal select-none">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span>Data completeness audit found {insights.missingCount} empty cells. These rows are skipped during metric calculations.</span>
          </div>
        </div>
      )}
    </div>
  );
};
