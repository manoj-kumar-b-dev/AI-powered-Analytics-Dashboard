/**
 * Safe Server-Side Analysis Execution Engine
 * Validates and executes approved analytical operations on raw dataset rows.
 * Supported actions: 'group_by', 'compare_periods', 'filter_and_aggregate', 'top_n'
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

    switch (action) {
      case 'group_by':
        return this._executeGroupBy(operation, rows, schemaMap);
      case 'compare_periods':
        return this._executeComparePeriods(operation, rows, schemaMap);
      case 'filter_and_aggregate':
        return this._executeFilterAndAggregate(operation, rows, schemaMap);
      case 'top_n':
        return this._executeTopN(operation, rows, schemaMap);
      default:
        // Fall back to top group_by if action is unrecognized
        return this._executeGroupBy(operation, rows, schemaMap);
    }
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
    const metric = this._findValidColumn(op.metric, schemaMap, ['number']) || this._getFirstNumberColumn(schemaMap);
    const limit = Math.min(Math.max(parseInt(op.limit) || 5, 1), 20);
    const direction = op.direction === 'asc' ? 'asc' : 'desc';

    const groupSums = {};
    rows.forEach(r => {
      const gKey = String(r[groupBy] ?? 'Unknown');
      const val = parseFloat(r[metric]) || 0;
      groupSums[gKey] = (groupSums[gKey] || 0) + val;
    });

    const sorted = Object.entries(groupSums)
      .map(([k, val]) => ({
        [groupBy]: k,
        [metric || 'Value']: Math.round(val * 100) / 100
      }))
      .sort((a, b) => {
        const valA = a[metric || 'Value'];
        const valB = b[metric || 'Value'];
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
