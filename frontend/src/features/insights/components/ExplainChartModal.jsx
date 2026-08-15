import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../shared/services/apiClient';
import { X, Sparkles, Loader2, TrendingUp, TrendingDown, Minus, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ExplainChartModal
 * Modal UI for Phase 14 "Explain with AI" chart feature.
 */
export default function ExplainChartModal({ isOpen, onClose, chartData }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && chartData) {
      fetchExplanation();
    } else {
      setResult(null);
      setError(null);
    }
  }, [isOpen, chartData]);

  const fetchExplanation = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/insights/explain-chart', {
        method: 'POST',
        body: JSON.stringify({
          title: chartData.title,
          type: chartData.type,
          config: chartData.config,
          aggregatedData: chartData.resolvedData || chartData.aggregatedData || [],
          forecast: chartData.forecast || []
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI chart explanation');
      }

      const res = await response.json();
      setResult(res.explanation);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error communicating with AI engine.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">AI Chart Explanation</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[280px]">{chartData?.title || 'Chart Insight'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {loading && (
              <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
                <p className="text-sm font-medium">Interpreting pre-calculated chart analytics...</p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-sm">
                {error}
              </div>
            )}

            {result && !loading && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2 font-display">Overview</h4>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-sans">{result.explanation}</p>
                </div>

                {result.keyTakeaways && result.keyTakeaways.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-display">Key Takeaways</h4>
                    <ul className="space-y-2">
                      {result.keyTakeaways.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400 mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800/80 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span>Overall Trend:</span>
                    <span className="font-semibold text-slate-900 dark:text-white uppercase">{result.trend}</span>
                  </div>
                  {result.confidence && (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{Math.round(result.confidence * 100)}% Confidence</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

