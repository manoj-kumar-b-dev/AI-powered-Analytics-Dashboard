import React from "react";
import {
  Database,
  AlertTriangle,
  Save,
  TrendingUp,
  Users,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from "lucide-react";

// Local resolve KPI Icon helper:
function resolveKpiIcon(kpi) {
  switch (kpi) {
    case "revenue":
      return TrendingUp;
    case "sales":
      return TrendingUp;
    case "customers":
      return Users;
    case "expenses":
      return Coins;
    case "profit":
      return Coins;
    default:
      return Activity;
  }
}

// Local KpiCard component
function KpiCard({ card }) {
  const { kpi, label, formattedValue, deltaPct, deltaDirection, period } = card;
  const isUp = deltaDirection === "up";
  const isDown = deltaDirection === "down";
  const IconComponent = resolveKpiIcon(kpi);
  const displayVal = (() => {
    const rawNum = typeof card.value === 'number' ? card.value : parseFloat(String(formattedValue).replace(/[^0-9.-]/g, ''));
    if (!isNaN(rawNum) && Math.abs(rawNum) >= 10000000) {
      const crVal = rawNum / 10000000;
      return `${crVal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Cr`;
    }
    return typeof formattedValue === 'string' ? formattedValue.replace(/[₹\$]/g, '').trim() : formattedValue;
  })();

  return (
    <div className="relative overflow-hidden p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-[#1F2937]/70 bg-white dark:bg-gradient-to-b dark:from-[#0A0E1A] dark:to-[#070B14] hover:border-[#8B5CF6]/40 transition-all duration-200 shadow-sm hover:shadow-purple-500/10 flex flex-col justify-between group min-w-[210px] select-text">
      {/* Glow top border line on hover */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#8B5CF6]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex flex-col text-left min-w-0 flex-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider font-mono truncate" title={label}>
            {label}
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1.5 font-display tracking-tight" title={displayVal}>
            {displayVal}
          </h3>
        </div>
        <div className="h-9.5 w-9.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[#8B5CF6] dark:text-[#c084fc] flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-[#8B5CF6]/20 transition-all">
          <IconComponent className="h-4.5 w-4.5" />
        </div>
      </div>

      {(deltaPct !== null && deltaPct !== undefined || (deltaDirection && deltaDirection !== "flat")) && (
        <div className="flex items-center gap-2 mt-4 text-[10px] font-semibold pt-2.5 border-t border-slate-200 dark:border-[#1F2937]/30">
          {isUp && (
            <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              <ArrowUpRight className="h-3 w-3" />
              +{deltaPct}%
            </span>
          )}
          {isDown && (
            <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
              <ArrowDownRight className="h-3 w-3" />
              {deltaPct}%
            </span>
          )}
          {deltaDirection === "flat" && (
            <span className="text-slate-400 dark:text-gray-400">Stable</span>
          )}
          {period && <span className="text-slate-400 dark:text-gray-500 text-[9px] truncate">{period}</span>}
        </div>
      )}
    </div>
  );
}

// Local KpiCardRow component
function KpiCardRow({ kpis }) {
  if (!kpis || kpis.length === 0) return null;
  return (
    <div className="grid gap-4.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 w-full">
      {kpis.map((kpi, idx) => (
        <KpiCard key={`${kpi.kpi}-${idx}`} card={kpi} />
      ))}
    </div>
  );
}

export function DatabasePreviewPanel({
  dsPreview,
  confirmDataSource,
  deleteDataSource,
  kpiData = [],
  KPI_SYNONYMS = {},
  mappingInput = {},
  handleKpiMappingChange,
  saveKpiMappings,
  suggestedCharts = []
}) {
  if (!dsPreview) return null;

  const { dataSource, previewRows = [] } = dsPreview;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header Info */}
      <div className="p-4 border-b border-slate-200 dark:border-[#1F2937]/40 flex flex-wrap gap-4 justify-between items-center bg-slate-50/80 dark:bg-slate-950/25 text-left transition-colors duration-300">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate max-w-md">
            <Database className="h-4 w-4 text-[#8B5CF6]" />
            Active Dataset: {dataSource.fileName}
          </h4>
          <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 font-mono">
            {dataSource.rowCount} rows • Columns: {dataSource.schema.length} • Status:{" "}
            <strong className={dataSource.status === "confirmed" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
              {dataSource.status}
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {dataSource.status === "preview" && (
            <button
              onClick={() => confirmDataSource(dataSource._id)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all border-none cursor-pointer shadow-sm"
            >
              Confirm Dataset
            </button>
          )}
          <button
            onClick={() => deleteDataSource(dataSource._id)}
            className="px-3.5 py-1.5 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Delete Dataset
          </button>
        </div>
      </div>

      {/* Preview Details Scroll Pane */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar min-w-0 max-w-full overflow-x-hidden text-left">

        {/* Validation Alert */}
        {dataSource.validation && dataSource.validation.problemCount > 0 && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs space-y-1.5 select-text">
            <div className="flex gap-2 items-center font-bold">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />
              <span>Data Validation Warnings: {dataSource.validation.problemCount} cell value issues</span>
            </div>
            <p className="text-slate-600 dark:text-gray-400 text-[11px]">
              We detected mismatches between value representations and database types during file parsing. Adjust column KPI mappings below if required.
            </p>
          </div>
        )}

        {/* Live computed KPIs */}
        {kpiData.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider font-mono">
              Computed KPI summary values
            </h4>
            <KpiCardRow kpis={kpiData} />
          </div>
        )}

        {/* Column Overrides Mapping panel */}
        <div className="p-4 bg-white dark:bg-[#0A0E1A]/40 border border-slate-200 dark:border-[#1F2937] rounded-xl space-y-4 shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono border-b border-slate-200 dark:border-[#1F2937]/30 pb-2">
            KPI Column Overrides Synonyms
          </h4>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {Object.keys(KPI_SYNONYMS).map((kpiKey) => (
              <div key={kpiKey} className="flex flex-col gap-1.5 select-none min-w-0">
                <label className="text-[10px] text-slate-500 dark:text-gray-400 font-bold uppercase font-mono tracking-wide">{kpiKey}</label>
                <select
                  value={mappingInput[kpiKey] || ""}
                  onChange={(e) => handleKpiMappingChange(kpiKey, e.target.value)}
                  className="h-9 bg-slate-50 dark:bg-[#050810]/80 border border-slate-200 dark:border-[#1F2937] text-xs text-slate-800 dark:text-white rounded-xl px-2.5 outline-none font-semibold focus:border-purple-500 transition-colors w-full max-w-full min-w-0"
                >
                  <option value="none" className="bg-white dark:bg-[#111827] text-slate-800 dark:text-white">-- Unmapped / Auto --</option>
                  {dataSource.schema.map((c) => (
                    <option key={c.column} value={c.column} className="bg-white dark:bg-[#111827] text-slate-800 dark:text-white">
                      {c.column} ({c.detectedType || c.type})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-[#1F2937]/20">
            <button
              onClick={saveKpiMappings}
              className="px-4 py-2 rounded-xl bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 border border-[#8B5CF6]/35 text-[#8B5CF6] dark:text-[#c084fc] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Save className="h-4 w-4" />
              Save Column Overrides
            </button>
          </div>
        </div>

        {/* Recommendations listings */}
        {suggestedCharts.length > 0 && (
          <div className="space-y-2 select-text">
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider font-mono">
              Automated Chart Recommendations
            </h4>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {suggestedCharts.map((suggested, index) => (
                <div
                  key={index}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-[#1F2937] bg-white dark:bg-slate-900/10 hover:border-purple-300 dark:hover:border-gray-700 transition-all flex flex-col justify-between gap-3 relative group overflow-hidden shadow-sm"
                >
                  <div className="space-y-1.5 font-semibold">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-[#8B5CF6]/15 text-[#8B5CF6] dark:text-[#c084fc] border border-[#8B5CF6]/35">
                        {suggested.chartType} chart
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-gray-300 text-xs font-medium leading-normal">{suggested.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MongoDB sample rows preview */}
        <div className="bg-white dark:bg-[#0A0E1A] border border-slate-200 dark:border-[#1F2937]/50 rounded-xl overflow-x-hidden flex flex-col min-w-0 max-w-full shadow-sm">
          <div className="p-3.5 border-b border-slate-200 dark:border-[#1F2937]/30 bg-slate-50 dark:bg-slate-950/20">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              Staged Sample Data (First 50 rows)
            </span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-w-full w-full max-h-[300px] custom-scrollbar">
            <table className="w-full text-left border-collapse select-text">
              <thead className="bg-slate-100/95 dark:bg-[#050810]/95 sticky top-0 z-10 border-b border-slate-200 dark:border-[#1F2937]/60">
                <tr>
                  {dataSource.schema.map((col) => (
                    <th
                      key={col.column}
                      className="p-2.5 text-[10px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider border-r border-slate-200 dark:border-[#1F2937]/30 whitespace-nowrap min-w-[120px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{col.column}</span>
                        <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-purple-500/15 dark:bg-purple-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-300 font-mono">
                          {col.detectedType || col.type}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1F2937]/30 font-mono text-[11px]">
                {previewRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                    {dataSource.schema.map((col) => (
                      <td key={col.column} className="p-2.5 border-r border-slate-100 dark:border-[#1F2937]/20 truncate text-slate-800 dark:text-gray-300">
                        {row[col.column] !== null && row[col.column] !== undefined ? row[col.column].toString() : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
