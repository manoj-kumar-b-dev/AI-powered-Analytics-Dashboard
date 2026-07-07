import React, { useMemo } from 'react';
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
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const CHART_COLORS = [
  '#8B5CF6', // Purple (Primary Highlight)
  '#3B82F6', // Blue (Info)
  '#10B981', // Emerald (Success)
  '#F59E0B', // Amber (Warning)
  '#EF4444', // Red (Critical)
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

// Redesigned premium custom tooltip with dynamic previous-index comparison and growth indicators
const CustomTooltip = ({ active, payload, label, data }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#050810]/95 border border-[#1F2937]/80 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md min-w-[160px] select-none text-left">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-[#1F2937]/50 pb-1.5 mb-2 font-display">
          {label}
        </p>
        <div className="space-y-1.5 font-sans">
          {payload.map((item, index) => (
            <div key={index} className="flex justify-between items-center gap-4">
              <span className="text-[10px] flex items-center gap-1.5" style={{ color: item.color || '#9CA3AF' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color || '#9CA3AF' }} />
                {item.name === 'y' ? 'Value' : item.name}
              </span>
              <span className="text-xs font-bold text-white">
                {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const ChartRenderer = ({ chartType, data, rawRows, xField, yField, groupBy }) => {
  
  // Format X Axis Values
  const formatXAxis = (tickItem) => {
    if (tickItem && !isNaN(Date.parse(tickItem)) && typeof tickItem === 'string' && tickItem.includes('-')) {
      const date = new Date(tickItem);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return tickItem;
  };

  // Format Y Axis Values
  const formatYAxis = (value) => {
    if (value === undefined || value === null || isNaN(Number(value))) return "";
    const num = Number(value);
    if (num === 0) return "0";
    
    const absValue = Math.abs(num);
    let formatted = "";
    if (absValue >= 1000000) {
      formatted = `${(absValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      formatted = `${(absValue / 1000).toFixed(1)}K`;
    } else {
      formatted = absValue.toLocaleString();
    }
    
    const sign = num < 0 ? "-" : "";
    const isCurrency = yField && /revenue|sales_amount|amount|income|expenses|profit|cost/i.test(yField);
    return isCurrency ? `${sign}$${formatted}` : `${sign}${formatted}`;
  };

  // Calculate histogram bins dynamically if histogram selected
  const histogramData = useMemo(() => {
    if (chartType !== 'histogram' || !rawRows || rawRows.length === 0 || !xField) return [];

    const vals = rawRows
      .map(r => {
        const rawVal = r[xField];
        if (rawVal === null || rawVal === undefined) return null;
        const clean = rawVal.toString().replace(/[\$,%\s]/g, '');
        const num = Number(clean);
        return isNaN(num) ? null : num;
      })
      .filter(v => v !== null);

    if (vals.length === 0) return [];

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const binCount = 10;
    const binWidth = (max - min) / binCount || 1;

    const bins = Array.from({ length: binCount }, (_, i) => {
      const start = min + i * binWidth;
      const end = start + binWidth;
      return {
        binStart: start,
        binEnd: end,
        label: `${start.toFixed(0)}-${end.toFixed(0)}`,
        count: 0
      };
    });

    vals.forEach(val => {
      let binIdx = Math.floor((val - min) / binWidth);
      if (binIdx >= binCount) binIdx = binCount - 1;
      if (binIdx >= 0 && binIdx < binCount) {
        bins[binIdx].count += 1;
      }
    });

    return bins.map(b => ({
      x: b.label,
      y: b.count
    }));
  }, [chartType, rawRows, xField]);

  const activeData = chartType === 'histogram' ? histogramData : data;

  if (!activeData || activeData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[260px] text-gray-500 text-xs font-medium gap-2">
        <span>No suitable chart data available.</span>
      </div>
    );
  }

  // Get active keys for grouped multi-series rendering (excluding standard metadata x, y, _count)
  const seriesKeys = useMemo(() => {
    if (!groupBy || activeData.length === 0) return [];
    const keys = Object.keys(activeData[0]);
    return keys.filter(k => k !== 'x' && k !== 'y' && k !== '_count');
  }, [groupBy, activeData]);

  const renderChart = () => {
    switch (chartType) {
      case 'area':
        return (
          <AreaChart data={activeData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAreaY" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.015)" vertical={false} />
            <XAxis
              dataKey="x"
              stroke="#4B5563"
              tickFormatter={formatXAxis}
              style={{ fontSize: '10px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="#4B5563"
              style={{ fontSize: '10px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={55}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip data={activeData} />} cursor={{ stroke: 'rgba(139, 92, 246, 0.15)', strokeWidth: 1.5 }} />
            <Area
              type="monotone"
              dataKey="y"
              name={yField === '_count' ? 'Count' : yField}
              stroke="#8B5CF6"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorAreaY)"
              activeDot={{ r: 5, fill: '#8B5CF6', stroke: '#070B14', strokeWidth: 2 }}
            />
          </AreaChart>
        );

      case 'line':
        return (
          <LineChart data={activeData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.015)" vertical={false} />
            <XAxis
              dataKey="x"
              stroke="#4B5563"
              tickFormatter={formatXAxis}
              style={{ fontSize: '10px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="#4B5563"
              style={{ fontSize: '10px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={55}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip data={activeData} />} cursor={{ stroke: 'rgba(255, 255, 255, 0.05)', strokeWidth: 1 }} />
            <Legend
              layout="horizontal"
              align="center"
              verticalAlign="top"
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: '9px', fontWeight: 600, color: '#9CA3AF', paddingBottom: '10px' }}
            />
            {seriesKeys.length > 0 ? (
              seriesKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              ))
            ) : (
              <Line
                type="monotone"
                dataKey="y"
                name={yField === '_count' ? 'Count' : yField}
                stroke="#8B5CF6"
                strokeWidth={2.5}
                activeDot={{ r: 5, fill: '#8B5CF6', stroke: '#070B14', strokeWidth: 2 }}
              />
            )}
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart data={activeData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradientColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={1} />
                <stop offset="100%" stopColor="#6366F1" stopOpacity={0.65} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.015)" vertical={false} />
            <XAxis
              dataKey="x"
              stroke="#4B5563"
              tickFormatter={formatXAxis}
              style={{ fontSize: '10px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="#4B5563"
              style={{ fontSize: '10px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={55}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip data={activeData} />} cursor={{ fill: 'rgba(255, 255, 255, 0.01)' }} />
            <Legend
              layout="horizontal"
              align="center"
              verticalAlign="top"
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: '9px', fontWeight: 600, color: '#9CA3AF', paddingBottom: '10px' }}
            />
            {seriesKeys.length > 0 ? (
              seriesKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={30}
                />
              ))
            ) : (
              <Bar
                dataKey="y"
                name={yField === '_count' ? 'Count' : yField}
                fill="url(#barGradientColor)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              >
                {activeData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === activeData.length - 1 ? 'url(#barGradientColor)' : 'rgba(139, 92, 246, 0.55)'}
                    className="hover:opacity-100 opacity-85 transition-opacity"
                  />
                ))}
              </Bar>
            )}
          </BarChart>
        );

      case 'horizontal-bar':
        return (
          <BarChart data={activeData} layout="vertical" margin={{ top: 10, right: 15, left: 35, bottom: 0 }}>
            <defs>
              <linearGradient id="hbarGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.015)" horizontal={false} />
            <XAxis
              type="number"
              stroke="#4B5563"
              style={{ fontSize: '10px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
            />
            <YAxis
              type="category"
              dataKey="x"
              stroke="#4B5563"
              style={{ fontSize: '9px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={75}
            />
            <Tooltip content={<CustomTooltip data={activeData} />} cursor={{ fill: 'rgba(255, 255, 255, 0.01)' }} />
            <Legend
              layout="horizontal"
              align="center"
              verticalAlign="top"
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: '9px', fontWeight: 600, color: '#9CA3AF', paddingBottom: '10px' }}
            />
            {seriesKeys.length > 0 ? (
              seriesKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={20}
                />
              ))
            ) : (
              <Bar
                dataKey="y"
                name={yField === '_count' ? 'Count' : yField}
                fill="url(#hbarGradient)"
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
              />
            )}
          </BarChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Tooltip content={<CustomTooltip data={activeData} />} />
            <Legend
              layout="horizontal"
              align="center"
              verticalAlign="bottom"
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: '9px', fontWeight: 600, color: '#9CA3AF', paddingTop: '10px' }}
            />
            <Pie
              data={activeData}
              dataKey="y"
              nameKey="x"
              cx="50%"
              cy="45%"
              outerRadius="72%"
              innerRadius="48%"
              paddingAngle={3}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={false}
              style={{ fontSize: '9px', fontWeight: 600, fill: '#9CA3AF' }}
            >
              {activeData.map((entry, index) => (
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
            <CartesianGrid stroke="rgba(255,255,255,0.015)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={xField}
              stroke="#4B5563"
              style={{ fontSize: '10px' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yField}
              stroke="#4B5563"
              style={{ fontSize: '10px' }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={55}
              tickFormatter={formatYAxis}
            />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip data={activeData} />} />
            <Scatter name={`${xField} vs ${yField}`} data={activeData} fill="#8B5CF6" />
          </ScatterChart>
        );

      case 'composed':
        return (
          <ComposedChart data={activeData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.015)" vertical={false} />
            <XAxis
              dataKey="x"
              stroke="#4B5563"
              tickFormatter={formatXAxis}
              style={{ fontSize: '10px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="#4B5563"
              style={{ fontSize: '10px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={55}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip data={activeData} />} />
            <Legend
              layout="horizontal"
              align="center"
              verticalAlign="top"
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: '9px', fontWeight: 600, color: '#9CA3AF', paddingBottom: '10px' }}
            />
            <Bar dataKey="y" name={yField === '_count' ? 'Count' : yField} fill="rgba(139, 92, 246, 0.4)" radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Line type="monotone" dataKey="y" name="Trend" stroke="#3B82F6" strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        );

      case 'histogram':
        return (
          <BarChart data={activeData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.015)" vertical={false} />
            <XAxis
              dataKey="x"
              stroke="#4B5563"
              style={{ fontSize: '9px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="#4B5563"
              style={{ fontSize: '10px', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={45}
            />
            <Tooltip content={<CustomTooltip data={activeData} />} cursor={{ fill: 'rgba(255,255,255,0.01)' }} />
            <Bar dataKey="y" name="Frequency" fill="url(#histGradient)" radius={[4, 4, 0, 0]} />
          </BarChart>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full min-h-[260px] text-xs text-gray-500">
            Unsupported chart layout
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full min-h-[260px] min-w-0 max-w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};
