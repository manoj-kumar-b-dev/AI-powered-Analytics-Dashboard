const analysisEngine = require('../../analysisEngine');

/**
 * QueryExecutor
 *
 * Translates validated Version 1.0 Query Plans into deterministic execution calls
 * on analysisEngine.js, returning structured results with computational evidence.
 */
class QueryExecutor {
  /**
   * Execute a validated Query Plan.
   * @param {Object} plan - Validated Version 1.0 Query Plan
   * @param {Array<Object>} rows - Raw dataset rows
   * @param {Array<Object>} columnsSchema - Column definitions
   * @returns {Object} Execution result with analysis payload, evidence, and chart
   */
  execute(plan, rows, columnsSchema) {
    // Map Query Plan intent to analysisEngine action
    let action = 'group_by';
    if (plan.intent === 'overall_summary') action = 'overall_summary';
    else if (['compare_periods', 'trend'].includes(plan.intent)) action = 'compare_periods';
    else if (['top_n', 'bottom_n', 'ranking'].includes(plan.intent)) action = 'top_n';
    else if (plan.intent === 'filter_and_aggregate') action = 'filter_and_aggregate';

    const operation = {
      action,
      metric: plan.metric?.column || null,
      aggregation: plan.metric?.aggregation || 'sum',
      groupBy: plan.dimension?.column || null,
      dateColumn: plan.temporal?.column || null,
      dateFilter: plan.temporal?.filter || null,
      periodType: plan.temporal?.periodType || 'monthly',
      filterColumn: plan.filter?.column || null,
      filterValue: plan.filter?.value ?? null,
      limit: plan.limit || 5,
      direction: plan.sort?.direction === 'asc' || plan.intent === 'bottom_n' ? 'asc' : 'desc'
    };

    // Run deterministic calculation engine
    const engineOutput = analysisEngine.execute(operation, rows, columnsSchema);

    // Build evidence payload for Answer Context Builder
    const evidence = {
      action: engineOutput.analysis.action,
      rowsMatched: engineOutput.analysis.totalRows || rows.length,
      metric: engineOutput.analysis.metric,
      groupBy: engineOutput.analysis.groupBy || null,
      dateFilter: engineOutput.analysis.dateFilter || null,
      targetVal: engineOutput.analysis.targetVal,
      totalValue: engineOutput.analysis.totalValue,
      avgValue: engineOutput.analysis.avgValue,
      resultCount: Array.isArray(engineOutput.analysis.result) ? engineOutput.analysis.result.length : 0
    };

    return {
      queryPlan: plan,
      analysis: engineOutput.analysis,
      chart: engineOutput.chart,
      methodology: engineOutput.methodology,
      evidence
    };
  }
}

module.exports = new QueryExecutor();
