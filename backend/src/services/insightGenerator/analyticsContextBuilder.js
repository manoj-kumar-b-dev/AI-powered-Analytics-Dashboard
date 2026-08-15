/**
 * AnalyticsContextBuilder
 *
 * Responsibilities:
 * - Collects all completed analytics outputs into one normalized context object.
 * - STRICT RULE: Does NOT perform calculations or aggregate raw CSV rows.
 * - Combines existing pre-calculated outputs (KPIs, Charts, Correlations, Outliers, Trends).
 */

class AnalyticsContextBuilder {
  /**
   * Normalizes pre-calculated analytics outputs into a unified context payload.
   *
   * @param {Object} params
   * @param {Object} params.dataSource - DataSource metadata object
   * @param {Array} params.kpis - Pre-calculated KPI cards
   * @param {Array} params.charts - Pre-calculated chart widgets with resolved aggregation data
   * @param {Array} [params.correlations] - Pearson correlation matrix
   * @param {Array} [params.anomalies] - Detected Z-score outliers or rule engine alerts
   * @param {Array} [params.trends] - Trend analysis or time-series forecast series
   * @param {Object} [params.reports] - Dataset cleanliness / validation reports
   * @returns {Object} Normalized analytics context object
   */
  buildContext({ dataSource = {}, kpis = [], charts = [], correlations = [], anomalies = [], trends = [], reports = {} }) {
    const schemaSummary = (dataSource.schema || []).map(col => ({
      column: col.column,
      type: col.type,
      semanticRole: col.semanticRole || 'general'
    }));

    return {
      datasetSummary: {
        fileName: dataSource.fileName || 'Dataset',
        rows: dataSource.rowCount || 0,
        columns: schemaSummary.length,
        domain: dataSource.domain || 'general',
        domainLabel: dataSource.domainLabel || dataSource.domain || 'General Domain',
        cleanliness: reports.cleanliness || '100%',
        problemCount: reports.problemCount || 0,
        schemaSummary
      },

      kpis: (kpis || []).map(k => ({
        key: k.kpi || k.label,
        label: k.label || k.kpi,
        value: k.value,
        formattedValue: k.formattedValue || String(k.value),
        deltaPct: k.deltaPct !== undefined ? k.deltaPct : null,
        deltaDirection: k.deltaDirection || 'flat',
        period: k.period || null
      })),

      charts: (charts || []).map(c => ({
        id: c.id,
        title: c.title,
        type: c.type,
        config: c.config || {},
        // Summary of top aggregated data points for LLM interpretation (no raw data)
        aggregatedData: (c.resolvedData || []).slice(0, 10).map(point => ({
          x: String(point.x),
          y: point.y
        })),
        forecast: (c.forecast || []).slice(0, 5)
      })),

      statistics: (charts || [])
        .filter(c => c.resolvedData && c.resolvedData.length > 0)
        .map(c => {
          const yVals = c.resolvedData.map(d => Number(d.y) || 0).filter(v => !isNaN(v));
          if (yVals.length === 0) return null;
          const sum = yVals.reduce((a, b) => a + b, 0);
          const max = Math.max(...yVals);
          const min = Math.min(...yVals);
          return {
            chartTitle: c.title,
            metric: c.config?.yField || 'value',
            pointCount: yVals.length,
            aggregatedSum: sum,
            maxPoint: max,
            minPoint: min
          };
        })
        .filter(Boolean),

      correlations: (correlations || []).map(corr => ({
        variable: corr.variable,
        correlations: (corr.correlations || []).filter(c => Math.abs(c.correlation) > 0.3)
      })),

      outliers: (anomalies || []).map(a => ({
        label: a.label || a.message || 'Outlier',
        metric: a.metric || 'Value',
        triggeredCount: a.triggeredCount || 1,
        severity: a.severity || 'warning',
        zScore: a.zScore || null,
        point: a.point || null
      })),

      trendAnalysis: (trends || []).length > 0 ? trends : (charts || [])
        .filter(c => c.type?.includes('line') && c.forecast && c.forecast.length > 0)
        .map(c => ({
          chartTitle: c.title,
          forecastPoints: c.forecast
        }))
    };
  }
}

module.exports = new AnalyticsContextBuilder();
