/**
 * Safe Server-Side Analysis Execution Engine
 * Validates and executes approved analytical operations on raw dataset rows.
 * Supported actions: 'group_by', 'compare_periods', 'filter_and_aggregate', 'top_n', 'overall_summary'
 */
class AnalysisEngine {
  /**
   * Main entry point to run an approved analysis.
   * @param {Object} operation - { action, metric, groupBy, aggregation, dateColumn, periodType, filterColumn, filterValue, limit, direction }
   * @param {Array<Object>} rows - Raw dataset rows
   * @param {Array<{name: string, type: string}>} columnsSchema - Column definitions
   * @returns {Object} { analysis, chart, methodology }
   */
  execute(operation = {}, rows = [], columnsSchema = []) {
    const action = operation.action || 'group_by';
    const schemaMap = new Map(columnsSchema.map(c => [c.name, c.type]));
    const targetRows = this._applyFilters(rows, operation, schemaMap);

    switch (action) {
      case 'group_by':
        return this._executeGroupBy(operation, targetRows, schemaMap);
      case 'compare_periods':
        return this._executeComparePeriods(operation, targetRows, schemaMap);
      case 'filter_and_aggregate':
        return this._executeFilterAndAggregate(operation, targetRows, schemaMap);
      case 'top_n':
        return this._executeTopN(operation, targetRows, schemaMap);
      case 'overall_summary':
        return this._executeOverallSummary(operation, targetRows, schemaMap);
      default:
        // Fall back to top group_by if action is unrecognized
        return this._executeGroupBy(operation, targetRows, schemaMap);
    }
  }

  _applyFilters(rows, op, schemaMap) {
    let filtered = [...rows];

    // Apply dateFilter (e.g. "2026-01" or "2025")
    if (op.dateFilter && op.dateColumn) {
      const dCol = this._findValidColumn(op.dateColumn, schemaMap, ['date', 'string']);
      if (dCol) {
        const pattern = String(op.dateFilter).toLowerCase();
        filtered = filtered.filter(r => {
          const rawDate = r[dCol];
          if (rawDate === null || rawDate === undefined) return false;
          const strDate = String(rawDate).toLowerCase();
          if (strDate.includes(pattern)) return true;

          const dObj = new Date(rawDate);
          if (!isNaN(dObj.getTime())) {
            const iso = dObj.toISOString().toLowerCase();
            return iso.includes(pattern);
          }
          return false;
        });
      }
    }

    // Apply filterColumn and filterValue
    if (op.filterColumn && op.filterValue !== undefined && op.filterValue !== null) {
      const fCol = this._findValidColumn(op.filterColumn, schemaMap);
      if (fCol) {
        const valStr = String(op.filterValue).toLowerCase().trim();
        filtered = filtered.filter(r => {
          const rowVal = String(r[fCol] ?? '').toLowerCase();
          return rowVal.includes(valStr) || valStr.includes(rowVal);
        });
      }
    }

    return filtered;
  }

  _executeOverallSummary(op, rows, schemaMap) {
    const metric = this._findValidColumn(op.metric, schemaMap, ['number']) || this._getFirstNumberColumn(schemaMap);
    const aggregation = ['sum', 'avg', 'min', 'max', 'count'].includes(op.aggregation) ? op.aggregation : 'sum';

    const values = [];
    rows.forEach(r => {
      if (metric) {
        const val = parseFloat(r[metric]);
        if (!isNaN(val)) values.push(val);
      }
    });

    const sumVal = Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
    const avgVal = values.length ? Math.round((sumVal / values.length) * 100) / 100 : 0;
    const minVal = values.length ? Math.round(Math.min(...values) * 100) / 100 : 0;
    const maxVal = values.length ? Math.round(Math.max(...values) * 100) / 100 : 0;

    let targetVal = sumVal;
    if (aggregation === 'avg') targetVal = avgVal;
    if (aggregation === 'min') targetVal = minVal;
    if (aggregation === 'max') targetVal = maxVal;
    if (aggregation === 'count') targetVal = rows.length;

    const summaryResult = [
      { Metric: 'Sum Total', Value: sumVal },
      { Metric: 'Average', Value: avgVal },
      { Metric: 'Minimum', Value: minVal },
      { Metric: 'Maximum', Value: maxVal }
    ];

    const filterDesc = op.dateFilter ? ` matching date filter "${op.dateFilter}"` : op.filterColumn ? ` matching filter "${op.filterColumn} = ${op.filterValue}"` : '';

    return {
      analysis: {
        action: 'overall_summary',
        metric: metric || 'Rows',
        aggregation,
        targetVal,
        totalValue: sumVal,
        avgValue: avgVal,
        totalRows: rows.length,
        dateFilter: op.dateFilter || null,
        filterColumn: op.filterColumn || null,
        filterValue: op.filterValue || null,
        result: summaryResult
      },
      chart: {
        type: 'bar',
        xKey: 'Metric',
        yKey: 'Value',
        data: summaryResult
      },
      methodology: `Calculated overall ${aggregation.toUpperCase()} of ${metric || 'rows'} across ${rows.length} records${filterDesc}.`
    };
  }

