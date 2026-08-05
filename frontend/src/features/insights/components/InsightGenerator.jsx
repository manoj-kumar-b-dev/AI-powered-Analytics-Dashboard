import React, { useState } from 'react';
import { 
  Sparkles, 
  Loader2, 
  BrainCircuit, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Trophy, 
  Calendar, 
  AlertTriangle, 
  Lightbulb, 
  Check, 
  Copy, 
  Zap,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InsightGenerator({ config, data }) {
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsHtml, setInsightsHtml] = useState(null);
  const [sourceProvider, setSourceProvider] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    if ((config || (data && data.length > 0)) && !insights && !isLoading && !error) {
      handleGenerate();
    }
  }, [config, data]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/insights/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ config, data }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate insights. Please try again.');
      }

      const result = await response.json();
      console.log('[InsightGenerator] Insight Generation Result:', result);
      if (result.insights && Array.isArray(result.insights)) {
        console.log('[InsightGenerator] Insights List:', result.insights);
        setInsights(result.insights);
      }
      setInsightsHtml(result.insightsHtml || null);
      setSourceProvider(result.source || 'grok');
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred while analyzing data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    let copyText = '';
    if (insights && insights.length > 0) {
      copyText = insights.map(i => `• ${i.headline ? `${i.headline}: ` : ''}${i.text}`).join('\n');
    } else if (insightsHtml) {
      // Strip HTML tags for plain text copy
      copyText = insightsHtml.replace(/<[^>]+>/g, '');
    }

    if (copyText) {
      navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Helper to resolve icon component
  const getCategoryIcon = (iconType, category) => {
    switch (iconType || category) {
      case 'trending-up':
      case 'growth':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'trophy':
      case 'top_performer':
        return <Trophy className="w-4 h-4 text-purple-400" />;
      case 'trending-down':
      case 'decline':
        return <TrendingDown className="w-4 h-4 text-rose-400" />;
      case 'calendar':
      case 'temporal':
        return <Calendar className="w-4 h-4 text-indigo-400" />;
      case 'alert-triangle':
      case 'financial':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'lightbulb':
      case 'recommendation':
        return <Lightbulb className="w-4 h-4 text-yellow-300" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-400" />;
    }
  };

  // Helper to resolve badge styles
  const getBadgeStyle = (badgeType) => {
    switch (badgeType) {
      case 'success':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'warning':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'critical':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
      case 'recommendation':
        return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30';
      case 'info':
      default:
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
    }
  };

  // Filter insights based on tab
  const filteredInsights = (insights || []).filter(item => {
    if (activeFilter === 'highlights') return ['growth', 'top_performer', 'temporal'].includes(item.category);
    if (activeFilter === 'alerts') return ['decline', 'financial'].includes(item.category);
    if (activeFilter === 'recommendations') return item.category === 'recommendation';
    return true;
  });

  const recommendationInsight = (insights || []).find(i => i.category === 'recommendation');

  return (
    <div className="col-span-12 rounded-3xl overflow-hidden mb-6 relative group">
      {/* Background Glassmorphism Styling */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1E1B4B]/80 via-[#0F172A]/90 to-[#181825]/90 backdrop-blur-2xl border border-indigo-500/20 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]" />
      
      <div className="relative p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-white/5">
        
        {/* Left Section: Grok AI Icon & Title */}
        <div className="flex flex-col gap-2 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 border border-indigo-400/30 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <BrainCircuit className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-300">
                  AI Insight Generator
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-300">
                  <Zap className="w-3 h-3 text-purple-400" />
                  Grok API
                </span>
              </div>
              <p className="text-xs text-indigo-200/70 mt-0.5">
                AI analyzes your charts and dataset metrics to explain what’s happening in plain business language.
              </p>
            </div>
          </div>
        </div>

        {/* Right Section: Action Controls */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          {(insights || insightsHtml) && !isLoading && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-200 text-xs font-medium transition-all border border-white/10"
              title="Copy Insights"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}

          {!insights && !insightsHtml ? (
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-semibold text-sm transition-all duration-300 transform hover:scale-105 shadow-[0_0_25px_rgba(99,102,241,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Grok AI Analyzing Data...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate AI Insights
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-semibold transition-all border border-indigo-400/30"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs (when insights generated) */}
      {insights && insights.length > 0 && !isLoading && (
        <div className="relative px-6 pt-4 flex items-center gap-2 overflow-x-auto border-b border-white/5 pb-3">
          <span className="text-xs text-indigo-300/50 flex items-center gap-1 mr-2">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {[
            { id: 'all', label: 'All Insights' },
            { id: 'highlights', label: 'Growth & Highlights' },
            { id: 'alerts', label: 'Alerts & Risks' },
            { id: 'recommendations', label: 'Recommendations' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === tab.id
                  ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-indigo-200 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Content & Results Panel */}
      <AnimatePresence>
        {(insights || insightsHtml || error || isLoading) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative p-6 sm:p-8 space-y-6"
          >
            {error ? (
              <div className="text-rose-400 text-sm flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                {error}
              </div>
            ) : isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-indigo-300/70 space-y-4">
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
                  <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-r-2 border-purple-400 animate-spin-reverse" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-white animate-pulse">Running Grok AI Analytics Engine...</p>
                  <p className="text-xs text-indigo-300/50">Calculating trends, regional breakdowns, and margin risks</p>
                </div>
              </div>
            ) : insights && insights.length > 0 ? (
              <div className="space-y-4">
                {/* Grid of Structured Insight Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredInsights.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 transition-all duration-200 flex flex-col justify-between gap-3 group/card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-white/5 border border-white/10 group-hover/card:scale-105 transition-transform">
                            {getCategoryIcon(item.icon, item.category)}
                          </div>
                          <span className="text-xs font-bold text-gray-200 tracking-wide">
                            {item.headline || 'AI Observation'}
                          </span>
                        </div>
                        {item.badgeText && (
                          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${getBadgeStyle(item.badgeType)}`}>
                            {item.badgeText}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-indigo-100/90 leading-relaxed font-normal">
                        {item.text}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {/* Dedicated Actionable Recommendation Highlight Callout */}
                {recommendationInsight && activeFilter !== 'highlights' && activeFilter !== 'alerts' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 border border-amber-500/30 flex items-start gap-4 shadow-lg"
                  >
                    <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-yellow-300 shrink-0">
                      <Lightbulb className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                        Actionable Strategy Recommendation
                      </h4>
                      <p className="text-sm text-amber-100 font-medium leading-relaxed">
                        {recommendationInsight.text}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              /* Fallback HTML string display */
              <div className="pt-2 prose prose-invert prose-indigo max-w-none prose-li:text-indigo-100/90 prose-strong:text-white">
                <div 
                  className="space-y-3 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: insightsHtml }} 
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
