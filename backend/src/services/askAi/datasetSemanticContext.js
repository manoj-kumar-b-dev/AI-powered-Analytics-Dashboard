    const { classifyColumns, SEMANTIC_ROLES } = require('../../analytics/semantic/semanticClassifier');

/**
 * DatasetSemanticContextBuilder
 *
 * Generates a rich, domain-agnostic semantic profile for any arbitrary tabular dataset.
 * Combines physical data types, sample values, statistical profiles,
 * universal semantic roles, dynamic column aliases, and aggregation capabilities.
 */
class DatasetSemanticContextBuilder {
  /**
   * Build semantic context for a dataset.
   * @param {Array<Object>} columnsSchema - Array of { name: string, type: string }
   * @param {Array<Object>} rows - Raw dataset rows
   * @returns {Object} Semantic Context object
   */
  buildContext(columnsSchema = [], rows = []) {
    if (!Array.isArray(columnsSchema) || columnsSchema.length === 0) {
      return { columns: [], summary: {} };
    }

    const rowCount = rows.length;

    // Build enhanced schema for semanticClassifier
    const enhancedSchema = columnsSchema.map(col => {
      const colName = col.name || col.column;
      const vals = rows.map(r => r[colName]).filter(v => v !== null && v !== undefined && v !== '');
      const uniqueCount = new Set(vals.map(String)).size;
      const nullRatio = rowCount > 0 ? (rowCount - vals.length) / rowCount : 0;
      const uniqueRatio = vals.length > 0 ? uniqueCount / vals.length : 0;

      let cardinalityClass = 'high';
      if (uniqueCount <= 2) cardinalityClass = 'binary';
      else if (uniqueCount < 20) cardinalityClass = 'low';
      else if (uniqueCount < 100) cardinalityClass = 'medium';

      return {
        column: colName,
        name: colName,
        type: col.type || 'string',
        sampleValues: vals.slice(0, 10),
        nullRatio: Math.round(nullRatio * 1000) / 1000,
        uniqueRatio: Math.round(uniqueRatio * 1000) / 1000,
        cardinalityCount: uniqueCount,
        cardinalityClass
      };
    });

    // Invoke universal SemanticClassifier single source of truth
    const classificationMap = classifyColumns(enhancedSchema);

    // Process each column into a universal semantic profile
    const columnsProfile = enhancedSchema.map(col => {
      const colName = col.name;
      const classInfo = classificationMap.get(colName) || {};
      const role = classInfo.semanticRole || SEMANTIC_ROLES.UNKNOWN;

      // Extract raw values for statistical calculations
      const rawVals = rows.map(r => r[colName]).filter(v => v !== null && v !== undefined && v !== '');
      const statistics = this._computeStatistics(col.type, rawVals);

      // Determine valid aggregations for this column based on role & physical type
      const aggregationCapabilities = this._determineAggregations(role, col.type, classInfo);

      // Extract dynamic aliases from column tokens
      const aliases = this._generateDynamicAliases(colName, role);

      return {
        name: colName,
        physicalType: classInfo.physicalType || col.type,
        semanticRole: role,
        confidence: classInfo.confidence || 0.8,
        reason: classInfo.reason || '',
        aliases,
        uniqueCount: col.cardinalityCount,
        uniqueRatio: col.uniqueRatio,
        nullRatio: col.nullRatio,
        cardinalityClass: col.cardinalityClass,
        sampleValues: col.sampleValues.slice(0, 5),
        statistics,
        aggregationCapabilities,
        flags: {
          isAdditive: classInfo.isAdditive || false,
          isAggregatable: classInfo.isAggregatable || false,
          isDimensionalizable: classInfo.isDimensionalizable || false,
          isTemporal: classInfo.isTemporal || false,
          isIdentifier: classInfo.isIdentifier || false,
          isSensitive: classInfo.isSensitive || false
        }
      };
    });

    return {
      totalRows: rowCount,
      columns: columnsProfile,
      measures: columnsProfile.filter(c => c.flags.isAggregatable),
      dimensions: columnsProfile.filter(c => c.flags.isDimensionalizable),
      temporalColumns: columnsProfile.filter(c => c.flags.isTemporal),
      identifiers: columnsProfile.filter(c => c.flags.isIdentifier)
    };
  }

  /**
   * Compute min, max, mean, median for numeric columns.
   */
  _computeStatistics(type, vals) {
    if (type !== 'number' || vals.length === 0) return null;
    const nums = vals.map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (nums.length === 0) return null;

    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = Math.round((sum / nums.length) * 100) / 100;
    const min = nums[0];
    const max = nums[nums.length - 1];

    let median = nums[Math.floor(nums.length / 2)];
    if (nums.length % 2 === 0) {
      const mid1 = nums[nums.length / 2 - 1];
      const mid2 = nums[nums.length / 2];
      median = Math.round(((mid1 + mid2) / 2) * 100) / 100;
    }

    return { min, max, mean, median, count: nums.length };
  }

  /**
   * Determine allowed aggregations per semantic role.
   */
  _determineAggregations(role, type, classInfo) {
    if (classInfo.isIdentifier || classInfo.isSensitive) {
      return ['count', 'count_distinct'];
    }

    if (role === SEMANTIC_ROLES.PERCENTAGE_METRIC || role === SEMANTIC_ROLES.RATIO_METRIC || role === SEMANTIC_ROLES.ORDINAL_METRIC || role === SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE) {
      return ['average', 'median', 'min', 'max', 'count'];
    }

    if (role === SEMANTIC_ROLES.MONETARY_METRIC || role === SEMANTIC_ROLES.ADDITIVE_METRIC || type === 'number') {
      return ['sum', 'average', 'median', 'min', 'max', 'count'];
    }

    return ['count', 'count_distinct'];
  }

  /**
   * Generates dynamic aliases based on column name tokens without hardcoding domain rules.
   */
  _generateDynamicAliases(colName, role) {
    const raw = String(colName).toLowerCase();
    const clean = raw.replace(/[^a-z0-9]/g, ' ');
    const tokens = clean.split(/\s+/).filter(t => t.length > 1 && !['inr', 'usd', 'eur', 'gbp', 'pct', 'id', 'num'].includes(t));

    const aliases = new Set([raw, clean, clean.replace(/\s+/g, '_')]);

    tokens.forEach(t => aliases.add(t));

    // Role-based structural synonyms
    if (role === SEMANTIC_ROLES.MONETARY_METRIC) {
      aliases.add('amount');
      aliases.add('value');
    } else if (role === SEMANTIC_ROLES.TEMPORAL_DIMENSION) {
      aliases.add('date');
      aliases.add('time');
      aliases.add('period');
    }

    return Array.from(aliases);
  }
}

module.exports = new DatasetSemanticContextBuilder();
