/**
 * Checks if a string representation represents a date
 */
const isDateString = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const str = val.toString().trim();
  if (/^\d{1,4}$/.test(str)) return false; // exclude simple years or short numbers
  const time = Date.parse(str);
  return !isNaN(time);
};

/**
 * Checks if a value is numeric (or currency / percentage)
 */
const isNumericVal = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const clean = val.toString().replace(/[\$,%\s]/g, '').trim();
  if (clean === '') return false;
  const num = Number(clean);
  return !isNaN(num) && isFinite(num);
};

/**
 * Automatically detects column types from dataset rows
 */
export const detectColumnTypes = (rows, headers) => {
  const columnTypes = {};
  const sampleCount = Math.min(rows.length, 100);

  headers.forEach(col => {
    const values = rows
      .slice(0, sampleCount)
      .map(r => r[col])
      .filter(v => v !== null && v !== undefined && v !== '');

    if (values.length === 0) {
      columnTypes[col] = 'Text';
      return;
    }

    let numericCount = 0;
    let integerCount = 0;
    let floatCount = 0;
    let currencyCount = 0;
    let percentageCount = 0;
    let dateCount = 0;
    let timeCount = 0;
    let booleanCount = 0;

    values.forEach(v => {
      const strVal = v.toString().trim();
      const lower = strVal.toLowerCase();

      // Boolean check
      if (['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(lower)) {
        booleanCount++;
      }

      // Percentage check
      if (strVal.endsWith('%')) {
        const num = Number(strVal.slice(0, -1).trim());
        if (!isNaN(num)) {
          percentageCount++;
          numericCount++;
        }
      }

      // Currency check
      const cleanCurrency = strVal.replace(/[\$\u20AC\u00A3\u00A5\u20BD\u20A8\u20B9,\s]/g, '');
      if (cleanCurrency !== strVal && !isNaN(Number(cleanCurrency)) && cleanCurrency !== '') {
        currencyCount++;
        numericCount++;
      }

      // General Numeric, Integer, Float check
      const num = Number(strVal.replace(/[\$,%\s]/g, '').trim());
      if (strVal.replace(/[\$,%\s]/g, '').trim() !== '' && !isNaN(num) && isFinite(num)) {
        numericCount++;
        if (Number.isInteger(num)) {
          integerCount++;
        } else {
          floatCount++;
        }
      }

      // Date check
      if (!/^\d{1,4}$/.test(strVal)) {
        const timestamp = Date.parse(strVal);
        if (!isNaN(timestamp)) {
          dateCount++;
        }
      }

      // Time check (matches formats like 14:30, 09:15:00, 2:45 PM, etc.)
      if (/^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s?[aApP][mM])?$/.test(strVal)) {
        timeCount++;
      }
    });

    const threshold = 0.75; // 75% match threshold
    const len = values.length;

    if (booleanCount / len >= threshold) {
      columnTypes[col] = 'Boolean';
    } else if (dateCount / len >= threshold) {
      columnTypes[col] = 'Date';
    } else if (timeCount / len >= threshold) {
      columnTypes[col] = 'Time';
    } else if (percentageCount / len >= threshold) {
      columnTypes[col] = 'Percentage';
    } else if (currencyCount / len >= threshold) {
      columnTypes[col] = 'Currency';
    } else if (floatCount / len >= threshold) {
      columnTypes[col] = 'Float';
    } else if (integerCount / len >= threshold) {
      columnTypes[col] = 'Integer';
    } else if (numericCount / len >= threshold) {
      columnTypes[col] = 'Numeric';
    } else {
      // Check cardinality for Categorical vs Text
      const uniqueValues = new Set(values);
      if (uniqueValues.size <= 15 || (uniqueValues.size / rows.length) <= 0.15) {
        columnTypes[col] = 'Category';
      } else {
        columnTypes[col] = 'Text';
      }
    }
  });

  return columnTypes;
};

/**
 * Recommends the most suitable chart type along with confidence scores and reasoning
 */
