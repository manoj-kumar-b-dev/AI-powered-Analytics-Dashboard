const { geminiGenerate, isGeminiAvailable } = require('../config/gemini');
const analysisEngine = require('./analysisEngine');
const datasetRepository = require('../repositories/datasetRepository');

/**
 * Service to process natural language questions about datasets.
 * Employs AI tool/function calling, safe server-side analysis execution,
 * and deterministic fallback intent parsing.
 */
class AskAiService {
  /**
   * Main entry point to process a question against a dataset.
   * @param {Object} dataset - Dataset document
   * @param {string} question - User question
   * @param {string} ownerId - User ID
   */
  async askQuestion(dataset, question, ownerId) {
    const datasetId = dataset._id;
    const rows = await datasetRepository.getAllDatasetRows(datasetId, ownerId);
    const sampleRows = rows.slice(0, 10);

    // Compute basic column summaries for context
    const colSummaries = this._computeColumnSummaries(dataset.columns, sampleRows);

    const contextPrompt = `Dataset context:
FileName: ${dataset.fileName}
Total Rows: ${dataset.rowCount}
Columns Schema: ${JSON.stringify(dataset.columns)}
Column Summaries: ${JSON.stringify(colSummaries)}
Sample Rows: ${JSON.stringify(sampleRows)}
User Question: "${question}"`;

    let selectedOperation = null;

    // 1. Try LLM Function Calling / Structured Intent Extraction if LLM API is available
    if (isGeminiAvailable()) {
      try {
        selectedOperation = await this._extractOperationWithLLM(contextPrompt, dataset.columns);
      } catch (err) {
        console.warn('[AskAiService] LLM intent extraction failed/timed out. Using fallback intent parser:', err.message);
      }
    }

    // 2. Deterministic Fallback Intent Parser if LLM omitted or failed
    if (!selectedOperation) {
      selectedOperation = this._extractOperationWithRules(question, dataset.columns);
    }

    // 3. Execute approved server-side analysis engine
    const analysisResult = analysisEngine.execute(selectedOperation, rows, dataset.columns);

    // 4. Generate plain-English answer and insights
    let answerAndInsights = null;
    if (isGeminiAvailable()) {
      try {
        answerAndInsights = await this._generateExplanationWithLLM(question, analysisResult);
      } catch (err) {
        console.warn('[AskAiService] LLM explanation failed. Using statistical explanation generator:', err.message);
      }
    }

    if (!answerAndInsights) {
      answerAndInsights = this._generateExplanationWithRules(question, analysisResult);
    }

    return {
      answer: answerAndInsights.answer,
      insights: answerAndInsights.insights,
      analysis: analysisResult.analysis,
      chart: analysisResult.chart,
      methodology: analysisResult.methodology
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

    const rawResponse = await geminiGenerate(`${systemInstruction}\n\n${contextPrompt}`);
    return rawResponse;
  }

  /**
   * Rule-based intent parser to extract analytical operation when LLM is offline.
   */
  _extractOperationWithRules(question, columnsSchema) {
    const qLower = question.toLowerCase();
    const numCols = columnsSchema.filter(c => c.type === 'number').map(c => c.name);
    const catCols = columnsSchema.filter(c => c.type === 'string' || c.type === 'boolean').map(c => c.name);
    const dateCols = columnsSchema.filter(c => c.type === 'date').map(c => c.name);

    const primaryMetric = numCols.find(c => new RegExp(c, 'i').test(question)) || numCols[0];
    const primaryGroup = catCols.find(c => new RegExp(c, 'i').test(question)) || catCols[0];
    const primaryDate = dateCols.find(c => new RegExp(c, 'i').test(question)) || dateCols[0];

    // Check for compare periods intent (month, year, time, trend, drop, period)
    if (primaryDate && /month|year|trend|drop|fall|increase|period|over time|time/i.test(qLower)) {
      return {
        action: 'compare_periods',
        dateColumn: primaryDate,
        metric: primaryMetric,
        periodType: 'monthly'
      };
    }

    // Check for top N intent (top, best, highest, worst, bottom, lowest, 5, 10)
    if (/top|best|highest|worst|bottom|lowest|first/i.test(qLower)) {
      const matchNum = qLower.match(/\b([1-9]|10)\b/);
      const limit = matchNum ? parseInt(matchNum[1]) : 5;
      const isAsc = /worst|bottom|lowest/i.test(qLower);
      return {
        action: 'top_n',
        groupBy: primaryGroup,
        metric: primaryMetric,
        limit,
        direction: isAsc ? 'asc' : 'desc'
      };
    }

    // Default to group_by
    let agg = 'sum';
    if (/avg|average|mean/i.test(qLower)) agg = 'avg';
    if (/min|minimum|least/i.test(qLower)) agg = 'min';
    if (/max|maximum|most/i.test(qLower)) agg = 'max';
    if (/count|number of|how many/i.test(qLower)) agg = 'count';

    return {
      action: 'group_by',
      groupBy: primaryGroup,
      metric: primaryMetric,
      aggregation: agg
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

    const raw = await geminiGenerate(prompt);
    if (raw && raw.answer && Array.isArray(raw.insights)) {
      return raw;
    }
    throw new Error('LLM returned invalid explanation shape');
  }

  /**
   * Fallback explanation generator.
   */
  _generateExplanationWithRules(question, analysisResult) {
    const { action, result = [], metric, groupBy } = analysisResult.analysis;

    if (!result || result.length === 0) {
      return {
        answer: "No specific data points were found matching your criteria.",
        insights: ["Check if your dataset contains rows matching this query."]
      };
    }

    const topItem = result[0];
    const topName = topItem[groupBy] || topItem['Period'] || 'Top category';
    const topVal = topItem[metric || 'Value'] || topItem['Count'] || 0;
    const formattedVal = typeof topVal === 'number' ? topVal.toLocaleString() : topVal;

    if (action === 'compare_periods') {
      const lastItem = result[result.length - 1];
      const changePct = lastItem['Change %'] || 0;
      const isUp = changePct >= 0;

      return {
        answer: `${lastItem.Period} recorded a metric value of ${lastItem[metric || 'Value'].toLocaleString()}, representing a ${Math.abs(changePct)}% ${isUp ? 'increase' : 'decrease'} compared to prior period.`,
        insights: [
          `Peak performance occurred in ${topName} with ${formattedVal} total volume.`,
          `Recent trend indicates ${isUp ? 'upward growth' : 'a decline'} across evaluated time windows.`
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
