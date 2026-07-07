import React from 'react';

/**
 * Calculates aggregate values dynamically for a KPI widget.
 */
const calculateKpiValue = (kpi, data = []) => {
  if (!data || data.length === 0) return '-';
  const colName = kpi.sourceColumns?.[0];
  if (!colName) return '-';

  const cleanNumber = (val) => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  if (kpi.aggregation === 'count') {
    return data.length.toLocaleString();
  }

  if (kpi.aggregation === 'sum') {
    const sum = data.reduce((acc, row) => acc + cleanNumber(row[colName]), 0);
    return typeof data[0]?.[colName] === 'string' && data[0]?.[colName].includes('$')
      ? `$${sum.toLocaleString()}`
      : sum.toLocaleString();
  }

  if (kpi.aggregation === 'avg') {
    const sum = data.reduce((acc, row) => acc + cleanNumber(row[colName]), 0);
    const avg = sum / data.length;
    const formattedAvg = Math.round(avg * 100) / 100;
    return typeof data[0]?.[colName] === 'string' && data[0]?.[colName].includes('$')
      ? `$${formattedAvg.toLocaleString()}`
      : formattedAvg.toLocaleString();
  }

  return '-';
};

/**
 * Driven entirely by layout config gridPosition and KPI attributes.
 */
export default function KpiCard({ kpi, data, gridPosition }) {
  if (!kpi) return null;

  const val = calculateKpiValue(kpi, data);
  const isPrimary = kpi.priority === 'primary';

  const style = (gridPosition.x === -1 || gridPosition.y === -1)
    ? {
        gridColumn: `span ${gridPosition.w}`,
        gridRow: `span ${gridPosition.h}`
      }
    : {
        gridColumn: `${gridPosition.x + 1} / span ${gridPosition.w}`,
        gridRow: `${gridPosition.y + 1} / span ${gridPosition.h}`
      };

  return (
    <div
      style={style}
      className={`rounded-2xl border p-5 flex flex-col justify-between backdrop-blur-md transition-all duration-300 hover:shadow-lg hover:scale-[1.01] ${
        isPrimary
          ? 'bg-gradient-to-br from-[#1F1936] to-[#0D0B1F] border-[#8B5CF6]/30 shadow-[#8B5CF6]/5 shadow-md'
          : 'bg-[#111827]/40 border-[#1F2937]/80'
      }`}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400/90 font-mono">
            {kpi.aggregation} • {kpi.priority}
          </span>
          <span className="text-xs">📈</span>
        </div>
        <h4 className="text-xs font-semibold text-gray-400 mt-2 truncate" title={kpi.name}>
          {kpi.name}
        </h4>
        <p className="text-2xl font-bold text-white mt-1.5 tracking-tight font-display">
          {val}
        </p>
      </div>
      <p className="text-[10px] text-gray-500 mt-3 line-clamp-2 leading-relaxed" title={kpi.description}>
        {kpi.description}
      </p>
    </div>
  );
}
