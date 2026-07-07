import React from 'react';
import KpiCard from './KpiCard';
import ChartWidget from './ChartWidget';

/**
 * Main dashboard layout renderer. Renders generic KPI cards and chart widgets
 * based on layout coordinate specifications.
 */
export default function DashboardRenderer({ config, data = [], preferences }) {
  // Graceful empty state when configuration is absent or empty
  if (!config || !config.layout || !Array.isArray(config.layout) || config.layout.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center border border-dashed border-[#1F2937] rounded-3xl bg-[#111827]/10 p-12 backdrop-blur-md">
        <div className="h-12 w-12 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#c084fc] flex items-center justify-center mb-4">
          <span className="text-2xl">📊</span>
        </div>
        <h3 className="text-sm font-bold text-white font-display">Dashboard Configuration Empty</h3>
        <p className="text-xs text-gray-400 mt-2 max-w-sm leading-relaxed">
          The dashboard configuration for this dataset is empty or invalid. Import a new spreadsheet or set configuration details to build your view.
        </p>
      </div>
    );
  }

  // Use dynamic data passed as prop, or fallback to metadata sampleRows stored in layout config
  const datasetData = data && data.length > 0 ? data : (config.sampleRows || []);

  const {
    hiddenWidgetIds = [],
    pinnedWidgetIds = [],
    widgetOrder = [],
    widgetSizes = {}
  } = preferences || {};

  // 1. Filter out hidden widgets
  let processedLayout = config.layout.filter(w => !hiddenWidgetIds.includes(w.widgetId));

  const hasLayoutOverrides = pinnedWidgetIds.length > 0 || widgetOrder.length > 0 || Object.keys(widgetSizes).length > 0;

  // 2. Sort widgets by pin status and custom order index
  if (hasLayoutOverrides) {
    processedLayout = [...processedLayout].sort((a, b) => {
      const aPinned = pinnedWidgetIds.includes(a.widgetId);
      const bPinned = pinnedWidgetIds.includes(b.widgetId);

      // Pins float to the top
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Sort by custom order list
      const aIdx = widgetOrder.indexOf(a.widgetId);
      const bIdx = widgetOrder.indexOf(b.widgetId);

      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;

      return 0;
    });
  }

  return (
    <div className="grid grid-cols-12 auto-rows-[minmax(120px,_auto)] gap-6 w-full min-w-0 max-w-full overflow-x-hidden">
      {processedLayout.map(widget => {
        const sizeOverride = widgetSizes[widget.widgetId];
        const w = sizeOverride?.w || widget.gridPosition.w;
        const h = sizeOverride?.h || widget.gridPosition.h;

        // If coordinates overrides are active, signal auto-layout using -1 coordinates
        const gridPosition = hasLayoutOverrides ? {
          x: -1,
          y: -1,
          w,
          h
        } : {
          x: widget.gridPosition.x,
          y: widget.gridPosition.y,
          w,
          h
        };

        if (widget.type === 'kpi') {
          const kpi = (config.kpis || []).find(k => k.name === widget.refId);
          if (!kpi) return null;
          return (
            <KpiCard
              key={widget.widgetId}
              kpi={kpi}
              data={datasetData}
              gridPosition={gridPosition}
            />
          );
        }

        if (widget.type === 'chart') {
          const chart = (config.charts || []).find(c => c.title === widget.refId);
          if (!chart) return null;
          return (
            <ChartWidget
              key={widget.widgetId}
              chart={chart}
              data={datasetData}
              gridPosition={gridPosition}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
