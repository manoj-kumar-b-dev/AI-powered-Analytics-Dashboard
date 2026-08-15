const llmService = require('./llmService');
const analysisEngine = require('./analysisEngine');
const datasetRepository = require('../repositories/datasetRepository');

const datasetSemanticContextBuilder = require('./askAi/datasetSemanticContext');
const analyticalContextBuilder = require('./askAi/analyticalContext');
const conversationContextBuilder = require('./askAi/conversationContext');
const llmQueryPlanner = require('./askAi/queryPlanner/llmQueryPlanner');
const queryPlanValidator = require('./askAi/validation/queryPlanValidator');
const queryExecutor = require('./askAi/execution/queryExecutor');
const chatAnswerContextBuilder = require('./askAi/response/answerContext');
const answerGenerator = require('./askAi/response/answerGenerator');

/**
 * Universal Service to process natural language questions about tabular datasets.
 * Leverages Universal Dataset Semantic Context, LLM Query Planning,
 * Strict Query Plan Validation, and Safe Deterministic Math Execution.
 */
class AskAiService {
  /**
   * Main entry point to process a question against a dataset.
   * @param {Object} dataset - Dataset document
   * @param {string} question - User question
   * @param {string} ownerId - User ID
   * @param {Array<Object>} history - Recent multi-turn chat history
   */
  async askQuestion(dataset, question, ownerId, history = []) {
    const datasetId = dataset._id;
    const rows = await datasetRepository.getAllDatasetRows(datasetId, ownerId);

    // 1. Build Universal Dataset Semantic Context
    const semanticContext = datasetSemanticContextBuilder.buildContext(dataset.columns, rows);

    // 2. Build Dataset Analytical Context
    const analyticalContext = analyticalContextBuilder.buildContext(semanticContext);

    // 3. Build Conversation Context (bounded recent turns)
    const conversationContext = conversationContextBuilder.buildContext(history);

    // 4. Extract & Validate Structured Query Plan
    let queryPlan = null;

    if (llmService.isAvailable()) {
      try {
        const rawPlan = await llmQueryPlanner.plan(question, semanticContext, analyticalContext, conversationContext);
        const valResult = queryPlanValidator.validate(rawPlan, semanticContext);
        if (valResult.isValid || valResult.confidence > 0.5) {
          queryPlan = valResult.sanitizedPlan;
        }
      } catch (err) {
        console.warn('[AskAiService] LLM Query Planning failed. Fallback to rule engine:', err.message);
      }
    }

    // Fallback Rule Engine if LLM planner omitted or failed
    if (!queryPlan) {
      const fallbackOp = this._extractOperationWithRules(question, dataset.columns);
      const rawPlan = {
        intent: fallbackOp.action,
        metric: { column: fallbackOp.metric, aggregation: fallbackOp.aggregation || 'sum' },
        dimension: { column: fallbackOp.groupBy },
        temporal: { column: fallbackOp.dateColumn, filter: fallbackOp.dateFilter },
        filter: { column: fallbackOp.filterColumn, value: fallbackOp.filterValue },
        sort: { direction: fallbackOp.direction || 'desc' },
        limit: fallbackOp.limit || 5
      };
      const valResult = queryPlanValidator.validate(rawPlan, semanticContext);
      queryPlan = valResult.sanitizedPlan;
    }

    // 5. Execute validated Query Plan on Deterministic Execution Engine
    const executionResult = queryExecutor.execute(queryPlan, rows, dataset.columns);

    // 6. Synthesize Evidence-Backed Plain-English Answer
    const answerContext = chatAnswerContextBuilder.buildContext(question, queryPlan, executionResult, conversationContext);
    const answerAndInsights = await answerGenerator.generate(answerContext);

    return {
      answer: answerAndInsights.answer,
      insights: answerAndInsights.insights,
      analysis: executionResult.analysis,
      chart: executionResult.chart,
      methodology: executionResult.methodology,
      queryPlan
    };
  }

  /**
   * Prompt LLM to select ONLY from approved tool/function operations.
   */
  async _extractOperationWithLLM(contextPrompt, columnsSchema) {
    const systemInstruction = `You are a data analysis function selector.
Analyze the user question and dataset schema. Choose exactly ONE operation from these approved operations:

1. group_by: { "action": "group_by", "groupBy": string, "metric": string, "aggregation": "sum"|"avg"|"min"|"max"|"count" }
2. compare_periods: { "action": "compare_periods", "dateColumn": string, "metric": string, "periodType": "monthly"|"quarterly"|"yearly" }
3. filter_and_aggregate: { "action": "filter_and_aggregate", "filterColumn": string, "filterValue": string|number, "metric": string, "aggregation": "sum"|"avg"|"min"|"max"|"count" }
4. top_n: { "action": "top_n", "groupBy": string, "metric": string, "limit": number, "direction": "desc"|"asc" }

Requirements:
- Output MUST be raw JSON object matching one of the 4 formats above.
- Column names MUST strictly match existing column names in the schema.
- Do NOT output markdown or extra commentary.`;

    const rawResponse = await llmService.generate(`${systemInstruction}\n\n${contextPrompt}`);
    return rawResponse;
  }

