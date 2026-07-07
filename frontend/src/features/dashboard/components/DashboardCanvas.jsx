import React, { useState, useEffect } from "react";
import GridLayout, { WidthProvider } from "react-grid-layout";
import { WidgetWrapper } from "./WidgetWrapper";
import { AutoChart } from "./AutoChart";
import {
  AlertCircle,
  Plus,
  TrendingUp,
  TrendingDown,
  Users,
  Wallet,
  ShoppingCart,
  Coins,
  DollarSign,
  Activity,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Package,
  MessageSquare,
  Star,
  Clock,
  Heart,
  GraduationCap,
  CreditCard,
  CheckSquare,
  Truck
} from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(GridLayout);

// -------------------------------------------------------
// Icon resolver — maps the icon string returned by the
// Gemini KPI recommendation (e.g. "DollarSign") to the
// corresponding Lucide component. No hardcoded lookups.
// -------------------------------------------------------
const ICON_MAP = {
  DollarSign, ShoppingCart, Users, Wallet, TrendingUp, TrendingDown,
  Activity, Coins, BarChart2, Percent, Package, MessageSquare,
  Star, Clock, Heart, GraduationCap, CreditCard, CheckSquare, Truck, ArrowUpRight
};

function resolveIcon(iconName) {
  return ICON_MAP[iconName] || Activity;
}

// -------------------------------------------------------
// Color resolver — maps color strings to Tailwind classes
// -------------------------------------------------------
const COLOR_CLASSES = {
  purple:  { icon: "text-[#8B5CF6]",  bg: "bg-[#8B5CF6]/15"  },
  blue:    { icon: "text-blue-400",    bg: "bg-blue-400/10"   },
  green:   { icon: "text-green-400",   bg: "bg-green-400/10"  },
  emerald: { icon: "text-emerald-400", bg: "bg-emerald-400/10"},
  red:     { icon: "text-rose-400",    bg: "bg-rose-400/10"   },
  amber:   { icon: "text-amber-400",   bg: "bg-amber-400/10"  },
  indigo:  { icon: "text-indigo-400",  bg: "bg-indigo-400/10" },
  orange:  { icon: "text-orange-400",  bg: "bg-orange-400/10" },
  slate:   { icon: "text-slate-400",   bg: "bg-slate-400/10"  }
};

function resolveColor(colorName) {
  return COLOR_CLASSES[colorName] || COLOR_CLASSES.blue;
}

