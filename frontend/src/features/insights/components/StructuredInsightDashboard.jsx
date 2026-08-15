import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../shared/services/apiClient';
import { Sparkles, BrainCircuit, RefreshCw, AlertTriangle, Zap, Target, Layers, ArrowRightCircle, Loader2 } from 'lucide-react';
import ExecutiveSummaryCard from './ExecutiveSummaryCard';
import InsightCard from './InsightCard';
import PatternCard from './PatternCard';
import RiskCard from './RiskCard';
import OpportunityCard from './OpportunityCard';
import RecommendationCard from './RecommendationCard';

/**
 * StructuredInsightDashboard
 * Primary container component for consuming normalized structured AI insights.
 * Performs zero analytics calculations inside React.
 */
export default function StructuredInsightDashboard({ dataSourceId, config, data }) {
  const [loading, setLoading] = useState(false);
  const [insightData, setInsightData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchFullInsights();
  }, [dataSourceId, config, data]);

  const fetchFullInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/insights/generate-full', {
        method: 'POST',
        body: JSON.stringify({ dataSourceId, config, data })
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI insights payload.');
      }

      const res = await response.json();
      setInsightData(res.data || null);
    } catch (err) {
      console.error('[StructuredInsightDashboard] Error:', err);
      setError(err.message || 'Failed to analyze data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-4 bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600 dark:text-purple-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Generating AI Business Insights & Interpretations...</p>
        <p className="text-xs text-slate-500 dark:text-slate-500">Zero-Calculation Engine analyzing pre-computed outputs</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 text-sm flex items-center justify-between">
        <span>{error}</span>
        <button
          onClick={fetchFullInsights}
          className="px-3 py-1.5 bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/30 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!insightData) return null;

  const {
    executiveSummary,
    keyInsights = [],
    patterns = [],
    anomalies = [],
    risks = [],
    opportunities = [],
    recommendations = []
  } = insightData;

  const counts = {
    all: keyInsights.length + patterns.length + risks.length + opportunities.length + recommendations.length,
    insights: keyInsights.length,
    patterns: patterns.length,
    risks: risks.length,
    opportunities: opportunities.length,
    recommendations: recommendations.length
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">AI Insight Engine</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Structured non-calculation AI business interpretations</p>
          </div>
        </div>

        <button
          onClick={fetchFullInsights}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Insights
        </button>
      </div>

      {/* Phase 5: Executive Summary Card */}
      {executiveSummary && (
        <ExecutiveSummaryCard summary={executiveSummary} />
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100/80 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
        {[
          { key: 'all', label: 'All Categories', count: counts.all, icon: Sparkles },
          { key: 'insights', label: 'Key Insights', count: counts.insights, icon: Sparkles },
          { key: 'patterns', label: 'Patterns', count: counts.patterns, icon: Layers },
          { key: 'risks', label: 'Risks', count: counts.risks, icon: AlertTriangle },
          { key: 'opportunities', label: 'Opportunities', count: counts.opportunities, icon: Zap },
          { key: 'recommendations', label: 'Recommendations', count: counts.recommendations, icon: ArrowRightCircle }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${isActive ? 'bg-purple-700 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Phase 6: Key Insights Section */}
      {(activeTab === 'all' || activeTab === 'insights') && keyInsights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 font-display">
            <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" /> Key Insights ({keyInsights.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {keyInsights.map((insight, idx) => (
              <InsightCard key={idx} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Phase 7: Patterns Section */}
      {(activeTab === 'all' || activeTab === 'patterns') && patterns.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 font-display">
            <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> Recurring Patterns ({patterns.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patterns.map((pattern, idx) => (
              <PatternCard key={idx} pattern={pattern} />
            ))}
          </div>
        </div>
      )}

      {/* Phase 8 & 9: Anomalies & Risks Section */}
      {(activeTab === 'all' || activeTab === 'risks') && (anomalies.length > 0 || risks.length > 0) && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 font-display">
            <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400" /> Evidence-Based Risks & Anomalies ({risks.length + anomalies.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {risks.map((risk, idx) => (
              <RiskCard key={idx} risk={risk} />
            ))}
            {anomalies.map((anom, idx) => (
              <RiskCard key={`anom-${idx}`} risk={{ title: anom.title, description: anom.description, severity: 'medium', evidence: anom.evidence, confidence: anom.confidence }} />
            ))}
          </div>
        </div>
      )}

      {/* Phase 10: Opportunities Section */}
      {(activeTab === 'all' || activeTab === 'opportunities') && opportunities.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 font-display">
            <Zap className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Growth & Optimization Opportunities ({opportunities.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {opportunities.map((opp, idx) => (
              <OpportunityCard key={idx} opportunity={opp} />
            ))}
          </div>
        </div>
      )}

      {/* Phase 11 & 12: Actionable Recommendations Section */}
      {(activeTab === 'all' || activeTab === 'recommendations') && recommendations.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 font-display">
            <ArrowRightCircle className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> Prioritized Recommendations ({recommendations.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec, idx) => (
              <RecommendationCard key={idx} recommendation={rec} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

