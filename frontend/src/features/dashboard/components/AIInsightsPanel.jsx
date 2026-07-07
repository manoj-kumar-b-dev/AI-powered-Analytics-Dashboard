import React from "react";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../shared/components/ui/card";

export function AIInsightsPanel({ data }) {
  // Map insight type to solid circle background colors and icons
  const configMap = {
    sparkle: {
      icon: Sparkles,
      color: "bg-[#22C55E] text-white"
    },
    trending: {
      icon: TrendingUp,
      color: "bg-[#3B82F6] text-white"
    },
    warning: {
      icon: AlertTriangle,
      color: "bg-[#F59E0B] text-white"
    },
    lightbulb: {
      icon: Lightbulb,
      color: "bg-[#8B5CF6] text-white"
    }
  };

  return (
    <Card className="flex flex-col min-h-[380px] h-auto border border-[#1F2937] bg-[#111827]/70 backdrop-blur-md rounded-2xl transition-all duration-300 hover:border-slate-700 hover:shadow-xl hover:shadow-[#8B5CF6]/5">
      <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4.5 w-4.5 text-[#8B5CF6]" />
          <CardTitle className="text-lg font-bold text-white tracking-tight">AI Insights</CardTitle>
        </div>
        
        <button 
          onClick={() => alert("Showing all insights...")}
          className="text-xs font-semibold text-[#8B5CF6] hover:text-[#8B5CF6]/85 transition-colors flex items-center gap-0.5 select-none cursor-pointer"
        >
          <span>View All</span>
        </button>
      </CardHeader>
      
      <CardContent className="flex-1 p-6 pt-2 overflow-y-auto scrollbar-thin space-y-3">
        {data.map((insight) => {
          const config = configMap[insight.type] || configMap.sparkle;
          const IconComp = config.icon;

          return (
            <div
              key={insight.id}
              className="flex items-start gap-4 p-3.5 rounded-xl border border-[#1F2937]/50 bg-slate-800/10 hover:bg-slate-800/25 transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5 cursor-pointer"
            >
              {/* Solid Circle Icon Container */}
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-md ${config.color}`}>
                <IconComp className="h-4 w-4 text-white" />
              </div>
              
              {/* Insight Text */}
              <p
                className="text-xs text-gray-300 leading-relaxed font-semibold pt-0.5 select-text"
                dangerouslySetInnerHTML={{ __html: insight.text }}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