  _executeGroupBy(op, rows, schemaMap) {
    const groupBy = this._findValidColumn(op.groupBy, schemaMap, ['string', 'boolean', 'date']) || this._getFirstColumn(schemaMap);
    const metric = this._findValidColumn(op.metric, schemaMap, ['number']) || this._getFirstNumberColumn(schemaMap);
    const aggregation = ['sum', 'avg', 'min', 'max', 'count'].includes(op.aggregation) ? op.aggregation : 'sum';

    const groups = {};

    rows.forEach(r => {
      const key = String(r[groupBy] ?? 'Unknown');
      if (!groups[key]) {
        groups[key] = { count: 0, values: [] };
      }
      groups[key].count += 1;
      if (metric) {
        const val = parseFloat(r[metric]);
        if (!isNaN(val)) groups[key].values.push(val);
      }
    });

    const result = Object.entries(groups).map(([groupKey, groupData]) => {
      let aggVal = groupData.count;
      if (aggregation !== 'count' && groupData.values.length > 0) {
        if (aggregation === 'sum') {
          aggVal = groupData.values.reduce((a, b) => a + b, 0);
        } else if (aggregation === 'avg') {
          aggVal = groupData.values.reduce((a, b) => a + b, 0) / groupData.values.length;
        } else if (aggregation === 'min') {
          aggVal = Math.min(...groupData.values);
        } else if (aggregation === 'max') {
          aggVal = Math.max(...groupData.values);
        }
      }
      return {
        [groupBy]: groupKey,
        [metric || 'Count']: Math.round(aggVal * 100) / 100
      };
    });

    // Sort descending by value for neat display
    result.sort((a, b) => (b[metric || 'Count'] || 0) - (a[metric || 'Count'] || 0));

    const yKey = metric || 'Count';

    return {
      analysis: {
        action: 'group_by',
        metric: metric || 'Count',
        groupBy,
        aggregation,
        result
      },
      chart: {
        type: 'bar',
        xKey: groupBy,
        yKey,
        data: result.slice(0, 15) // Safe chart payload size
      },
      methodology: `Grouped data by ${groupBy} and calculated ${aggregation.toUpperCase()} of ${metric || 'row count'}.`
    };
  }

  _executeComparePeriods(op, rows, schemaMap) {
    const dateCol = this._findValidColumn(op.dateColumn, schemaMap, ['date']) || this._getFirstDateColumn(schemaMap) || this._getFirstColumn(schemaMap);
    const metric = this._findValidColumn(op.metric, schemaMap, ['number']) || this._getFirstNumberColumn(schemaMap);

    const periodMap = {};

    rows.forEach(r => {
      const dateVal = r[dateCol];
      if (!dateVal) return;
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return;

      const periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
      if (!periodMap[periodKey]) {
        periodMap[periodKey] = { sum: 0, count: 0, dateObj: d };
      }
      const num = parseFloat(r[metric]) || 0;
      periodMap[periodKey].sum += num;
      periodMap[periodKey].count += 1;
    });

    const sortedPeriods = Object.entries(periodMap)
      .sort((a, b) => a[1].dateObj.getTime() - b[1].dateObj.getTime())
      .map(([pKey, pData], idx, arr) => {
        const val = Math.round(pData.sum * 100) / 100;
        let changePct = 0;
        if (idx > 0 && arr[idx - 1][1].sum > 0) {
          const prevVal = arr[idx - 1][1].sum;
          changePct = Math.round(((val - prevVal) / prevVal) * 100);
        }
        return {
          Period: pKey,
          [metric || 'Value']: val,
          'Change %': changePct
        };
      });

    const yKey = metric || 'Value';

    return {
      analysis: {
        action: 'compare_periods',
        metric: metric || 'Value',
        dateColumn: dateCol,
        periodType: op.periodType || 'monthly',
        result: sortedPeriods
      },
      chart: {
        type: 'line',
        xKey: 'Period',
        yKey,
        data: sortedPeriods
      },
      methodology: `Analyzed monthly periods for ${dateCol} and aggregated ${metric || 'Value'}.`
    };
  }