export const recommendChart = (detectedTypes, rows, headers) => {
  const dateCols = [];
  const timeCols = [];
  const numericCols = []; // Includes Numeric, Integer, Float, Currency, Percentage
  const percentageCols = [];
  const categoryCols = [];
  const textCols = [];
  const booleanCols = [];

  headers.forEach(col => {
    const type = detectedTypes[col];
    if (type === 'Date') dateCols.push(col);
    else if (type === 'Time') timeCols.push(col);
    else if (['Numeric', 'Integer', 'Float', 'Currency', 'Percentage'].includes(type)) {
      numericCols.push(col);
      if (type === 'Percentage') percentageCols.push(col);
    } else if (type === 'Category') categoryCols.push(col);
    else if (type === 'Text') textCols.push(col);
    else if (type === 'Boolean') booleanCols.push(col);
  });

  const findColInsensitive = (keywords) => {
    return headers.find(c => keywords.some(k => c.toLowerCase().includes(k)));
  };

  // Specific semantic matching
  const revenueCol = findColInsensitive(['revenue', 'sales_amount', 'amount', 'income', 'turnover', 'gross_sales']);
  const monthCol = findColInsensitive(['month', 'period']);
  const yearCol = findColInsensitive(['year']);
  const productCol = findColInsensitive(['product', 'item', 'sku']);
  const regionCol = findColInsensitive(['region', 'country', 'state', 'city', 'zone']);
  const salesCol = findColInsensitive(['sales', 'units_sold', 'units', 'qty', 'quantity', 'sales_count', 'transactions', 'volume']);

  // Case 1: Monthly Revenue -> Area Chart
  if (monthCol && revenueCol) {
    return {
      chartType: 'area',
      confidence: 99,
      reason: `Detected month column "${monthCol}" and revenue column "${revenueCol}". An Area Chart is best for showing monthly revenue accumulation.`,
      xField: monthCol,
      yField: revenueCol,
      aggregation: 'sum'
    };
  }

  // Case 2: Yearly Trends -> Line Chart
  if (yearCol && (revenueCol || salesCol || numericCols.length > 0)) {
    const yCol = revenueCol || salesCol || numericCols[0];
    return {
      chartType: 'line',
      confidence: 98,
      reason: `Detected yearly timeline column "${yearCol}" and numeric column "${yCol}". A Line Chart is ideal for showing continuous trends over years.`,
      xField: yearCol,
      yField: yCol,
      aggregation: 'sum'
    };
  }

  // Case 3: Top Products -> Horizontal Bar Chart
  if (productCol && (salesCol || revenueCol || numericCols.length > 0)) {
    const yCol = salesCol || revenueCol || numericCols[0];
    return {
      chartType: 'horizontal-bar',
      confidence: 97,
      reason: `Detected product column "${productCol}" and metric column "${yCol}". A Horizontal Bar Chart cleanly displays ranking of top products.`,
      xField: productCol,
      yField: yCol,
      aggregation: 'sum'
    };
  }

  // Case 4: Sales by Region -> Pie Chart
  if (regionCol && (salesCol || revenueCol || numericCols.length > 0)) {
    const yCol = salesCol || revenueCol || numericCols[0];
    return {
      chartType: 'pie',
      confidence: 96,
      reason: `Detected region column "${regionCol}" and metric column "${yCol}". A Pie Chart is ideal for displaying market share or distributions by region.`,
      xField: regionCol,
      yField: yCol,
      aggregation: 'sum'
    };
  }

  // Case 5: Date + Number -> Line Chart
  if (dateCols.length > 0 && numericCols.length > 0) {
    return {
      chartType: 'line',
      confidence: 95,
      reason: `Detected Date column "${dateCols[0]}" and Numeric column "${numericCols[0]}". Line charts are standard for visualizing continuous values changing over dates.`,
      xField: dateCols[0],
      yField: numericCols[0],
      aggregation: 'sum'
    };
  }

  // Case 6: Two Numeric Columns -> Scatter Chart
  if (numericCols.length >= 2) {
    return {
      chartType: 'scatter',
      confidence: 92,
      reason: `Detected two numeric columns ("${numericCols[0]}" and "${numericCols[1]}"). A Scatter Chart displays the correlation between these two numeric variables.`,
      xField: numericCols[0],
      yField: numericCols[1],
      aggregation: 'none'
    };
  }

  // Case 7: Category + Percentage -> Pie Chart
  if (categoryCols.length > 0 && percentageCols.length > 0) {
    return {
      chartType: 'pie',
      confidence: 90,
      reason: `Detected Category column "${categoryCols[0]}" and Percentage column "${percentageCols[0]}". Pie charts represent percentage distributions of categories perfectly.`,
      xField: categoryCols[0],
      yField: percentageCols[0],
      aggregation: 'avg'
    };
  }

  // Case 8: Many Categories -> Horizontal Bar Chart (Cardinality check)
  if (categoryCols.length > 0 && numericCols.length > 0) {
    const catCol = categoryCols[0];
    const uniqueVals = new Set(rows.map(r => r[catCol]).filter(v => v !== null && v !== undefined));
    if (uniqueVals.size > 8) {
      return {
        chartType: 'horizontal-bar',
        confidence: 88,
        reason: `Detected Category column "${catCol}" with many (${uniqueVals.size}) values and Numeric column "${numericCols[0]}". Horizontal Bar charts prevent label overlaps.`,
        xField: catCol,
        yField: numericCols[0],
        aggregation: 'sum'
      };
    }
  }

  // Case 9: Category + Number -> Bar Chart
  if (categoryCols.length > 0 && numericCols.length > 0) {
    return {
      chartType: 'bar',
      confidence: 94,
      reason: `Detected Category column "${categoryCols[0]}" and Numeric column "${numericCols[0]}". A vertical Bar Chart displays comparisons across categories.`,
      xField: categoryCols[0],
      yField: numericCols[0],
      aggregation: 'sum'
    };
  }

  // Case 10: One Numeric Column -> Histogram
  if (numericCols.length === 1) {
    return {
      chartType: 'histogram',
      confidence: 85,
      reason: `Detected exactly one Numeric column "${numericCols[0]}". A Histogram displays the frequency distribution of this numeric field.`,
      xField: numericCols[0],
      yField: '_count',
      aggregation: 'count'
    };
  }

  // Fallback 1: Category + row count Bar Chart
  if (categoryCols.length > 0) {
    return {
      chartType: 'bar',
      confidence: 75,
      reason: `Detected Categorical column "${categoryCols[0]}". Generating a Bar chart showing the count of records per category.`,
      xField: categoryCols[0],
      yField: '_count',
      aggregation: 'count'
    };
  }

  // Fallback 2: Any Text column + count Bar Chart
  if (textCols.length > 0) {
    return {
      chartType: 'bar',
      confidence: 60,
      reason: `No clear metrics. Generating a Bar chart showing the frequency of "${textCols[0]}".`,
      xField: textCols[0],
      yField: '_count',
      aggregation: 'count'
    };
  }

  // Empty state fallback
  return {
    chartType: 'none',
    confidence: 0,
    reason: 'No suitable columns found to visualize. Try uploading a dataset with Category/Date columns and Numeric columns.',
    xField: '',
    yField: '',
    aggregation: 'count'
  };
};

