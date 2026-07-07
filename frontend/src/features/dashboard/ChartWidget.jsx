import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

const CHART_COMPONENTS = {
  line: LineChart,
  bar: BarChart,
  pie: PieChart,
  area: AreaChart
};

const renderSeries = (type, dataKey, nameKey, data) => {
  if (type === 'line') {
    return <Line type="monotone" dataKey={dataKey} stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6', r: 3 }} activeDot={{ r: 5 }} />;
  }
  if (type === 'bar') {
    return <Bar dataKey={dataKey} fill="#8B5CF6" radius={[4, 4, 0, 0]} />;
  }
  if (type === 'area') {
    return (
      <>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke="#8B5CF6" fillOpacity={1} fill="url(#areaGrad)" />
      </>
    );
  }
  if (type === 'pie') {
    return (
      <Pie
        data={data}
        dataKey={dataKey}
        nameKey={nameKey}
        cx="50%"
        cy="50%"
        outerRadius={60}
        fill="#8B5CF6"
        label={{ fill: '#9CA3AF', fontSize: 9 }}
      />
    );
  }
  return null;
};

/**
 * Generic chart renderer mapping configuration definitions to dynamic Recharts components.
 */
export default function ChartWidget({ chart, data = [], gridPosition }) {
  if (!chart) return null;

  const style = (gridPosition.x === -1 || gridPosition.y === -1)
    ? {
        gridColumn: `span ${gridPosition.w}`,
        gridRow: `span ${gridPosition.h}`
      }
    : {
        gridColumn: `${gridPosition.x + 1} / span ${gridPosition.w}`,
        gridRow: `${gridPosition.y + 1} / span ${gridPosition.h}`
      };

  const isTable = chart.type === 'table';

  const renderTable = () => {
    return (
      <div className="overflow-x-auto w-full flex-1 max-h-[170px] custom-scrollbar mt-3">
        <table className="min-w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-[#1F2937]/50 text-gray-400 font-mono">
              <th className="py-1.5 px-3 uppercase tracking-wider">{chart.xAxis}</th>
              <th className="py-1.5 px-3 uppercase tracking-wider">{chart.yAxis}</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 15).map((row, idx) => (
              <tr key={idx} className="border-b border-[#1F2937]/20 hover:bg-[#1F2937]/10 text-gray-300">
                <td className="py-1.5 px-3 truncate max-w-[120px]" title={row[chart.xAxis]}>
                  {row[chart.xAxis]}
                </td>
                <td className="py-1.5 px-3 text-purple-400 font-mono">{row[chart.yAxis]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const ChartComponent = CHART_COMPONENTS[chart.type];

  // Clean and parse numerical values to prevent rendering issues in Recharts
  const cleanData = data.map(row => {
    const rawYVal = row[chart.yAxis];
    if (typeof rawYVal === 'number') return row;
    if (rawYVal === undefined || rawYVal === null) return { ...row, [chart.yAxis]: 0 };

    const cleanY = parseFloat(rawYVal.toString().replace(/[^0-9.-]/g, ''));
    return {
      ...row,
      [chart.yAxis]: isNaN(cleanY) ? 0 : cleanY
    };
  });

  return (
    <div
      style={style}
      className="bg-[#111827]/40 border border-[#1F2937]/80 rounded-2xl p-5 flex flex-col justify-between backdrop-blur-md transition-all duration-300 hover:shadow-lg overflow-hidden min-w-0"
    >
      <div className="min-w-0">
        <div className="flex items-center justify-between min-w-0">
          <h4 className="text-xs font-bold text-white tracking-wide truncate" title={chart.title}>
            {chart.title}
          </h4>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
            {chart.type}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 mt-1 line-clamp-1 truncate leading-relaxed" title={chart.reason}>
          {chart.reason}
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-0 mt-4 min-w-0">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-500 font-mono">
            No data available
          </div>
        ) : isTable ? (
          renderTable()
        ) : ChartComponent ? (
          <div className="w-full h-full min-h-[160px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ChartComponent data={cleanData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.3} />
                <XAxis
                  dataKey={chart.xAxis}
                  stroke="#9CA3AF"
                  fontSize={8}
                  tickLine={false}
                  axisLine={{ stroke: '#1F2937' }}
                />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={8}
                  tickLine={false}
                  axisLine={{ stroke: '#1F2937' }}
                  tickFormatter={tick => tick.toLocaleString()}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#1F2937',
                    borderRadius: '8px',
                    fontSize: '10px',
                    color: '#FFF'
                  }}
                  itemStyle={{ color: '#A78BFA' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                {renderSeries(chart.type, chart.yAxis, chart.xAxis, cleanData)}
              </ChartComponent>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-red-400 font-mono">
            Unsupported chart configuration
          </div>
        )}
      </div>
    </div>
  );
}
