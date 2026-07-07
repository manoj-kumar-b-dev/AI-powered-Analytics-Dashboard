const DataRow = require('../../models/dataRow');
const DataSource = require('../../models/dataSource');

/**
 * Analytics Engine
 * 
 * Responsibilities:
 * - Perform complex data operations beyond basic Mongoose aggregates.
 * - Compute linear regressions, correlations, anomaly vectors, and time-series forecasts.
 * - Structure tabular rows for high-performance statistical indexing.
 * 
 * Interface:
 * - calculateCorrelationMatrix(dataSourceId: string): Promise<Array>
 * - forecastSeries(dataPoints: Array, periods: number): Promise<Array>
 * - detectAnomalies(dataPoints: Array): Promise<Array>
 */

class AnalyticsEngine {
  /**
   * Calculate Pearson correlation matrix across numerical variables.
   * @param {string} dataSourceId 
   * @returns {Promise<Array>}
   */
  async calculateCorrelationMatrix(dataSourceId) {
    try {
      const dataSource = await DataSource.findById(dataSourceId);
      if (!dataSource) return [];

      const numCols = dataSource.schema.filter(c => c.type === 'numeric').map(c => c.column);
      if (numCols.length < 2) return [];

      // Retrieve a sample of 100 rows to calculate Pearson Correlation
      const rows = await DataRow.find({ dataSourceId }).limit(100).lean();
      if (rows.length < 2) return [];

      const matrix = [];
      for (const colA of numCols) {
        const rowA = [];
        for (const colB of numCols) {
          const valA = rows.map(r => Number(r.data[colA]) || 0);
          const valB = rows.map(r => Number(r.data[colB]) || 0);
          const corr = this.getPearsonCorrelation(valA, valB);
          rowA.push({ variable: colB, correlation: Number(corr.toFixed(3)) });
        }
        matrix.push({ variable: colA, correlations: rowA });
      }

      return matrix;
    } catch (err) {
      console.error('Error calculating correlation matrix:', err);
      return [];
    }
  }

  getPearsonCorrelation(x, y) {
    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (den === 0) return 0;
    return num / den;
  }

  /**
   * Forecast time-series values into the future.
   * @param {Array} dataPoints - Historically aggregated chart data points.
   * @param {number} periods - Number of intervals to forecast.
   * @returns {Promise<Array>}
   */
  async forecastSeries(dataPoints, periods = 7) {
    if (!dataPoints || dataPoints.length < 2) return [];
    
    // Simple linear regression: y = mx + c
    const xVals = dataPoints.map((_, i) => i);
    const yVals = dataPoints.map(p => Number(p.y) || 0);
    const n = xVals.length;

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += xVals[i];
      sumY += yVals[i];
      sumXY += xVals[i] * yVals[i];
      sumXX += xVals[i] * xVals[i];
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
    const intercept = (sumY - slope * sumX) / n || 0;

    const forecasted = [];
    
    for (let i = 1; i <= periods; i++) {
      const nextX = n - 1 + i;
      const nextY = slope * nextX + intercept;
      
      forecasted.push({
        x: `Forecast +${i}`,
        y: Math.round(Math.max(0, nextY))
      });
    }

    return forecasted;
  }

  /**
   * Identify outliers and anomalies in columns.
   * @param {Array} dataPoints 
   * @returns {Promise<Array>}
   */
  async detectAnomalies(dataPoints) {
    if (!dataPoints || dataPoints.length < 3) return [];
    
    const yVals = dataPoints.map(p => Number(p.y) || 0);
    const mean = yVals.reduce((a, b) => a + b, 0) / yVals.length;
    const stdDev = Math.sqrt(yVals.map(y => Math.pow(y - mean, 2)).reduce((a, b) => a + b, 0) / yVals.length) || 1;

    const anomalies = [];
    dataPoints.forEach((p, idx) => {
      const zScore = (p.y - mean) / stdDev;
      if (Math.abs(zScore) > 1.8) {
        anomalies.push({
          index: idx,
          point: p,
          zScore: Number(zScore.toFixed(2)),
          message: `Outlier detected at ${p.x} (${p.y > mean ? 'High' : 'Low'})`
        });
      }
    });

    return anomalies;
  }
}

module.exports = new AnalyticsEngine();
