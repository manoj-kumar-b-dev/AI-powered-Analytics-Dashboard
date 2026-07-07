const DataRow = require('../../models/dataRow');
const DataSource = require('../../models/dataSource');
const KPIRecommendationService = require('../kpiRecommendation/kpiRecommendationService');

/**
 * Rule Engine Service
 * 
 * Responsibilities:
 * - Evaluate user-defined logical rules against dataset transactions (e.g., "Alert if expenses > $50k").
 * - Filter alerts and compute threshold breaches.
 * - Trigger callbacks or notifications for active subscriptions.
 * 
 * Interface:
 * - evaluateRules(dataSourceId: string, rules: Array): Promise<Array>
 * - checkThresholdBreach(value: number, threshold: number, operator: string): boolean
 */

class RuleEngineService {
  /**
   * Run rules check on a specific dataset.
   * @param {string} dataSourceId 
   * @param {Array} rules - Logical rule statements.
   * @returns {Promise<Array>} - List of triggered alerts.
   */
  async evaluateRules(dataSourceId, rules = []) {
    try {
      const dataSource = await DataSource.findById(dataSourceId);
      if (!dataSource) return [];

      const kpiMappings = await KPIRecommendationService.recommendKPIs(dataSource.schema);
      const expCol = kpiMappings.find(m => m.kpi === 'expenses')?.column;
      const profitCol = kpiMappings.find(m => m.kpi === 'profit')?.column;

      const alerts = [];

      // Evaluate basic default rules if no rules passed
      const activeRules = rules.length > 0 ? rules : [
        { id: 'high-expense', label: 'High Expense Alert', column: expCol, threshold: 5000, operator: '>' },
        { id: 'negative-profit', label: 'Negative Profit Warning', column: profitCol, threshold: 0, operator: '<' }
      ].filter(r => r.column);

      for (const rule of activeRules) {
        const matchQuery = {
          dataSourceId: dataSource._id,
          [`data.${rule.column}`]: this.getQueryOperator(rule.operator, rule.threshold)
        };

        const count = await DataRow.countDocuments(matchQuery);
        if (count > 0) {
          alerts.push({
            ruleId: rule.id,
            label: rule.label,
            column: rule.column,
            triggeredCount: count,
            severity: rule.id === 'negative-profit' ? 'warning' : 'info'
          });
        }
      }

      return alerts;
    } catch (err) {
      console.error('Error evaluating rules:', err);
      return [];
    }
  }

  getQueryOperator(operator, threshold) {
    switch (operator) {
      case '>': return { $gt: threshold };
      case '<': return { $lt: threshold };
      case '==': return threshold;
      case '!=': return { $ne: threshold };
      default: return { $gt: threshold };
    }
  }

  /**
   * Compare a target value to a threshold.
   * @param {number} value 
   * @param {number} threshold 
   * @param {string} operator - '>', '<', '==', '!=', etc.
   * @returns {boolean}
   */
  checkThresholdBreach(value, threshold, operator) {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return value > threshold;
    }
  }
}

module.exports = new RuleEngineService();