  /**
   * Helper to perform token & synonym matching against column names
   */
  _findBestMatchingColumn(colList, questionText, isCategorical = false) {
    if (!Array.isArray(colList) || colList.length === 0) return null;
    const qClean = questionText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

    let bestCol = null;
    let maxScore = 0;

    for (const col of colList) {
      const colClean = col.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const colTokens = colClean.split(/\s+/).filter(t => t.length > 1 && t !== 'inr' && t !== 'usd' && t !== 'id' && t !== 'num');

      let score = 0;
      for (const t of colTokens) {
        if (qClean.includes(t)) score += 3;
      }

      // Synonym boost rules
      if (/salary|pay|compensation|payroll/i.test(qClean) && /salary|pay|compensation|payroll/i.test(colClean)) score += 10;
      if (/revenue|sales|income|earning/i.test(qClean) && /revenue|sales|income|earning/i.test(colClean)) score += 10;
      if (/unit price|price/i.test(qClean) && /price|unit/i.test(colClean)) score += 10;
      if (/actual|spend|expense|cost/i.test(qClean) && /actual|spend|expense|cost/i.test(colClean)) score += 10;
      if (/budget/i.test(qClean) && /budget/i.test(colClean)) score += 10;
      if (/rating|performance|score/i.test(qClean) && /rating|performance|score/i.test(colClean)) score += 10;
      if (/headcount|count|number of|employee/i.test(qClean) && /count|employee|department|role/i.test(colClean)) score += 5;
      if (/impression|click|ctr|cpc/i.test(qClean) && /impression|click|ctr|cpc/i.test(colClean)) score += 10;
      if (/product|item|sku/i.test(qClean) && /product|item|sku/i.test(colClean)) score += 10;
      if (/region|location|country|area/i.test(qClean) && /region|location|country|area/i.test(colClean)) score += 10;
      if (/customer|client|name|user/i.test(qClean) && /customer|client|name|user/i.test(colClean)) score += 10;

      if (score > maxScore) {
        maxScore = score;
        bestCol = col;
      }
    }

    if (maxScore > 0) return bestCol;
    return isCategorical ? null : colList[0];
  }

  /**
   * Helper to parse date / month filters from user questions.
   * e.g. "jan 2026", "january 2026", "2025", "Q1 2026"
   */
  _extractDateFilter(questionText) {
    if (!questionText) return null;
    const qLower = questionText.toLowerCase();

    const monthMap = {
      jan: '01', january: '01',
      feb: '02', february: '02',
      mar: '03', march: '03',
      apr: '04', april: '04',
      may: '05',
      jun: '06', june: '06',
      jul: '07', july: '07',
      aug: '08', august: '08',
      sep: '09', sept: '09', september: '09',
      oct: '10', october: '10',
      nov: '11', november: '11',
      dec: '12', december: '12'
    };

    // Match patterns like "jan 2026", "january 2026", "jan-2026", "01/2026"
    const monthYearMatch = qLower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[-/\s,]+(20\d\d|\d\d)\b/);
    if (monthYearMatch) {
      const monthStr = monthMap[monthYearMatch[1]];
      let yearStr = monthYearMatch[2];
      if (yearStr.length === 2) yearStr = '20' + yearStr;
      return `${yearStr}-${monthStr}`;
    }

    // Match year alone like "2026" or "in 2025"
    const yearMatch = qLower.match(/\b(202\d)\b/);
    if (yearMatch) {
      return yearMatch[1];
    }

