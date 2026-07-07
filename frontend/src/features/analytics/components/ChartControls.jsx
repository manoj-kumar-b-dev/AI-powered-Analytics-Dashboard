import React, { useMemo } from 'react';
import { Sliders, Filter, ArrowUpDown, RefreshCw, X } from 'lucide-react';

export const ChartControls = ({
  headers,
  detectedTypes,
  rawRows,
  chartType,
  setChartType,
  xField,
  setXField,
  yField,
  setYField,
  aggregation,
  setAggregation,
  groupBy,
  setGroupBy,
  filters,
  handleFilterChange,
  handleClearFilters,
  sortConfig,
  setSortConfig,
  resetToRecommendation,
  recommendation
}) => {
  
  // Identify numeric vs string/category headers
  const numericHeaders = useMemo(() => {
    return headers.filter(h => ['Numeric', 'Integer', 'Float', 'Currency', 'Percentage'].includes(detectedTypes[h]));
  }, [headers, detectedTypes]);

  const categoryHeaders = useMemo(() => {
    return headers.filter(h => ['Category', 'Date', 'Time', 'Text', 'Boolean'].includes(detectedTypes[h]));
  }, [headers, detectedTypes]);

  // Dynamically find distinct values for filter dropdowns (cap at 30 items for smooth render)
  const filterOptions = useMemo(() => {
    const cols = headers.filter(h => {
      const type = detectedTypes[h];
      return type === 'Category' || /region|country|state|dept|department|product|item|category|salesperson|staff/i.test(h);
    });

    const distinct = {};
    cols.forEach(col => {
      const vals = new Set();
      for (let i = 0; i < rawRows.length; i++) {
        const val = rawRows[i][col];
        if (val !== null && val !== undefined && val !== '') {
          vals.add(val.toString());
        }
        if (vals.size >= 30) break;
      }
      distinct[col] = Array.from(vals).sort();
    });
    return distinct;
  }, [headers, detectedTypes, rawRows]);

  const hasActiveFilters = Object.values(filters).some(v => v !== null && v !== undefined && v !== '');

  return (
    <div className="bg-[#0A0E1A]/40 border border-[#1F2937]/50 rounded-2xl p-5 space-y-5">
      <div className="flex justify-between items-center border-b border-[#1F2937]/30 pb-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
          <Sliders className="h-4 w-4 text-[#8B5CF6]" />
          Visual Customization Overrides
        </h4>
        <button
          onClick={resetToRecommendation}
          className="text-[10px] text-[#c084fc] hover:text-white font-bold transition-colors cursor-pointer bg-transparent border-none flex items-center gap-1.5"
          title="Restore AI Suggested Configuration"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Restore AI Suggested
        </button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
        {/* Chart Type Selector */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider font-mono">Chart Type</label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            className="w-full max-w-full min-w-0 h-9 bg-[#050810]/80 border border-[#1F2937] text-xs text-white rounded-xl px-2.5 outline-none font-semibold focus:border-gray-500 transition-colors cursor-pointer"
          >
            <option value="line">Line Chart</option>
            <option value="bar">Bar Chart</option>
            <option value="area">Area Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="scatter">Scatter Chart</option>
            <option value="horizontal-bar">Horizontal Bar</option>
            <option value="histogram">Histogram</option>
            <option value="composed">Composed Chart</option>
          </select>
        </div>

        {/* X-Axis Selector */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider font-mono">X-Axis (Dimension)</label>
          <select
            value={xField}
            onChange={(e) => setXField(e.target.value)}
            className="w-full max-w-full min-w-0 h-9 bg-[#050810]/80 border border-[#1F2937] text-xs text-white rounded-xl px-2.5 outline-none font-semibold focus:border-gray-500 transition-colors cursor-pointer"
          >
            {headers.map(h => (
              <option key={h} value={h}>
                {h} ({detectedTypes[h]})
              </option>
            ))}
          </select>
        </div>

        {/* Y-Axis Selector */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider font-mono">Y-Axis (Metric)</label>
          <select
            value={yField}
            onChange={(e) => setYField(e.target.value)}
            className="w-full max-w-full min-w-0 h-9 bg-[#050810]/80 border border-[#1F2937] text-xs text-white rounded-xl px-2.5 outline-none font-semibold focus:border-gray-500 transition-colors cursor-pointer"
            disabled={chartType === 'histogram'}
          >
            <option value="_count">Record Count (Default)</option>
            {numericHeaders.map(h => (
              <option key={h} value={h}>
                {h} ({detectedTypes[h]})
              </option>
            ))}
          </select>
        </div>

        {/* Aggregation Selector */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider font-mono">Aggregation</label>
          <select
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value)}
            className="w-full max-w-full min-w-0 h-9 bg-[#050810]/80 border border-[#1F2937] text-xs text-white rounded-xl px-2.5 outline-none font-semibold focus:border-gray-500 transition-colors cursor-pointer"
            disabled={chartType === 'histogram' || chartType === 'scatter'}
          >
            <option value="sum">Sum</option>
            <option value="avg">Average</option>
            <option value="count">Count Rows</option>
            <option value="none">None (Raw Rows)</option>
          </select>
        </div>

        {/* Group By Selector */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider font-mono">Group By</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="w-full max-w-full min-w-0 h-9 bg-[#050810]/80 border border-[#1F2937] text-xs text-white rounded-xl px-2.5 outline-none font-semibold focus:border-gray-500 transition-colors cursor-pointer"
            disabled={chartType === 'histogram' || chartType === 'scatter' || chartType === 'pie'}
          >
            <option value="">-- None --</option>
            {categoryHeaders.filter(h => h !== xField).map(h => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Configuration Selector */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider font-mono">Sort Options</label>
          <div className="flex gap-1.5 min-w-0 max-w-full w-full">
            <select
              value={sortConfig?.key || ''}
              onChange={(e) => {
                const key = e.target.value;
                if (!key) setSortConfig(null);
                else setSortConfig({ key, direction: sortConfig?.direction || 'desc' });
              }}
              className="flex-1 min-w-0 max-w-full w-full h-9 bg-[#050810]/80 border border-[#1F2937] text-xs text-white rounded-xl px-2 outline-none font-semibold focus:border-gray-500 transition-colors cursor-pointer"
            >
              <option value="">-- Unsorted --</option>
              <option value="x">X Axis Value</option>
              <option value="y">Y Axis Value</option>
            </select>
            <button
              onClick={() => {
                if (sortConfig) {
                  setSortConfig({
                    ...sortConfig,
                    direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
                  });
                }
              }}
              disabled={!sortConfig}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-900 border border-[#1F2937] hover:border-gray-500 disabled:opacity-40 transition-colors text-white cursor-pointer shrink-0"
              title="Toggle Sort Direction"
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic filters block */}
      {Object.keys(filterOptions).length > 0 && (
        <div className="border-t border-[#1F2937]/20 pt-4 space-y-3.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-[#8B5CF6]" />
              Dataset Filters
            </span>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-[9px] text-red-400 hover:text-red-300 font-extrabold flex items-center gap-1 transition-colors cursor-pointer bg-transparent border-none"
              >
                <X className="h-3 w-3" />
                Clear Filters
              </button>
            )}
          </div>
          
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 select-none font-sans">
            {Object.keys(filterOptions).map(col => (
              <div key={col} className="flex flex-col gap-1 min-w-0">
                <label className="text-[9px] text-gray-400 truncate" title={col}>{col}</label>
                <select
                  value={filters[col] || ''}
                  onChange={(e) => handleFilterChange(col, e.target.value)}
                  className="w-full max-w-full min-w-0 h-8.5 bg-[#050810]/60 border border-[#1F2937]/50 rounded-xl px-2.5 text-xs text-gray-300 outline-none hover:border-gray-600 transition-colors cursor-pointer"
                >
                  <option value="">All</option>
                  {filterOptions[col].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
