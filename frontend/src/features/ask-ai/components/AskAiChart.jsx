import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#14B8A6'];

export function AskAiChart({ chartConfig }) {
  if (!chartConfig || !chartConfig.data || chartConfig.data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center border border-dashed border-slate-200 dark:border-[#1F2937] rounded-xl text-slate-400 dark:text-gray-500 text-xs font-mono">
        No chart visualization data available.
      </div>
    );
  }

  const { type = 'bar', xKey = 'x', yKey = 'y', data = [] } = chartConfig;

  // Custom Tooltip formatter
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] px-3 py-2 rounded-xl shadow-2xl text-xs font-sans">
          <p className="font-bold text-slate-800 dark:text-gray-200">{`${label || payload[0].name}`}</p>
          <p className="text-[#8B5CF6] dark:text-[#c084fc] font-semibold mt-1">
            {`${yKey}: ${typeof payload[0].value === 'number' ? payload[0].value.toLocaleString() : payload[0].value}`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-72 pt-4">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'line' ? (
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
            <XAxis
              dataKey={xKey}
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1F2937' }}
              dy={8}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1F2937' }}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke="#8B5CF6"
              strokeWidth={3}
              dot={{ fill: '#8B5CF6', r: 4, strokeWidth: 2, stroke: '#070B14' }}
              activeDot={{ r: 6, fill: '#c084fc' }}
            />
          </LineChart>
        ) : type === 'pie' ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={50}
              paddingAngle={4}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#070B14" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', color: '#9CA3AF' }} />
          </PieChart>
        ) : (
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
            <XAxis
              dataKey={xKey}
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1F2937' }}
              dy={8}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1F2937' }}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={yKey} fill="#8B5CF6" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
