import React, { useState, useRef } from 'react';
import { useAuth } from '../../authentication/contexts/AuthContext';
import { useAutoVisualization } from '../hooks/useAutoVisualization';
import { ChartRenderer } from './ChartRenderer';
import { ChartControls } from './ChartControls';
import { ChartInsights } from './ChartInsights';
import {
  Download,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  BarChart2
} from 'lucide-react';

export const AutoVisualizationContainer = ({ initialRows = [], initialHeaders = [], dsId = null }) => {
  const { apiRequest } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartRef = useRef(null);

  const {
    isLoading,
    error,
    rawRows,
    headers,
    detectedTypes,
    recommendation,
    
    // Customization states
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
    
    // Calculated aggregates
    aggregatedData,
    insights,
    resetToRecommendation
  } = useAutoVisualization({ initialRows, initialHeaders, dsId, apiRequest });

  // Native PNG download from SVG
  const downloadPng = () => {
    if (!chartRef.current) return;
    const svgElement = chartRef.current.querySelector('svg');
    if (!svgElement) {
      alert('Could not locate SVG elements to export.');
      return;
    }

    try {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);
      const image = new Image();
      
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = svgElement.clientWidth || 800;
        canvas.height = svgElement.clientHeight || 450;
        const context = canvas.getContext('2d');
        
        // Draw elegant dark gradient background matching dashboard
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#070B14');
        gradient.addColorStop(1, '#0D1527');
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.drawImage(image, 0, 0);
        const png = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = png;
        downloadLink.download = `automatic_chart_${dsId || 'upload'}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    } catch (err) {
      console.error('PNG conversion failed:', err);
      alert('Failed to export chart image. Try running in modern browser.');
    }
  };

  // CSV download for aggregated items
  const exportCsv = () => {
    if (!aggregatedData || aggregatedData.length === 0) return;
    
    let csvContent = 'X Axis Value (Dimension),Y Axis Value (Metric),Raw Row Count\r\n';
    aggregatedData.forEach(item => {
      const xVal = `"${(item.x || '').toString().replace(/"/g, '""')}"`;
      const yVal = `"${(item.y || 0).toString().replace(/"/g, '""')}"`;
      const countVal = `"${(item._count || 0).toString().replace(/"/g, '""')}"`;
      csvContent += `${xVal},${yVal},${countVal}\r\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `aggregated_chart_${dsId || 'upload'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="h-60 rounded-2xl border border-[#1F2937]/40 bg-slate-950/20 backdrop-blur-md flex flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 text-[#8B5CF6] animate-spin" />
        <span className="text-xs text-gray-400 font-medium">Analyzing dataset variables...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs flex gap-2.5 items-start">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (chartType === 'none') {
    return (
      <div className="p-10 rounded-2xl border border-dashed border-[#1F2937] bg-slate-950/20 backdrop-blur-md flex flex-col items-center justify-center text-center gap-3 select-none">
        <BarChart2 className="h-10 w-10 text-gray-600 opacity-50 animate-pulse" />
        <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">No suitable visualization found</h4>
        <p className="text-xs text-gray-400 max-w-sm">
          We analyzed the column types but couldn't auto-generate a layout. Consider mapping Date or Category columns along with Numeric metrics.
        </p>
      </div>
    );
  }

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-50 bg-[#070B14] p-8 overflow-y-auto overflow-x-hidden max-w-full flex flex-col gap-6 scrollbar-hide'
    : 'w-full flex flex-col gap-6 min-w-0 max-w-full';

  return (
    <div className={containerClasses}>
      
      {/* AI Recommendation Banner Header */}
      <div className="bg-gradient-to-r from-[#8B5CF6]/10 to-[#6366F1]/10 border border-[#8B5CF6]/20 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between backdrop-blur-md">
        <div className="flex gap-3.5 items-start">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center shrink-0 mt-0.5 select-none">
            <Sparkles className="h-5 w-5 text-purple-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white font-display">Automated Smart Visualization</h3>
              <span className="text-[9px] font-extrabold uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-400">
                Recommended: {recommendation.chartType} ({recommendation.confidence}% Confidence)
              </span>
            </div>
            <p className="text-xs text-gray-300 leading-normal">{recommendation.reason}</p>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2 select-none self-end md:self-auto">
          <button
            onClick={exportCsv}
            className="h-9 px-3.5 rounded-xl border border-[#1F2937] hover:border-gray-500 bg-slate-900/30 hover:bg-slate-900 transition-all text-xs font-semibold text-gray-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
            title="Export Aggregated Data to CSV"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
          
          <button
            onClick={downloadPng}
            className="h-9 px-3.5 rounded-xl border border-[#1F2937] hover:border-gray-500 bg-slate-900/30 hover:bg-slate-900 transition-all text-xs font-semibold text-gray-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
            title="Download Chart Image PNG"
          >
            <Download className="h-4 w-4" />
            <span>Download PNG</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-900 border border-[#1F2937] hover:border-gray-500 transition-colors text-white cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Chart View'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main visualization grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0 max-w-full">
        
        {/* Customization controls + chart viewer */}
        <div className="lg:col-span-2 space-y-6 flex flex-col min-w-0 max-w-full w-full">
          {/* Custom controls */}
          <ChartControls
            headers={headers}
            detectedTypes={detectedTypes}
            rawRows={rawRows}
            chartType={chartType}
            setChartType={setChartType}
            xField={xField}
            setXField={setXField}
            yField={yField}
            setYField={setYField}
            aggregation={aggregation}
            setAggregation={setAggregation}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            filters={filters}
            handleFilterChange={handleFilterChange}
            handleClearFilters={handleClearFilters}
            sortConfig={sortConfig}
            setSortConfig={setSortConfig}
            resetToRecommendation={resetToRecommendation}
            recommendation={recommendation}
          />

          {/* Recharts graph panel */}
          <div
            ref={chartRef}
            className="flex-1 bg-[#0A0E1A]/20 border border-[#1F2937]/40 rounded-2xl p-5 min-h-[360px] flex items-center justify-center backdrop-blur-md relative min-w-0 max-w-full w-full"
          >
            <ChartRenderer
              chartType={chartType}
              data={aggregatedData}
              rawRows={rawRows}
              xField={xField}
              yField={yField}
              groupBy={groupBy}
            />
          </div>
        </div>

        {/* AI Insight report pane */}
        <div className="h-full min-w-0 max-w-full overflow-hidden">
          <ChartInsights insights={insights} yField={yField} />
        </div>

      </div>

    </div>
  );
};