/**
 * Aggregates dataset rows efficiently with filtering, grouping, and sorting options
 */
export const aggregateData = (rows, xField, yField, aggregation, groupBy, filters = {}, sortConfig = null) => {
  if (!rows || rows.length === 0 || !xField) return [];

  // 1. Filter rows
  let filtered = rows;
  const filterEntries = Object.entries(filters).filter(([_, val]) => val !== null && val !== undefined && val !== '');

  if (filterEntries.length > 0) {
    filtered = rows.filter(row => {
      return filterEntries.every(([col, filterVal]) => {
        const cellVal = row[col];
        if (cellVal === null || cellVal === undefined) return false;
        return cellVal.toString().toLowerCase().includes(filterVal.toString().toLowerCase());
      });
    });
  }

  // 2. Unaggregated listing (e.g. for Scatter Chart)
  if (aggregation === 'none') {
    let result = filtered.map(row => {
      const xVal = row[xField];
      const yVal = yField ? row[yField] : null;

      const cleanX = xVal !== null && xVal !== undefined ? xVal.toString().replace(/[\$,%\s]/g, '') : '0';
      const cleanY = yVal !== null && yVal !== undefined ? yVal.toString().replace(/[\$,%\s]/g, '') : '0';

      const parsedX = Number(cleanX);
      const parsedY = Number(cleanY);

      return {
        x: isNaN(parsedX) ? xVal : parsedX,
        y: isNaN(parsedY) ? yVal : parsedY
      };
    });

    if (result.length > 150) {
      result = result.slice(0, 150);
    }
    return result;
  }

  // 3. Group and aggregate
  const groups = new Map();

  for (let i = 0; i < filtered.length; i++) {
    const row = filtered[i];
    let key = row[xField];
    if (key === null || key === undefined || key === '') {
      key = '(Blank)';
    } else {
      key = key.toString();
    }

    // Resolve Y value
    let val = 0;
    if (yField && yField !== '_count') {
      const rawVal = row[yField];
      if (rawVal !== null && rawVal !== undefined) {
        const clean = rawVal.toString().replace(/[\$,%\s]/g, '');
        const parsed = Number(clean);
        val = isNaN(parsed) ? 0 : parsed;
      }
    } else {
      val = 1; // for record count
    }

    // Resolve groupBy series sub-key
    let groupByKey = null;
    if (groupBy) {
      groupByKey = row[groupBy];
      if (groupByKey === null || groupByKey === undefined || groupByKey === '') {
        groupByKey = 'Other';
      } else {
        groupByKey = groupByKey.toString();
      }
    }

    if (!groups.has(key)) {
      groups.set(key, {
        sum: 0,
        count: 0,
        values: [],
        series: {}
      });
    }

    const groupObj = groups.get(key);
    groupObj.count += 1;
    groupObj.sum += val;
    groupObj.values.push(val);

    if (groupByKey) {
      if (!groupObj.series[groupByKey]) {
        groupObj.series[groupByKey] = { sum: 0, count: 0 };
      }
      groupObj.series[groupByKey].sum += val;
      groupObj.series[groupByKey].count += 1;
    }
  }

  // 4. Construct Output array
  const aggregatedList = [];
  groups.forEach((stats, key) => {
    let finalVal = 0;
    if (aggregation === 'sum') {
      finalVal = stats.sum;
    } else if (aggregation === 'avg') {
      finalVal = stats.count > 0 ? stats.sum / stats.count : 0;
    } else if (aggregation === 'count') {
      finalVal = stats.count;
    } else {
      finalVal = stats.values[0] || 0;
    }

    const item = {
      x: key,
      y: finalVal,
      _count: stats.count
    };

    if (groupBy) {
      Object.keys(stats.series).forEach(subKey => {
        const subStats = stats.series[subKey];
        let subVal = 0;
        if (aggregation === 'sum') {
          subVal = subStats.sum;
        } else if (aggregation === 'avg') {
          subVal = subStats.count > 0 ? subStats.sum / subStats.count : 0;
        } else if (aggregation === 'count') {
          subVal = subStats.count;
        }
        item[subKey] = subVal;
      });
    }

    aggregatedList.push(item);
  });

  // 5. Sorting
  if (sortConfig) {
    const { key: sortKey, direction } = sortConfig;
    aggregatedList.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      const numA = Number(valA);
      const numB = Number(valB);

      if (!isNaN(numA) && !isNaN(numB)) {
        return direction === 'asc' ? numA - numB : numB - numA;
      }

      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Downsampling logic for safety
  if (aggregatedList.length > 150) {
    const isTimeline = xField.toLowerCase().includes('date') || xField.toLowerCase().includes('time') || xField.toLowerCase().includes('month') || xField.toLowerCase().includes('year');
    if (isTimeline) {
      const step = Math.ceil(aggregatedList.length / 150);
      return aggregatedList.filter((_, idx) => idx % step === 0).slice(0, 150);
    } else {
      const topRows = aggregatedList.slice(0, 149);
      const otherRows = aggregatedList.slice(149);
      const otherSum = otherRows.reduce((acc, row) => acc + row.y, 0);
      const otherCount = otherRows.reduce((acc, row) => acc + row._count, 0);
      topRows.push({
        x: 'Other Categories',
        y: otherSum,
        _count: otherCount
      });
      return topRows;
    }
  }

  return aggregatedList;
};

/**
 * Calculates dataset statistics, outliers, missing fields, and qualitative insights
 */
export const generateInsights = (aggregatedData, rawRows, xField, yField, detectedTypes) => {
  if (!aggregatedData || aggregatedData.length === 0) return null;

  // Extract values
  const yValues = aggregatedData.map(item => item.y).filter(v => typeof v === 'number');
  const total = yValues.reduce((a, b) => a + b, 0);
  const count = yValues.length;
  const average = count > 0 ? total / count : 0;

  // Median calculation
  let median = 0;
  if (count > 0) {
    const sorted = [...yValues].sort((a, b) => a - b);
    const mid = Math.floor(count / 2);
    median = count % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Highest & Lowest
  let highest = { x: 'N/A', y: -Infinity };
  let lowest = { x: 'N/A', y: Infinity };
  aggregatedData.forEach(item => {
    if (typeof item.y === 'number') {
      if (item.y > highest.y) highest = { x: item.x, y: item.y };
      if (item.y < lowest.y) lowest = { x: item.x, y: item.y };
    }
  });
  if (highest.y === -Infinity) highest = { x: 'N/A', y: 0 };
  if (lowest.y === Infinity) lowest = { x: 'N/A', y: 0 };

  // Outliers calculation (Using 2 Standard Deviations)
  let outliers = [];
  if (count > 2) {
    const variance = yValues.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) {
      aggregatedData.forEach(item => {
        if (typeof item.y === 'number' && Math.abs(item.y - average) > 2 * stdDev) {
          outliers.push(`${item.x} (${item.y.toLocaleString()})`);
        }
      });
    }
  }

  // Missing values (Calculate over rawRows and headers)
  let missingCount = 0;
  if (rawRows && rawRows.length > 0) {
    const cols = Object.keys(rawRows[0] || {});
    rawRows.forEach(row => {
      cols.forEach(col => {
        const val = row[col];
        if (val === null || val === undefined || val.toString().trim() === '') {
          missingCount++;
        }
      });
    });
  }

  // Growth calculation (if timeline)
  let growthPct = 0;
  const isTimeline = xField && (xField.toLowerCase().includes('date') || xField.toLowerCase().includes('month') || xField.toLowerCase().includes('year'));
  if (isTimeline && count >= 2) {
    const firstY = yValues[0];
    const lastY = yValues[yValues.length - 1];
    if (firstY !== 0) {
      growthPct = ((lastY - firstY) / firstY) * 100;
    }
  }

  // Generate Rich NLP bullet points
  const bulletInsights = [];
  const yName = yField && yField !== '_count' ? yField : 'Record Count';

  // Growth insight
  if (isTimeline && Math.abs(growthPct) > 1) {
    const dir = growthPct > 0 ? 'increased' : 'decreased';
    bulletInsights.push(`${yName} ${dir} ${Math.abs(growthPct).toFixed(1)}% across the dataset timeline.`);
  }

  // Peak / Highest performer insight
  if (highest.x !== 'N/A') {
    bulletInsights.push(`Highest value recorded at "${highest.x}" with a total of ${highest.y.toLocaleString()}.`);
  }

  // Contribution of top category
  if (highest.y > 0 && total > 0) {
    const share = (highest.y / total) * 100;
    if (share >= 30) {
      bulletInsights.push(`"${highest.x}" contributes a significant ${share.toFixed(0)}% of the total aggregate.`);
    }
  }

  // Region specific insight
  if (xField && xField.toLowerCase().includes('region') && highest.x !== 'N/A') {
    bulletInsights.push(`Geography report shows "${highest.x}" region is the top performer.`);
  }

  // Expense vs Revenue comparison if raw rows contain both
  if (rawRows && rawRows.length > 0) {
    const cols = Object.keys(rawRows[0] || {});
    const revenueCol = cols.find(c => ['revenue', 'sales_amount', 'sales'].includes(c.toLowerCase()));
    const expenseCol = cols.find(c => ['expense', 'expenses', 'cost'].includes(c.toLowerCase()));
    const dateCol = cols.find(c => ['date', 'time', 'month', 'year'].includes(c.toLowerCase()));

    if (revenueCol && expenseCol) {
      // Summarize first half vs second half
      let firstHalfRev = 0, firstHalfExp = 0;
      let secondHalfRev = 0, secondHalfExp = 0;
      const midIdx = Math.floor(rawRows.length / 2);

      rawRows.forEach((r, idx) => {
        const rev = Number((r[revenueCol] || '0').toString().replace(/[\$,%\s]/g, '')) || 0;
        const exp = Number((r[expenseCol] || '0').toString().replace(/[\$,%\s]/g, '')) || 0;

        if (idx < midIdx) {
          firstHalfRev += rev;
          firstHalfExp += exp;
        } else {
          secondHalfRev += rev;
          secondHalfExp += exp;
        }
      });

      const revGrowth = firstHalfRev !== 0 ? ((secondHalfRev - firstHalfRev) / firstHalfRev) * 100 : 0;
      const expGrowth = firstHalfExp !== 0 ? ((secondHalfExp - firstHalfExp) / firstHalfExp) * 100 : 0;

      if (expGrowth > revGrowth) {
        bulletInsights.push(`Expenses are rising faster than revenue (${expGrowth.toFixed(1)}% expenses vs ${revGrowth.toFixed(1)}% revenue).`);
      }
    }
  }

  // Outliers indicator
  if (outliers.length > 0) {
    bulletInsights.push(`Identified ${outliers.length} statistical outliers, including values at: ${outliers.slice(0, 3).join(', ')}.`);
  }

  // Missing values indicator
  if (missingCount > 0) {
    bulletInsights.push(`Warning: Detected ${missingCount.toLocaleString()} missing values in dataset fields.`);
  }

  // If no specific bullet was generated, put fallback
  if (bulletInsights.length === 0) {
    bulletInsights.push(`Dataset distribution is stable with average metric of ${average.toFixed(1)}.`);
  }

  return {
    total,
    average,
    median,
    highest,
    lowest,
    growthPct,
    outliers,
    missingCount,
    bulletInsights
  };
};

/**
 * Validates dataset rows against headers and detected column types
 */
export const validateDataset = (rows, headers, columnTypes) => {
  const errors = [];

  rows.forEach((row, rIdx) => {
    const rowNum = rIdx + 2; // 2 because 1-indexed and header row is row 1

    headers.forEach(col => {
      const val = row[col];
      const type = columnTypes[col];

      if (val === null || val === undefined || val.toString().trim() === '') {
        errors.push({
          row: rowNum,
          column: col,
          value: '',
          type: 'Missing Value',
          message: `Value in column '${col}' is missing`
        });
        return;
      }

      let isInvalid = false;
      let errorType = 'Type Mismatch';
      let expected = '';

      if (type === 'Numeric' && !isNumericVal(val)) {
        isInvalid = true;
        expected = 'a numeric format';
      } else if (type === 'Integer') {
        const num = Number(val.toString().replace(/[\$,%\s]/g, '').trim());
        if (isNaN(num) || !Number.isInteger(num)) {
          isInvalid = true;
          expected = 'an integer';
        }
      } else if (type === 'Float') {
        const num = Number(val.toString().replace(/[\$,%\s]/g, '').trim());
        if (isNaN(num)) {
          isInvalid = true;
          expected = 'a decimal number';
        }
      } else if (type === 'Currency') {
        const clean = val.toString().replace(/[\$\u20AC\u00A3\u00A5\u20BD\u20A8\u20B9,\s]/g, '');
        if (clean === '' || isNaN(Number(clean))) {
          isInvalid = true;
          expected = 'a currency representation';
        }
      } else if (type === 'Percentage') {
        const str = val.toString().trim();
        if (!str.endsWith('%') || isNaN(Number(str.slice(0, -1).trim()))) {
          isInvalid = true;
          expected = 'a percentage (e.g. 15%)';
        }
      } else if (type === 'Date' && !isDateString(val)) {
        isInvalid = true;
        errorType = 'Invalid Date';
        expected = 'a parseable date';
      } else if (type === 'Time') {
        if (!/^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s?[aApP][mM])?$/.test(val.toString().trim())) {
          isInvalid = true;
          expected = 'a time format (HH:MM)';
        }
      } else if (type === 'Boolean') {
        const lower = val.toString().trim().toLowerCase();
        if (!['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(lower)) {
          isInvalid = true;
          expected = 'a boolean value';
        }
      }

      if (isInvalid) {
        errors.push({
          row: rowNum,
          column: col,
          value: val.toString(),
          type: errorType,
          message: `Value '${val}' does not match inferred column type '${type}' (expected ${expected})`
        });
      }
    });
  });

  return errors;
};