  _executeFilterAndAggregate(op, rows, schemaMap) {
    const filterCol = this._findValidColumn(op.filterColumn, schemaMap) || this._getFirstColumn(schemaMap);
    const filterVal = op.filterValue != null ? String(op.filterValue).toLowerCase() : '';
    const metric = this._findValidColumn(op.metric, schemaMap, ['number']) || this._getFirstNumberColumn(schemaMap);
    const aggregation = ['sum', 'avg', 'min', 'max', 'count'].includes(op.aggregation) ? op.aggregation : 'sum';
    const groupBy = this._findValidColumn(op.groupBy, schemaMap, ['string', 'boolean']) || filterCol;

    const filteredRows = rows.filter(r => {
      if (!filterVal) return true;
      const cellVal = String(r[filterCol] ?? '').toLowerCase();
      return cellVal.includes(filterVal);
    });

    const groups = {};
    (filteredRows.length > 0 ? filteredRows : rows).forEach(r => {
      const gKey = String(r[groupBy] ?? 'Filtered Group');
      if (!groups[gKey]) groups[gKey] = [];
      const num = parseFloat(r[metric]) || 0;
      groups[gKey].push(num);
    });

    const result = Object.entries(groups).map(([gKey, vals]) => {
      let aggVal = vals.length;
      if (aggregation === 'sum') aggVal = vals.reduce((a, b) => a + b, 0);
      if (aggregation === 'avg') aggVal = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
      if (aggregation === 'min') aggVal = Math.min(...vals);
      if (aggregation === 'max') aggVal = Math.max(...vals);

      return {
        [groupBy]: gKey,
        [metric || 'Value']: Math.round(aggVal * 100) / 100
      };
    });

    return {
      analysis: {
        action: 'filter_and_aggregate',
        filterColumn: filterCol,
        filterValue: op.filterValue,
        metric: metric || 'Value',
        aggregation,
        result
      },
      chart: {
        type: 'bar',
        xKey: groupBy,
        yKey: metric || 'Value',
        data: result.slice(0, 10)
      },
      methodology: `Filtered rows matching ${filterCol} = "${op.filterValue || 'all'}" and aggregated ${metric || 'records'}.`
    };
  }

  _executeTopN(op, rows, schemaMap) {
    const groupBy = this._findValidColumn(op.groupBy, schemaMap, ['string', 'boolean', 'date']) || this._getFirstColumn(schemaMap);
    const metric = op.metric ? this._findValidColumn(op.metric, schemaMap, ['number']) : null;
    const limit = Math.min(Math.max(parseInt(op.limit) || 5, 1), 20);
    const direction = op.direction === 'asc' ? 'asc' : 'desc';

    const groupSums = {};
    rows.forEach(r => {
      const gKey = String(r[groupBy] ?? 'Unknown');
      if (metric) {
        const val = parseFloat(r[metric]) || 0;
        groupSums[gKey] = (groupSums[gKey] || 0) + val;
      } else {
        groupSums[gKey] = (groupSums[gKey] || 0) + 1;
      }
    });

    const metricKey = metric || 'Count';

    const sorted = Object.entries(groupSums)
      .map(([k, val]) => ({
        [groupBy]: k,
        [metricKey]: Math.round(val * 100) / 100
      }))
      .sort((a, b) => {
        const valA = a[metricKey];
        const valB = b[metricKey];
        return direction === 'asc' ? valA - valB : valB - valA;
      })
      .slice(0, limit);

    return {
      analysis: {
        action: 'top_n',
        metric: metric || 'Value',
        groupBy,
        limit,
        direction,
        result: sorted
      },
      chart: {
        type: 'bar',
        xKey: groupBy,
        yKey: metric || 'Value',
        data: sorted
      },
      methodology: `Extracted top ${limit} ${groupBy} groups sorted ${direction.toUpperCase()} by ${metric || 'Value'}.`
    };
  }

  _findValidColumn(colName, schemaMap, allowedTypes = null) {
    if (!colName) return null;
    const clean = String(colName).trim();
    if (schemaMap.has(clean)) {
      const type = schemaMap.get(clean);
      if (!allowedTypes || allowedTypes.includes(type)) return clean;
    }
    // Case-insensitive fallback lookup
    for (const [name, type] of schemaMap.entries()) {
      if (name.toLowerCase() === clean.toLowerCase()) {
        if (!allowedTypes || allowedTypes.includes(type)) return name;
      }
    }
    return null;
  }

  _getFirstNumberColumn(schemaMap) {
    for (const [name, type] of schemaMap.entries()) {
      if (type === 'number') return name;
    }
    return null;
  }

  _getFirstDateColumn(schemaMap) {
    for (const [name, type] of schemaMap.entries()) {
      if (type === 'date') return name;
    }
    return null;
  }

  _getFirstColumn(schemaMap) {
    return Array.from(schemaMap.keys())[0] || 'Category';
  }
}

module.exports = new AnalysisEngine();
