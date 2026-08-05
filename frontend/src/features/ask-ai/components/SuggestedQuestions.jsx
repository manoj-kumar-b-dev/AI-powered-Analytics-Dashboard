import React from 'react';
import { Sparkles } from 'lucide-react';

export function SuggestedQuestions({ columns = [], onSelectQuestion, disabled = false }) {
  const numCols = columns.filter((c) => c.type === 'number').map((c) => c.name);
  const catCols = columns.filter((c) => c.type === 'string' || c.type === 'boolean').map((c) => c.name);
  const dateCols = columns.filter((c) => c.type === 'date').map((c) => c.name);

  const primaryMetric = numCols[0] || 'sales';
  const primaryCategory = catCols[0] || 'region';
  const secondaryCategory = catCols[1] || catCols[0] || 'products';
  const dateCol = dateCols[0] || 'month';

  const defaultSuggestions = [
    `Which ${primaryCategory} performs best?`,
    `Show ${primaryMetric} by ${dateCol}.`,
    `Why did ${primaryMetric} drop?`,
    `What are the top 5 ${secondaryCategory}?`
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <div className="flex items-center gap-1 text-[10px] font-bold text-[#8B5CF6] uppercase tracking-wider pr-1">
        <Sparkles className="h-3 w-3" />
        <span>Suggested:</span>
      </div>
      {defaultSuggestions.map((q, idx) => (
        <button
          key={idx}
          type="button"
          disabled={disabled}
          onClick={() => onSelectQuestion(q)}
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900/60 hover:bg-[#8B5CF6]/20 border border-[#1F2937] hover:border-[#8B5CF6]/40 text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left truncate max-w-[280px]"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
