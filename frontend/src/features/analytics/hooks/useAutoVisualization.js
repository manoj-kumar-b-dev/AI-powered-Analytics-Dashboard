import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchDataSourceAllRows } from '../services/visualizationService';
import {
  detectColumnTypes,
  recommendChart,
  aggregateData,
  generateInsights
} from '../../shared/utils/visualizationUtils';

export const useAutoVisualization = ({ initialRows = [], initialHeaders = [], dsId = null, apiRequest = null }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Data State
  const [rawRows, setRawRows] = useState(initialRows);
  const [headers, setHeaders] = useState(initialHeaders);

  // Auto-analysis output
  const [detectedTypes, setDetectedTypes] = useState({});
  const [recommendation, setRecommendation] = useState({
    chartType: 'none',
    confidence: 0,
    reason: 'Initializing...',
    xField: '',
    yField: '',
    aggregation: 'count'
  });

  // User Overrides State
  const [chartType, setChartType] = useState('none');
  const [xField, setXField] = useState('');
  const [yField, setYField] = useState('');
  const [aggregation, setAggregation] = useState('count');
  const [groupBy, setGroupBy] = useState('');
  const [filters, setFilters] = useState({});
  const [sortConfig, setSortConfig] = useState(null); // { key, direction: 'asc'|'desc' }

  // 1a. Load full dataset from backend if dsId changes
  useEffect(() => {
    if (!dsId || !apiRequest) return;

    const loadFullDataset = async () => {
      setIsLoading(true);
      setError('');
      try {
        const rows = await fetchDataSourceAllRows(dsId, apiRequest);
        setRawRows(rows);
        if (rows.length > 0) {
          setHeaders(Object.keys(rows[0]));
        }
      } catch (err) {
        if (!err.message?.includes('not found')) {
          console.error('AutoVisualization Error:', err);
        }
        setError(err.message || 'Failed to fetch full rows for automated charting.');
      } finally {
        setIsLoading(false);
      }
    };

    loadFullDataset();
  }, [dsId, apiRequest]);

  // 1b. Use initial rows/headers if provided directly (e.g. during staging upload preview)
  useEffect(() => {
    if (initialRows && initialRows.length > 0) {
      setRawRows(initialRows);
      setHeaders(initialHeaders);
      setError('');
    }
  }, [initialRows, initialHeaders]);

  // 2. Perform automated schema type detection and recommendation whenever dataset changes
  useEffect(() => {
    if (!rawRows || rawRows.length === 0 || !headers || headers.length === 0) {
      setDetectedTypes({});
      setRecommendation({
        chartType: 'none',
        confidence: 0,
        reason: 'No dataset loaded.',
        xField: '',
        yField: '',
        aggregation: 'count'
      });
      return;
    }

    // Run column detection
    const colTypes = detectColumnTypes(rawRows, headers);
    setDetectedTypes(colTypes);

    // Get chart recommendations
    const rec = recommendChart(colTypes, rawRows, headers);
    setRecommendation(rec);

    // Auto-apply recommended states
    setChartType(rec.chartType);
    setXField(rec.xField);
    setYField(rec.yField);
    setAggregation(rec.aggregation);
    
    // Clear overrides
    setGroupBy('');
    setFilters({});
    setSortConfig(null);
  }, [rawRows, headers]);

  // 3. Compute Aggregated Data for charting (O(N) aggregation, highly optimized)
  const aggregatedData = useMemo(() => {
    return aggregateData(rawRows, xField, yField, aggregation, groupBy, filters, sortConfig);
  }, [rawRows, xField, yField, aggregation, groupBy, filters, sortConfig]);

  // 4. Generate NLP Insights dynamically
  const insights = useMemo(() => {
    return generateInsights(aggregatedData, rawRows, xField, yField, detectedTypes);
  }, [aggregatedData, rawRows, xField, yField, detectedTypes]);

  // 5. Restore recommendation overrides
  const resetToRecommendation = useCallback(() => {
    if (recommendation) {
      setChartType(recommendation.chartType);
      setXField(recommendation.xField);
      setYField(recommendation.yField);
      setAggregation(recommendation.aggregation);
      setGroupBy('');
      setFilters({});
      setSortConfig(null);
    }
  }, [recommendation]);

  // Helper filters updating
  const handleFilterChange = useCallback((column, value) => {
    setFilters(prev => ({
      ...prev,
      [column]: value
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
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
    setFilters,
    handleFilterChange,
    handleClearFilters,
    sortConfig,
    setSortConfig,
    
    // Visual aggregates and stats
    aggregatedData,
    insights,
    resetToRecommendation
  };
};
