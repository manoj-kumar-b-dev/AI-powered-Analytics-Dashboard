/**
 * Temporal Aggregation Executor
 *
 * Replaces the naive date grouping in analyticsService.generateCharts().
 *
 * Current bug: dates are grouped by exact value ($group: { _id: "$data.dateCol" })
 * which produces one data point per unique date — 365 points for a year of daily data —
 * then downsampled by skipping N-th points (loses data without aggregating).
 *
 * This module:
 *   1. Queries the actual date range (min, max) from the dataset
 *   2. Selects an appropriate granularity based on the date range
 *   3. Builds a MongoDB $dateToString pipeline that aggregates into the right buckets
 *   4. Sorts results chronologically
 *   5. Returns formatted x-axis labels
 *
 * Granularity thresholds:
 *   < 60 days   → day     ("%Y-%m-%d")
 *   < 180 days  → week    (ISO week composite)
 *   < 730 days  → month   ("%Y-%m")   ← default
 *   < 2000 days → quarter (computed)
 *   ≥ 2000 days → year    ("%Y")
 */

// ---------------------------------------------------------------------------
// Granularity selection
// ---------------------------------------------------------------------------

/**
 * Selects the appropriate temporal granularity based on the date range.
 *
 * @param {Date|null} minDate
 * @param {Date|null} maxDate
 * @returns {string} granularity key
 */
const selectGranularity = (minDate, maxDate) => {
  if (!minDate || !maxDate || isNaN(minDate.getTime()) || isNaN(maxDate.getTime())) return 'month';
  const days = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  if (days <= 730) return 'month';
  if (days <= 2000) return 'quarter';
  return 'year';
};

// ---------------------------------------------------------------------------
// MongoDB group _id builder per granularity
// ---------------------------------------------------------------------------

/**
 * Builds the MongoDB $group _id expression for the chosen granularity.
 *
 * @param {string} dateFieldPath - Full MongoDB field path (e.g. "$data.hire_date")
 * @param {string} granularity
 * @returns {*} MongoDB expression for $group _id
 */
const buildTemporalGroupId = (dateFieldPath, granularity) => {
  // Wrap with safe $convert to date so the pipeline works whether dates are stored
  // as ISO strings ("2025-01-03"), BSON Date objects, or formatted date strings.
  const asDate = {
    $convert: {
      input: dateFieldPath,
      to: 'date',
      onError: null,
      onNull: null
    }
  };

  switch (granularity) {
    case 'day':
      return { $dateToString: { format: '%Y-%m-%d', date: asDate } };

    case 'week':
      // Composite year+week key for sorting
      return {
        $concat: [
          { $toString: { $isoWeekYear: asDate } },
          '-W',
          {
            $cond: [
              { $lt: [{ $isoWeek: asDate }, 10] },
              { $concat: ['0', { $toString: { $isoWeek: asDate } }] },
              { $toString: { $isoWeek: asDate } }
            ]
          }
        ]
      };

    case 'month':
      return { $dateToString: { format: '%Y-%m', date: asDate } };

    case 'quarter': {
      // Build "YYYY-QN" string
      const quarterNum = { $ceil: { $divide: [{ $month: asDate }, 3] } };
      return {
        $concat: [
          { $toString: { $year: asDate } },
          '-Q',
          { $toString: quarterNum }
        ]
      };
    }

    case 'year':
      return { $dateToString: { format: '%Y', date: asDate } };

    default:
      return { $dateToString: { format: '%Y-%m', date: asDate } };
  }
};

// ---------------------------------------------------------------------------
// Label formatter
// ---------------------------------------------------------------------------

/**
 * Formats a raw temporal group _id value into a human-readable label.
 * The _id may be a string (from $dateToString) or a complex object.
 *
 * @param {*} rawId - The _id value from MongoDB aggregation
 * @param {string} granularity
 * @returns {string}
 */
const formatTemporalLabel = (rawId, granularity) => {
  if (rawId === null || rawId === undefined) return '(unknown)';
  if (typeof rawId === 'string') return rawId;
  if (rawId instanceof Date) {
    return rawId.toISOString().split('T')[0];
  }
  return String(rawId);
};

// ---------------------------------------------------------------------------
// Main pipeline builder
// ---------------------------------------------------------------------------

/**
 * Builds a complete MongoDB aggregation pipeline for a time-series chart.
 *
 * Replaces the naive $group + manual downsampling approach in analyticsService.
 *
 * @param {string} dateField  - Column name of the date field (without "$data." prefix)
 * @param {string|null} metricField - Column name of the metric (null = use count)
 * @param {string} aggregation - "sum" | "avg" | "count" | "min" | "max"
 * @param {Date|null} minDate
 * @param {Date|null} maxDate
 * @returns {{ pipeline: Array, granularity: string }}
 */
const buildTemporalPipeline = (dateField, metricField, aggregation, minDate, maxDate) => {
  const granularity = selectGranularity(minDate, maxDate);
  const dateFieldPath = `$data.${dateField}`;
  const groupId = buildTemporalGroupId(dateFieldPath, granularity);

  // Build the Y-axis aggregation expression
  let yAggExpr;
  const useCount = !metricField || metricField === '_count' || aggregation === 'count';

  if (useCount) {
    yAggExpr = { $sum: 1 };
  } else {
    const metricPath = `$data.${metricField}`;
    switch (aggregation) {
      case 'sum':  yAggExpr = { $sum: metricPath }; break;
      case 'avg':  yAggExpr = { $avg: metricPath }; break;
      case 'min':  yAggExpr = { $min: metricPath }; break;
      case 'max':  yAggExpr = { $max: metricPath }; break;
      default:     yAggExpr = { $sum: metricPath }; break;
    }
  }

  const pipeline = [
    // Filter out documents where the date field is null or missing
    { $match: { [`data.${dateField}`]: { $ne: null, $exists: true } } },
    // Group by temporal bucket and compute Y value
    {
      $group: {
        _id: groupId,
        yVal: yAggExpr,
        count: { $sum: 1 }
      }
    },
    // Exclude null/unparseable date buckets
    { $match: { _id: { $ne: null } } },
    // Project to standard { x, y } shape
    {
      $project: {
        _id: 0,
        x: '$_id',
        y: '$yVal',
        n: '$count'
      }
    },
    // Sort chronologically (string sort works for YYYY-MM-DD, YYYY-MM, YYYY, YYYY-QN, YYYY-WNN)
    { $sort: { x: 1 } }
  ];

  return { pipeline, granularity };
};

module.exports = { buildTemporalPipeline, selectGranularity, formatTemporalLabel };