    return null;
  }

  /**
   * Rule-based intent parser to extract analytical operation when LLM is offline.
   */
  _extractOperationWithRules(question, columnsSchema) {
    const qLower = question.toLowerCase();
    const numCols = columnsSchema.filter(c => c.type === 'number').map(c => c.name);
    const catCols = columnsSchema.filter(c => c.type === 'string' || c.type === 'boolean').map(c => c.name);
    const dateCols = columnsSchema.filter(c => c.type === 'date').map(c => c.name);

    const primaryMetric = this._findBestMatchingColumn(numCols, question, false);
    const primaryGroup = this._findBestMatchingColumn(catCols, question, true);
    const primaryDate = this._findBestMatchingColumn(dateCols, question, true) || dateCols[0];

    const dateFilter = this._extractDateFilter(question);
    const fallbackDateCol = dateCols[0] || 'Date';

    // 1. Check for compare periods / time series / trend / date / drop intent FIRST
    if (primaryDate && /month|year|date|time|trend|drop|fall|decline|decrease|period|over time|daily|monthly|yearly/i.test(qLower) && !dateFilter) {
      return {
        action: 'compare_periods',
        dateColumn: primaryDate,
        metric: primaryMetric,
        periodType: 'monthly'
      };
    }

    // 2. Check for top N intent (top, best, highest, worst, bottom, lowest, first)
    if (/top|best|highest|worst|bottom|lowest|first/i.test(qLower)) {
      const matchNum = qLower.match(/\b([1-9]|10)\b/);
      const limit = matchNum ? parseInt(matchNum[1]) : 5;
      const isAsc = /worst|bottom|lowest/i.test(qLower);
      const isCount = /headcount|count|number of|volume|share|employee/i.test(qLower);

      return {
        action: 'top_n',
        groupBy: primaryGroup || catCols[0],
        metric: isCount ? null : primaryMetric,
        limit,
        direction: isAsc ? 'asc' : 'desc',
        dateColumn: primaryDate || fallbackDateCol,
        dateFilter: dateFilter || null
      };
    }

    // 3. If no categorical dimension was mentioned in the question, run an overall_summary analysis!
    if (!primaryGroup) {
      let agg = 'sum';
      if (/avg|average|mean|unit price|price/i.test(qLower)) agg = 'avg';
      if (/min|minimum|least/i.test(qLower)) agg = 'min';
      if (/max|maximum|most/i.test(qLower)) agg = 'max';
      if (/count|number of|how many|total rows/i.test(qLower)) agg = 'count';

      return {
        action: 'overall_summary',
        metric: primaryMetric,
        aggregation: agg,
        dateColumn: primaryDate || fallbackDateCol,
        dateFilter: dateFilter || null
      };
    }

    // 4. Default to group_by
    let agg = 'sum';
    if (/avg|average|mean/i.test(qLower)) agg = 'avg';
    if (/min|minimum|least/i.test(qLower)) agg = 'min';
    if (/max|maximum|most/i.test(qLower)) agg = 'max';
    if (/count|number of|how many|headcount/i.test(qLower)) agg = 'count';

    return {
      action: 'group_by',
      groupBy: primaryGroup || catCols[0],
      metric: primaryMetric,
      aggregation: agg,
      dateColumn: primaryDate || fallbackDateCol,
      dateFilter: dateFilter || null
    };
  }

  /**
   * Synthesize concise plain-English explanation using LLM.
   */
  async _generateExplanationWithLLM(question, analysisResult) {
    const prompt = `You are a senior business intelligence analyst.
The user asked: "${question}"
Executed analysis: ${JSON.stringify(analysisResult.analysis)}
Methodology: ${analysisResult.methodology}

Respond with valid JSON only in this structure:
{
  "answer": "Direct, punchy plain-English answer summarizing the main finding in 1 sentence.",
  "insights": [
    "Insight bullet 1 highlighting a key comparison, percentage, or pattern.",
    "Insight bullet 2 highlighting another key takeaway."
  ]
}`;

    const raw = await llmService.generate(prompt);
    if (raw && raw.answer && Array.isArray(raw.insights)) {
      return raw;
    }
    throw new Error('LLM returned invalid explanation shape');
  }

  /**
   * Fallback explanation generator.
   */
  _generateExplanationWithRules(question, analysisResult) {
    const { action, result = [], metric, groupBy, targetVal, totalValue, avgValue, totalRows, aggregation, dateFilter } = analysisResult.analysis;

    if (action === 'overall_summary') {
      const formattedValue = typeof targetVal === 'number' ? targetVal.toLocaleString('en-IN') : (totalValue?.toLocaleString('en-IN') || '0');
      const formattedAvg = typeof avgValue === 'number' ? avgValue.toLocaleString('en-IN') : '0';
      const metricLabel = (metric || 'Value').replace(/_/g, ' ');
      const scopeDesc = dateFilter ? `for ${dateFilter}` : `across ${totalRows || 400} dataset records`;

      return {
        answer: `Total ${metricLabel} ${scopeDesc} is ${formattedValue} (Average per record: ${formattedAvg}).`,
        insights: [
          `Total accumulated ${metricLabel} across ${totalRows || 400} active dataset rows reaches ${totalValue?.toLocaleString('en-IN') || formattedValue}.`,
          `Evaluated across ${totalRows || 400} dataset rows with minimum value ${result?.[2]?.Value || 0} and maximum value ${result?.[3]?.Value || 0}.`
        ]
      };
    }

    if (!result || result.length === 0) {
      return {
        answer: "No specific data points were found matching your criteria.",
        insights: ["Check if your dataset contains rows matching this query."]
      };
    }

    const topItem = result[0];
    const topName = topItem[groupBy] || topItem['Period'] || 'Top category';
    const topVal = topItem[metric || 'Value'] || topItem['Count'] || 0;
    const formattedVal = typeof topVal === 'number' ? topVal.toLocaleString('en-IN') : topVal;

    if (action === 'compare_periods') {
      const metricLabel = (metric || 'Value').replace(/_/g, ' ');
      const isDropQuery = /drop|fall|decline|decrease|why/i.test(question);
      let sharpestDrop = null;
      let minChange = 0;

      result.forEach((p, idx) => {
        if (p['Change %'] < minChange) {
          minChange = p['Change %'];
          sharpestDrop = { ...p, prev: result[idx - 1] };
        }
      });

      if (isDropQuery && sharpestDrop) {
        const dropPeriod = sharpestDrop.Period;
        const prevPeriod = sharpestDrop.prev ? sharpestDrop.prev.Period : 'prior period';
        const prevVal = sharpestDrop.prev ? sharpestDrop.prev[metric || 'Value'] : 0;
        const curVal = sharpestDrop[metric || 'Value'];

        return {
          answer: `${metricLabel} experienced its sharpest decline in ${dropPeriod}, dropping by ${Math.abs(minChange)}% compared to ${prevPeriod} (from ${prevVal.toLocaleString('en-IN')} to ${curVal.toLocaleString('en-IN')}).`,
          insights: [
            `Primary performance contraction occurred in ${dropPeriod} with a ${Math.abs(minChange)}% period-over-period fall.`,
            `Evaluated across all ${result.length} time periods in the uploaded dataset.`
          ]
        };
      }

      const lastItem = result[result.length - 1];
      const changePct = lastItem['Change %'] || 0;
      const isUp = changePct >= 0;

      return {
        answer: `Over time, ${metricLabel} reached ${lastItem[metric || 'Value']?.toLocaleString('en-IN')} in ${lastItem.Period} (${isUp ? '+' : ''}${changePct}% vs prior period).`,
        insights: [
          `Peak performance occurred in ${topName} with ${formattedVal} total ${metricLabel}.`,
          `Evaluated across ${result.length} distinct time periods in the dataset.`
        ]
      };
    }

    if (action === 'top_n') {
      return {
        answer: `${topName} leads as the top-ranked item with a total value of ${formattedVal}.`,
        insights: [
          `${topName} represents the highest contribution for ${metric || 'this metric'}.`,
          `Evaluated across the top ${result.length} performing segments in the dataset.`
        ]
      };
    }

    // Default group_by explanation
    const secondItem = result[1];
    let secondaryInsight = `Total across all ${result.length} categories analyzed.`;
    if (secondItem) {
      const secondName = secondItem[groupBy] || 'Runner up';
      const secondVal = secondItem[metric || 'Value'] || secondItem['Count'] || 0;
      const diffPct = topVal > 0 ? Math.round(((topVal - secondVal) / topVal) * 100) : 0;
      secondaryInsight = `${topName} generated ${diffPct}% more volume than ${secondName}.`;
    }

    return {
      answer: `${topName} is the best-performing ${groupBy || 'segment'} with total ${metric || 'value'} of ${formattedVal}.`,
      insights: [
        secondaryInsight,
        `${topName} leads all groups in the uploaded dataset.`
      ]
    };
  }

  _computeColumnSummaries(columns, sampleRows) {
    const summaries = {};
    columns.forEach(col => {
      const vals = sampleRows.map(r => r[col.name]).filter(v => v !== null && v !== undefined);
      if (col.type === 'number') {
        const numVals = vals.map(Number).filter(n => !isNaN(n));
        summaries[col.name] = {
          min: numVals.length ? Math.min(...numVals) : 0,
          max: numVals.length ? Math.max(...numVals) : 0,
          sampleCount: numVals.length
        };
      } else {
        const unique = Array.from(new Set(vals.map(String)));
        summaries[col.name] = {
          uniqueCount: unique.length,
          sampleValues: unique.slice(0, 5)
        };
      }
    });
    return summaries;
  }
}

module.exports = new AskAiService();
