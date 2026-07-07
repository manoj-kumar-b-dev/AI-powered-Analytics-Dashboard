import React from "react";
import { Filter, FilterX } from "lucide-react";

export function DashboardFilters({
  filters,
  dashboard,
  isAnyFilterActive,
  onFilterChange,
  onClearFilters
}) {
  return (
    <div className="bg-[#111827]/25 border border-[#1F2937]/40 p-4 rounded-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-[#1F2937]/30 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-[#8B5CF6]" />
          <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
            Operational Filters
          </span>
        </div>
        {isAnyFilterActive && (
          <button
            onClick={onClearFilters}
            className="text-[10px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 transition-colors cursor-pointer bg-transparent border-none"
          >
            <FilterX className="h-3.5 w-3.5" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Date Filter */}
        <div className="flex flex-col gap-1 text-left">
          <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Date</label>
          <select
            value={filters.date || ""}
            onChange={(e) => onFilterChange("date", e.target.value)}
            className="h-8.5 bg-[#050810]/60 border border-[#1F2937]/50 rounded-xl px-2.5 text-xs text-gray-300 outline-none hover:border-gray-600 transition-colors w-full max-w-full min-w-0"
          >
            <option value="">All Time</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>

        {/* Dynamic Filters from Backend */}
        {Object.keys(dashboard?.filters || {}).map((filterKey) => {
          const options = dashboard.filters[filterKey];
          return (
            <div key={filterKey} className="flex flex-col gap-1 text-left">
              <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{filterKey}</label>
              <select
                value={filters[filterKey] || ""}
                onChange={(e) => onFilterChange(filterKey, e.target.value)}
                className="h-8.5 bg-[#050810]/60 border border-[#1F2937]/50 rounded-xl px-2.5 text-xs text-gray-300 outline-none hover:border-gray-600 transition-colors w-full max-w-full min-w-0"
              >
                <option value="">All {filterKey}s</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
