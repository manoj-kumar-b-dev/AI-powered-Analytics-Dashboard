import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const CHART_COLORS = [
  '#8B5CF6',
  '#3B82F6',
  '#22C55E',
  '#F59E0B',
  '#EF4444',
  '#EC4899'
];

const CustomTooltip = ({ active, payload, label, data }) => {
  if (active && payload && payload.length) {
    const p = payload[0];
    const currentValue = p.value;

    let previousValue = null;
    let growthPercent = 0;
    let trend = "up";

    if (data && Array.isArray(data)) {
      const idx = data.findIndex(
        (item) => item.x === label || item.month === label || item.day === label || item.name === label
      );
      if (idx > 0) {
        previousValue = data[idx - 1].y;
        const diff = currentValue - previousValue;
        growthPercent = previousValue !== 0 ? (diff / previousValue) * 100 : 0;
        trend = diff >= 0 ? "up" : "down";
      }
    }

    return (
      <div className="bg-[#050810]/95 border border-[#1F2937]/80 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md min-w-[160px] select-none text-left">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-[#1F2937]/50 pb-1.5 mb-2 font-display">
          {label}
        </p>
        <div className="space-y-1.5 font-sans">
          <div className="flex justify-between items-center gap-4">
            <span className="text-[10px] text-gray-400">Current</span>
            <span className="text-xs font-bold text-white">
              {typeof currentValue === 'number' ? currentValue.toLocaleString() : currentValue}
            </span>
          </div>
          {previousValue !== null && (
            <>
              <div className="flex justify-between items-center gap-4">
                <span className="text-[10px] text-gray-400">Previous</span>
                <span className="text-[11px] text-gray-500 font-medium">{previousValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center gap-4 border-t border-[#1F2937]/30 pt-1.5 mt-1.5">
                <span className="text-[10px] text-gray-400">Growth</span>
                <span className={`text-[11px] font-bold flex items-center gap-0.5 ${
                  trend === 'up' ? 'text-[#22C55E]' : 'text-[#EF4444]'
                }`}>
                  {trend === 'up' ? '▲' : '▼'} {Math.abs(growthPercent).toFixed(1)}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const AutoChart = ({ chartType, data, xField, yField }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs font-medium gap-2">
        <span>No operational data sets available for {chartType || 'chart'}</span>
      </div>
    );
  }

  const formatXAxis = (tickItem) => {
    if (tickItem && !isNaN(Date.parse(tickItem)) && typeof tickItem === 'string' && tickItem.includes('-')) {
      const date = new Date(tickItem);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return tickItem;
  };

  const formatYAxis = (value) => {
    if (value === undefined || value === null || isNaN(Number(value))) return "";
    const num = Number(value);
    if (num === 0) {
      const isCurrency = !yField || !/count|quantity|age|score|temp|percent/i.test(yField);
      return isCurrency ? "$0" : "0";
    }
    
    const isCurrency = !yField || !/count|quantity|age|score|temp|percent/i.test(yField);
    
    const absValue = Math.abs(num);
    let formatted = "";
    if (absValue >= 1000) {
      const kValue = absValue / 1000;
      const formattedK = kValue % 1 === 0 ? kValue : kValue.toFixed(1);
      formatted = `${formattedK}K`;
    } else {
      formatted = absValue.toLocaleString();
    }
    
    const sign = num < 0 ? "-" : "";
    return isCurrency ? `${sign}$${formatted}` : `${sign}${formatted}`;
  };

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorY" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
            <XAxis
              dataKey="x"
              stroke="#4B5563"
              tickFormatter={formatXAxis}
              style={{ fontSize: '10px', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="#4B5563"
              style={{ fontSize: '10px', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={55}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip data={data} />} cursor={{ stroke: 'rgba(139, 92, 246, 0.15)', strokeWidth: 1.5 }} />
            <Area
              type="monotone"
              dataKey="y"
              name={yField}
              stroke="#8B5CF6"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorY)"
              activeDot={{ r: 5, fill: '#8B5CF6', stroke: '#070B14', strokeWidth: 2, className: 'pulse-indicator' }}
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={1} />
                <stop offset="100%" stopColor="#6366F1" stopOpacity={0.65} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
            <XAxis
              dataKey="x"
              stroke="#4B5563"
              tickFormatter={formatXAxis}
              style={{ fontSize: '10px', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="#4B5563"
              style={{ fontSize: '10px', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={55}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip data={data} />} cursor={{ fill: 'rgba(255, 255, 255, 0.01)' }} />
            <Bar
              dataKey="y"
              name={yField === '_count' ? 'Count' : yField}
              fill="url(#barGradient)"
              radius={[5, 5, 0, 0]}
              maxBarSize={32}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === data.length - 1 ? 'url(#barGradient)' : 'rgba(139, 92, 246, 0.45)'}
                  className="hover:opacity-100 opacity-85 transition-opacity"
                />
              ))}
            </Bar>
          </BarChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Tooltip content={<CustomTooltip data={data} />} />
            <Legend
              layout="horizontal"
              align="center"
              verticalAlign="bottom"
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: '9px', fontFamily: 'var(--font-sans)', fontWeight: 600, color: '#9CA3AF', paddingTop: '10px' }}
            />
            <Pie
              data={data}
              dataKey="y"
              nameKey="x"
              cx="50%"
              cy="40%"
              outerRadius="70%"
              innerRadius="48%"
              paddingAngle={3}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={false}
              style={{ fontSize: '9px', fontWeight: 600, fill: '#D1D5DB', fontFamily: 'var(--font-sans)' }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  stroke="#070B14"
                  strokeWidth={1.5}
                />
              ))}
            </Pie>
          </PieChart>
        );

      case 'scatter':
        return (
          <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.02)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={xField}
              stroke="#4B5563"
              style={{ fontSize: '10px', fontFamily: 'var(--font-sans)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yField}
              stroke="#4B5563"
              style={{ fontSize: '10px', fontFamily: 'var(--font-sans)' }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={55}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip data={data} />} />
            <Scatter name={`${xField} vs ${yField}`} data={data} fill="#8B5CF6" />
          </ScatterChart>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-xs text-gray-500">
            Unsupported chart layout
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full min-h-[220px] min-w-0 max-w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};
