import React from "react";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Trophy, Calendar, TrendingDown, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../shared/components/ui/card";

export function AIInsightsPanel({ data = [], onViewAll }) {
  const configMap = {
    growth: { icon: TrendingUp, color: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" },
    top_performer: { icon: Trophy, color: "bg-purple-500/20 text-purple-400 border border-purple-500/30" },
    decline: { icon: TrendingDown, color: "bg-rose-500/20 text-rose-400 border border-rose-500/30" },
    temporal: { icon: Calendar, color: "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" },
    financial: { icon: AlertTriangle, color: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
    recommendation: { icon: Lightbulb, color: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" },
    sparkle: { icon: Sparkles, color: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" },
    trending: { icon: TrendingUp, color: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
    warning: { icon: AlertTriangle, color: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
    lightbulb: { icon: Lightbulb, color: "bg-purple-500/20 text-purple-400 border border-purple-500/30" }
  };

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card className="flex flex-col h-auto border border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#0E1726] rounded-2xl transition-all duration-300 hover:border-purple-300 dark:hover:border-[#8B5CF6]/40 shadow-md dark:shadow-2xl mt-6">
      <CardHeader className="flex flex-row items-center justify-between p-5 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-display flex items-center gap-2">
              Executive AI Insights
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] dark:text-[#c084fc] border border-[#8B5CF6]/30 uppercase tracking-wider">
                Automated
              </span>
            </CardTitle>
          </div>
        </div>
        
        {onViewAll && (
          <button 
            onClick={onViewAll}
            className="text-xs font-bold text-[#8B5CF6] hover:text-[#7C3AED] dark:hover:text-[#a78bfa] transition-colors flex items-center gap-1 cursor-pointer border-none bg-transparent"
          >
            <span>View All Insights</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </CardHeader>
      
      <CardContent className="p-5 pt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {data.slice(0, 6).map((insight, idx) => {
          const cat = insight.category || insight.type || 'sparkle';
          const iconConfig = configMap[cat] || configMap.sparkle;
          const IconComp = iconConfig.icon;

          return (
            <div
              key={insight.id || idx}
              className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-[#1E293B] bg-slate-50/70 dark:bg-[#070D18]/70 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-all duration-200 group shadow-sm"
            >
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${iconConfig.color}`}>
                <IconComp className="h-4 w-4" />
              </div>
              
              <div className="flex flex-col min-w-0 flex-1 text-left">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate font-display">
                    {insight.headline || "Key Metric Insight"}
                  </span>
                  {insight.badgeText && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-700/50 shrink-0">
                      {insight.badgeText}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-gray-300 leading-snug font-medium line-clamp-2 select-text">
                  {insight.text || insight}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
