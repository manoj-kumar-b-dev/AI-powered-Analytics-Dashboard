import React from "react";
import {
  Database,
  AlertTriangle,
  Save,
  DollarSign,
  TrendingUp,
  Users,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from "lucide-react";
import { AutoVisualizationContainer } from "../../analytics/components/AutoVisualizationContainer";

// Local resolve KPI Icon helper:
function resolveKpiIcon(kpi) {
  switch (kpi) {
    case "revenue":
      return DollarSign;
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

  return (
    <div className="p-4 bg-slate-900/40 border border-[#1F2937]/60 rounded-2xl flex flex-col justify-between hover:border-slate-700/80 transition-all select-text">
      <div className="flex justify-between items-start">
        <div className="flex flex-col text-left">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
            {label}
          </span>
          <h3 className="text-xl font-extrabold text-white mt-1.5 font-display">
            {formattedValue}
          </h3>
        </div>
        <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[#c084fc] flex items-center justify-center shrink-0">
          <IconComponent className="h-4.5 w-4.5" />
        </div>
      </div>
      
      {(deltaPct !== null || deltaDirection !== "flat") && (
        <div className="flex items-center gap-2 mt-3.5 text-[10px] font-semibold">
          {isUp && (
            <span className="inline-flex items-center gap-0.5 text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
              <ArrowUpRight className="h-3 w-3" />
              +{deltaPct}%
            </span>
          )}
          {isDown && (
            <span className="inline-flex items-center gap-0.5 text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-md">
              <ArrowDownRight className="h-3 w-3" />
              {deltaPct}%
            </span>
          )}
          {deltaDirection === "flat" && (
            <span className="text-gray-400">Stable</span>
          )}
          <span className="text-gray-500 text-[9px]">{period}</span>
        </div>
      )}
    </div>
  );
}

// Local KpiCardRow component
function KpiCardRow({ kpis }) {
  if (!kpis || kpis.length === 0) return null;
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 w-full">
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
      <div className="p-4 border-b border-[#1F2937]/40 flex flex-wrap gap-4 justify-between items-center bg-slate-950/25 text-left">
        <div>
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5 truncate max-w-md">
            <Database className="h-4 w-4 text-[#8B5CF6]" />
            Active Dataset: {dataSource.fileName}
          </h4>
          <div className="text-[10px] text-gray-400 mt-1 font-mono">
            {dataSource.rowCount} rows • Columns: {dataSource.schema.length} • Status:{" "}
            <strong className={dataSource.status === "confirmed" ? "text-emerald-400" : "text-amber-400"}>
              {dataSource.status}
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {dataSource.status === "preview" && (
            <button
              onClick={() => confirmDataSource(dataSource._id)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all border-none cursor-pointer"
            >
              Confirm Dataset
            </button>
          )}
          <button
            onClick={() => deleteDataSource(dataSource._id)}
            className="px-3.5 py-1.5 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 text-rose-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Delete Dataset
          </button>
        </div>
      </div>

      {/* Preview Details Scroll Pane */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar min-w-0 max-w-full overflow-x-hidden text-left">
        
        {/* Validation Alert */}
        {dataSource.validation && dataSource.validation.problemCount > 0 && (
          <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs space-y-1.5 select-text">
            <div className="flex gap-2 items-center font-bold">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-400 shrink-0" />
              <span>Data Validation Warnings: {dataSource.validation.problemCount} cell value issues</span>
            </div>
            <p className="text-gray-400 text-[11px]">
              We detected mismatches between value representations and database types during file parsing. Adjust column KPI mappings below if required.
            </p>
          </div>
        )}

        {/* Live computed KPIs */}
        {kpiData.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
              Computed KPI summary values
            </h4>
            <KpiCardRow kpis={kpiData} />
          </div>
        )}

        {/* Column Overrides Mapping panel */}
        <div className="p-4 bg-[#0A0E1A]/40 border border-[#1F2937] rounded-xl space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono border-b border-[#1F2937]/30 pb-2">
            KPI Column Overrides Synonyms
          </h4>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {Object.keys(KPI_SYNONYMS).map((kpiKey) => (
              <div key={kpiKey} className="flex flex-col gap-1.5 select-none min-w-0">
                <label className="text-[10px] text-gray-400 font-bold uppercase font-mono tracking-wide">{kpiKey}</label>
                <select
                  value={mappingInput[kpiKey] || ""}
                  onChange={(e) => handleKpiMappingChange(kpiKey, e.target.value)}
                  className="h-9 bg-[#050810]/80 border border-[#1F2937] text-xs text-white rounded-xl px-2.5 outline-none font-semibold focus:border-gray-500 transition-colors w-full max-w-full min-w-0"
                >
                  <option value="none">-- Unmapped / Auto --</option>
                  {dataSource.schema.map((c) => (
                    <option key={c.column} value={c.column}>
                      {c.column} ({c.detectedType || c.type})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2 border-t border-[#1F2937]/20">
            <button
              onClick={saveKpiMappings}
              className="px-4 py-2 rounded-xl bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 border border-[#8B5CF6]/35 text-[#c084fc] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Save className="h-4 w-4" />
              Save Column Overrides
            </button>
          </div>
        </div>

        {/* Automated charts previews */}
        <div className="mb-2">
          <AutoVisualizationContainer
            dsId={dataSource._id}
            initialHeaders={dataSource.schema.map((c) => c.column)}
          />
        </div>

        {/* Recommendations listings */}
        {suggestedCharts.length > 0 && (
          <div className="space-y-2 select-text">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
              Automated Chart Recommendations
            </h4>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {suggestedCharts.map((suggested, index) => (
                <div
                  key={index}
                  className="p-3.5 rounded-xl border border-[#1F2937] bg-slate-900/10 hover:border-gray-700 transition-all flex flex-col justify-between gap-3 relative group overflow-hidden"
                >
                  <div className="space-y-1.5 font-semibold">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-[#8B5CF6]/15 text-[#c084fc] border border-[#8B5CF6]/35">
                        {suggested.chartType} chart
                      </span>
                    </div>
                    <p className="text-gray-300 text-xs font-medium leading-normal">{suggested.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MongoDB sample rows preview */}
        <div className="bg-[#0A0E1A] border border-[#1F2937]/50 rounded-xl overflow-x-hidden flex flex-col min-w-0 max-w-full">
          <div className="p-3.5 border-b border-[#1F2937]/30 bg-slate-950/20">
            <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Staged Sample Data (First 50 rows)
            </span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-w-full w-full max-h-[300px] custom-scrollbar">
            <table className="w-full text-left border-collapse select-text">
              <thead className="bg-[#050810]/95 sticky top-0 z-10 border-b border-[#1F2937]/60">
                <tr>
                  {dataSource.schema.map((col) => (
                    <th
                      key={col.column}
                      className="p-2.5 text-[10px] font-bold text-gray-300 uppercase tracking-wider border-r border-[#1F2937]/30 whitespace-nowrap min-w-[120px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{col.column}</span>
                        <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/35 text-purple-300 font-mono">
                          {col.detectedType || col.type}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937]/30 font-mono text-[11px]">
                {previewRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-900/20 transition-colors">
                    {dataSource.schema.map((col) => (
                      <td key={col.column} className="p-2.5 border-r border-[#1F2937]/20 truncate text-gray-300">
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