// -------------------------------------------------------
// Main canvas
// -------------------------------------------------------
export function DashboardCanvas({
  widgets,
  onLayoutChange,
  onEditWidget,
  onDuplicateWidget,
  onDeleteWidget,
  isEditMode = true,
  onAddFirstWidget
}) {
  if (!widgets || widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 rounded-2xl border border-dashed border-[#1F2937] bg-[#111827]/10 min-h-[400px] backdrop-blur-sm">
        <div className="h-12 w-12 rounded-full bg-purple-500/10 border border-purple-500/20 text-[#8B5CF6] flex items-center justify-center mb-4 shadow-lg shadow-purple-500/5">
          <Plus className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-white font-display">No widgets added yet</h3>
        <p className="text-gray-400 text-xs mt-1 max-w-sm">
          Upload a dataset and confirm it — the AI pipeline will automatically generate your dashboard.
        </p>
        {onAddFirstWidget && (
          <button
            onClick={onAddFirstWidget}
            className="mt-5 px-4 py-2 bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-lg border-none shadow-purple-500/10"
          >
            Add Your First Widget
          </button>
        )}
      </div>
    );
  }

  const layout = widgets.map((widget) => ({
    i: widget.id,
    x: widget.layout?.x ?? 0,
    y: widget.layout?.y ?? 0,
    w: widget.layout?.w ?? 4,
    h: widget.layout?.h ?? 4,
    minW: 3,
    minH: 2
  }));

  const handleLayoutChange = (newLayout) => {
    if (!onLayoutChange) return;
    onLayoutChange(newLayout);
  };

  return (
    <div className="w-full max-w-full overflow-x-auto">
    <div className="relative w-full h-full min-h-[600px] select-text min-w-[600px]">
      <ResponsiveGridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={100}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
        isDraggable={isEditMode}
        isResizable={isEditMode}
        margin={[16, 16]}
        useCSSTransforms={true}
      >
        {widgets.map((widget) => {
          const type = widget.type || (widget.chartType === "kpi" ? "kpi-card" : `${widget.chartType}-chart`);
          const config = widget.config || {};
          const title = config.title || widget.title || "Untitled Widget";

          return (
            <div key={widget.id} className="relative">
              <WidgetWrapper
                title={title}
                type={type}
                widgetData={widget.resolvedData}
                isEditMode={isEditMode}
                onEdit={onEditWidget ? () => onEditWidget(widget) : null}
                onDuplicate={onDuplicateWidget ? () => onDuplicateWidget(widget) : null}
                onDelete={onDeleteWidget ? () => onDeleteWidget(widget) : null}
              >
                {widget.error ? (
                  <div className="flex flex-col items-center justify-center h-full text-rose-400 gap-2 p-4 text-center">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span className="text-xs font-semibold">{widget.error}</span>
                  </div>
                ) : type === "kpi-card" ? (
                  <WidgetKpi
                    title={title}
                    value={widget.resolvedData?.formattedValue || "—"}
                    kpiType={config.kpiType || widget.kpiType}
                    kpiMeta={widget.resolvedData?.meta}
                    deltaPct={widget.resolvedData?.deltaPct}
                    deltaDirection={widget.resolvedData?.deltaDirection}
                    period={widget.resolvedData?.period}
                  />
                ) : type === "table" ? (
                  <WidgetTable data={widget.resolvedData} />
                ) : (
                  <div className="w-full h-full relative overflow-hidden flex-1">
                    <AutoChart
                      chartType={type.replace("-chart", "")}
                      data={widget.resolvedData}
                      xField={config.xField || widget.xField}
                      yField={config.yField || widget.yField}
                    />
                  </div>
                )}
              </WidgetWrapper>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
    </div>
  );
}

// -------------------------------------------------------
// Animated count-up number
// -------------------------------------------------------
function AnimatedNumber({ value }) {
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    const stringVal = String(value);
    const numericVal = parseFloat(stringVal.replace(/[^0-9.]/g, ""));

    if (isNaN(numericVal)) {
      setDisplayVal(value);
      return;
    }

    const duration = 450;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      const current = progress * numericVal;

      if (stringVal.startsWith("$")) {
        setDisplayVal(`$${Math.round(current).toLocaleString()}`);
      } else {
        setDisplayVal(Math.round(current).toLocaleString());
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayVal(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{displayVal}</span>;
}

// -------------------------------------------------------
// KPI Widget — fully driven by backend dashboardConfig data
// No hardcoded fallback trends, goals, or sparklines.
// kpiMeta = { icon, color } returned by Gemini recommendation
// -------------------------------------------------------
function WidgetKpi({ title, value, kpiType, kpiMeta, deltaPct, deltaDirection, period }) {
  // Resolve icon and color from kpiMeta (set by Gemini) or reasonable defaults
  const iconName  = kpiMeta?.icon  || "Activity";
  const colorName = kpiMeta?.color || "blue";
  const colors    = resolveColor(colorName);
  const IconComponent = resolveIcon(iconName);

  // Trend — only show if real data exists, never invent values
  const hasTrend  = deltaPct !== null && deltaPct !== undefined;
  const isPositive = hasTrend ? (deltaDirection === "up") : null;
  const trendLabel = hasTrend
    ? `${deltaPct >= 0 ? "+" : ""}${deltaPct}%`
    : null;
  const timeframeLabel = period || "vs prior period";

  // Derive sparkline from deltaPct — 6 synthetic points around an upward/downward trajectory
  // These are relative y-positions only; the direction comes from real deltaPct.
  const sparkPoints = (() => {
    if (!hasTrend) return null;
    const isUp = isPositive;
    // Simple up or down trajectory — never hardcoded to specific KPI types
    return isUp
      ? [3,15, 13,12, 23,10, 33,7, 43,4, 53,2]
      : [3,2, 13,4, 23,7, 33,10, 43,12, 53,15];
  })();

  // Progress bar — derived from deltaPct capped at 100, or hidden entirely
  const progressPct = hasTrend ? Math.min(100, Math.max(0, Math.abs(deltaPct))) : null;

  return (
    <div className="h-full flex flex-col justify-between py-1 select-text">
      {/* Top: title + value + icon */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col text-left flex-1 min-w-0">
          <span className="text-[10px] text-gray-500 font-bold tracking-wider uppercase font-display truncate">
            {title || kpiType || "Value"}
          </span>
          <h2 className="text-3xl font-extrabold font-display text-white tracking-tight mt-1">
            <AnimatedNumber value={value} />
          </h2>
        </div>

        {/* Icon badge — color comes from Gemini metadata */}
        <div className={`h-9 w-9 rounded-xl ${colors.bg} ${colors.icon} flex items-center justify-center shadow-inner shrink-0`}>
          <IconComponent className="h-4.5 w-4.5" />
        </div>
      </div>

      {/* Middle: trend badge + sparkline */}
      {hasTrend && (
        <div className="flex items-center justify-between mt-3 gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 ${
              isPositive ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"
            }`}>
              {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              <span>{trendLabel}</span>
            </span>
            <span className="text-[9px] text-gray-500 font-medium">{timeframeLabel}</span>
          </div>

          {/* Sparkline — direction derived from real deltaPct */}
          {sparkPoints && (
            <div className="shrink-0 flex items-center">
              <svg width="52" height="18" className="overflow-visible opacity-85">
                <polyline
                  fill="none"
                  stroke={isPositive ? "#22C55E" : "#EF4444"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={sparkPoints.join(" ")}
                />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Bottom: progress bar — only rendered when real delta data exists */}
      {progressPct !== null && (
        <div className="mt-4 border-t border-[#1F2937]/30 pt-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[9px] font-bold text-gray-500 uppercase tracking-wider">
            <span>Change vs Prior</span>
            <span className={isPositive ? "text-emerald-400" : "text-rose-400"}>{trendLabel}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/[0.02]">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${
                isPositive ? "from-[#8B5CF6] to-[#6366F1]" : "from-[#EF4444] to-[#F59E0B]"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* No-data fallback */}
      {!hasTrend && (
        <p className="text-[9px] text-gray-600 font-medium mt-2">
          {period === 'No data for this period' ? 'No data for this period' : 'No prior period data for comparison'}
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Table widget — dynamic maxVal computed from real data
// -------------------------------------------------------
function WidgetTable({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-xs text-center py-8 font-medium">No data sets available</div>;
  }

  // Compute max from real data — no hardcoded mock values
  const maxVal = Math.max(...data.map(r => typeof r.y === "number" ? r.y : 0), 1);

  return (
    <div className="overflow-x-auto overflow-y-auto max-w-full w-full max-h-[160px] rounded-xl border border-[#1F2937]/50 bg-slate-950/20 select-text custom-scrollbar">
      <table className="w-full text-[11px] text-left border-collapse font-sans">
        <thead>
          <tr className="border-b border-[#1F2937]/50 bg-slate-900/40 text-gray-400 font-bold uppercase tracking-wider select-none">
            <th className="px-3.5 py-2.5 font-display text-[9px]">Label</th>
            <th className="px-3.5 py-2.5 font-display text-[9px]">Share</th>
            <th className="px-3.5 py-2.5 font-display text-[9px] text-right">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1F2937]/20">
          {data.slice(0, 10).map((row, idx) => {
            const val = row.y;
            const barWidth = Math.min(100, Math.round((val / maxVal) * 100));

            return (
              <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                <td className="px-3.5 py-2 text-gray-300 font-medium truncate max-w-[120px]">{row.x}</td>
                <td className="px-3.5 py-2">
                  <div className="flex items-center gap-2.5 min-w-[80px]">
                    <div className="h-1.5 w-16 bg-slate-950 rounded-full overflow-hidden shrink-0">
                      <div className="h-full bg-[#8B5CF6] rounded-full" style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold font-mono">{barWidth}%</span>
                  </div>
                </td>
                <td className="px-3.5 py-2 text-right text-indigo-400 font-bold font-mono">
                  {typeof val === "number" ? val.toLocaleString() : val}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
