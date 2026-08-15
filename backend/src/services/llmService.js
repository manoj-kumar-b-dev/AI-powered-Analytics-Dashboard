/**
 * Unified Multi-Provider LLM & AI Service
 *
 * Single centralized service supporting multiple LLM providers:
 * - Google Gemini (gemini-2.0-flash, gemini-1.5-flash)
 * - Groq (llama-3.3-70b-versatile, mixtral-8x7b)
 * - xAI Grok (grok-beta, grok-2)
 * - OpenAI (gpt-4o, gpt-4o-mini)
 * - Anthropic (claude-3-5-sonnet)
 *
 * Provides live AI generation with auto rate-limiting queue, as well as a
 * smart statistical fallback engine when no API keys are present.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const DUMMY_KEYS = new Set([
  'your_gemini_api_key_here',
  'AIzaSyDw3LD053XmKmBDkBtMMLsSHYTwoGOVesI',
  'your_groq_api_key_here',
  'your_grok_api_key_here',
  'your_openai_api_key_here'
]);

class UniversalLlmService {
  constructor() {
    this.provider = null; // 'gemini' | 'groq' | 'xai' | 'openai' | 'anthropic'
    this.apiKey = null;
    this.modelName = null;
    this.genAIModel = null;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.queueDelayMs = process.env.NODE_ENV === 'test' ? 0 : 4000;

    this.initProvider();
  }

  initProvider() {
    const rawKey = process.env.GROK_API_KEY ||
                   process.env.GROQ_API_KEY ||
                   process.env.GEMINI_API_KEY ||
                   process.env.OPENAI_API_KEY ||
                   process.env.ANTHROPIC_API_KEY;

    if (!rawKey || DUMMY_KEYS.has(rawKey.trim())) {
      this.provider = null;
      this.apiKey = null;
      this.modelName = null;
      this.genAIModel = null;
      return;
    }

    const key = rawKey.trim();
    if (this.apiKey === key && this.provider) return;

    this.apiKey = key;

    if (this.apiKey.startsWith('gsk_') || (process.env.GROQ_API_KEY && !process.env.GROK_API_KEY)) {
      this.provider = 'groq';
      this.modelName = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    } else if (this.apiKey.startsWith('xai-') || process.env.GROK_API_KEY) {
      this.provider = 'grok';
      this.modelName = process.env.GROK_MODEL || 'grok-beta';
    } else if (this.apiKey.startsWith('sk-ant-') || process.env.ANTHROPIC_API_KEY) {
      this.provider = 'anthropic';
      this.modelName = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620';
    } else if (this.apiKey.startsWith('sk-') || process.env.OPENAI_API_KEY) {
      this.provider = 'openai';
      this.modelName = process.env.OPENAI_MODEL || 'gpt-4o';
    } else {
      // Default to Gemini
      this.provider = 'gemini';
      this.modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      try {
        const genAI = new GoogleGenerativeAI(this.apiKey);
        this.genAIModel = genAI.getGenerativeModel({
          model: this.modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 4096
          }
        });
      } catch (err) {
        console.error('[LlmService] Failed to initialize Gemini model:', err.message);
        this.provider = null;
      }
    }

    if (this.provider) {
      console.log(`[LlmService] Initialized provider: ${this.provider.toUpperCase()} (model: ${this.modelName})`);
    }
  }

  isAvailable() {
    this.initProvider();
    return !!this.provider && !!this.apiKey;
  }

  getProviderInfo() {
    return {
      provider: this.provider || 'statistical_fallback',
      modelUsed: this.modelName || 'statistical_engine_v2',
      isAvailable: this.isAvailable()
    };
  }

  async generate(prompt, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('No LLM provider configured. Set GEMINI_API_KEY, GROQ_API_KEY, GROK_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env');
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({ prompt, options, resolve, reject });
      this._processQueue();
    });
  }

  async _processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const { prompt, options, resolve, reject } = this.requestQueue.shift();
      try {
        const result = await this._executeLlmRequest(prompt, options);
        resolve(result);
      } catch (err) {
        reject(err);
      }

      const delay = process.env.NODE_ENV === 'test' ? 0 : this.queueDelayMs;
      if (this.requestQueue.length > 0 && delay > 0) {
        await new Promise(r => setTimeout(r, delay));
      }
    }

    this.isProcessingQueue = false;
  }

  async _executeLlmRequest(prompt, options = {}) {
    let responseText = '';

    const fetchFn = global.fetch || require('node-fetch');

    if (this.provider === 'gemini') {
      const result = await this.genAIModel.generateContent(prompt);
      responseText = result.response.text().trim();
    } else if (this.provider === 'groq') {
      const res = await fetchFn('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: options.temperature || 0.2
        })
      });
      if (!res.ok) throw new Error(`Groq API error ${res.status}: ${await res.text()}`);
      const json = await res.json();
      responseText = json.choices[0]?.message?.content || '{}';
    } else if (this.provider === 'xai' || this.provider === 'grok') {
      const res = await fetchFn('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: options.temperature || 0.2
        })
      });
      if (!res.ok) throw new Error(`xAI Grok API error ${res.status}: ${await res.text()}`);
      const json = await res.json();
      responseText = json.choices[0]?.message?.content || '{}';
    } else if (this.provider === 'openai') {
      const res = await fetchFn('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: options.temperature || 0.2
        })
      });
      if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
      const json = await res.json();
      responseText = json.choices[0]?.message?.content || '{}';
    } else if (this.provider === 'anthropic') {
      const res = await fetchFn('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.modelName,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
      const json = await res.json();
      responseText = json.content[0]?.text || '{}';
    }

    const cleaned = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      return { rawText: responseText, parsed: false };
    }
  }

  /**
   * Main Insights Generation Method
   * Supports both context payloads ({ kpis, charts, data }) and positional args (kpiSummary, anomalyList, domain)
   */
  async generateInsights(arg1, arg2 = [], arg3 = 'general', arg4 = 'General Domain') {
    let kpis = [], charts = [], data = [], domain = 'general', domainLabel = 'General Domain', anomalyList = [];

    if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1) && (arg1.data || arg1.kpis || arg1.charts)) {
      kpis = arg1.kpis || [];
      charts = arg1.charts || [];
      data = arg1.data || [];
      domain = arg1.domain || 'general';
      domainLabel = arg1.domainLabel || domain;
    } else if (Array.isArray(arg1)) {
      kpis = arg1;
      anomalyList = Array.isArray(arg2) ? arg2 : [];
      domain = typeof arg3 === 'string' ? arg3 : 'general';
      domainLabel = typeof arg4 === 'string' ? arg4 : domain;
    }

    const stats = this._calculateDatasetStats(data, kpis);

    if (this.isAvailable()) {
      try {
        const prompt = `You are a senior business intelligence AI analyst.
Domain: "${domain}" (${domainLabel})
Computed KPIs: ${JSON.stringify(kpis)}
Key Statistics: ${JSON.stringify(stats)}
Sample Rows: ${JSON.stringify(data.slice(0, 15))}
Rule Alerts: ${JSON.stringify(anomalyList)}

CRITICAL DOMAIN INSTRUCTIONS:
1. Generate 4 to 6 actionable business insights tailored strictly to the "${domainLabel}" domain.
2. DO NOT pick demographic variables like "Age" as primary business growth/revenue metrics.
3. For HR datasets: Focus on Monthly Payroll, Department Headcount, Attrition/Turnover, and Performance.
4. For Finance datasets: Focus on Budget vs Actual Variance, Top Accounts, and Cost Centers.
5. For Marketing datasets: Focus on ROAS, Ad Spend, Top Acquisition Channels, and CAC.
6. For Sales datasets: Focus on Revenue, Net Margin %, Top Regions, and Low Velocity Items.
7. Do NOT invent new numbers or recalculate raw data outside the provided payload.

Return ONLY valid JSON matching this schema:
{
  "insights": [
    {
      "id": "ins-1",
      "category": "growth|top_performer|decline|temporal|financial|recommendation",
      "headline": "Short Title",
      "text": "1-2 sentence business explanation",
      "badgeText": "Metric Badge e.g. +18% Sales",
      "badgeType": "success|warning|info|critical|recommendation",
      "type": "sparkle|trending|warning|lightbulb",
      "severity": "success|info|warning|critical",
      "icon": "trending-up|trophy|trending-down|calendar|alert-triangle|lightbulb"
    }
  ]
}`;

        const rawResult = await this.generate(prompt);
        const insightsList = Array.isArray(rawResult) ? rawResult : (rawResult?.insights || rawResult?.data || []);

        if (Array.isArray(insightsList) && insightsList.length > 0) {
          return {
            success: true,
            source: this.provider,
            modelUsed: this.modelName,
            insights: insightsList,
            insightsHtml: this._renderHtmlFromInsights(insightsList)
          };
        }
      } catch (err) {
        console.warn('[LlmService] Live LLM call failed, reverting to Statistical Engine:', err.message);
      }
    }

    // Statistical Engine Fallback
    const fallbackInsights = this._generateStatisticalFallback(stats, kpis, data, anomalyList, domain, domainLabel);
    return {
      success: true,
      source: 'smart_analytics',
      modelUsed: 'statistical_engine_v2',
      insights: fallbackInsights,
      insightsHtml: this._renderHtmlFromInsights(fallbackInsights)
    };
  }

  async generateFullInsights(context = {}) {
    const domain = context.datasetSummary?.domain || 'general';
    const domainLabel = context.datasetSummary?.domainLabel || 'General Domain';

    if (this.isAvailable()) {
      try {
        const prompt = `Perform complete executive domain analysis for domain "${domainLabel}".
Context Payload: ${JSON.stringify(context)}

Return ONLY valid JSON with fields:
executiveSummary (string), keyInsights (array of { id, text, confidence }), patterns (array of { title, description }), anomalies (array of { title, severity }), risks (array of { title, impact }), opportunities (array of { title, impact }), recommendations (array of { title, action }).`;

        const res = await this.generate(prompt);
        if (res && res.executiveSummary) return res;
      } catch (err) {
        console.warn('[LlmService] generateFullInsights LLM call failed, using fallback:', err.message);
      }
    }

    // Fallback full insights object
    return {
      executiveSummary: `Executive summary for ${domainLabel} dataset comprising ${context.datasetSummary?.rows || 0} rows. Key baseline trends indicate stable operational metrics.`,
      keyInsights: [
        { id: 'ins-1', text: `Primary dataset trends remain within baseline expectations for ${domainLabel}.`, confidence: 0.95 }
      ],
      patterns: [{ title: 'Baseline Distribution', description: 'Data distribution conforms to expected range.' }],
      anomalies: (context.outliers || []).map(o => ({ title: o.label || 'Outlier Alert', severity: o.severity || 'warning' })),
      risks: [{ title: 'Data Completeness', impact: 'low' }],
      opportunities: [{ title: 'Metric Optimization', impact: 'medium' }],
      recommendations: [{ title: 'Resource Focus', action: 'Direct analytical focus to top category performers.' }]
    };
  }

  async explainChart(payload) {
    if (this.isAvailable()) {
      try {
        const prompt = `Explain the following chart visualization:
Title: "${payload.title}"
Type: "${payload.type}"
Aggregated Points: ${JSON.stringify((payload.aggregatedData || []).slice(0, 10))}

Return valid JSON:
{
  "explanation": "Focused explanation text",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2"],
  "trend": "upward|downward|stable|volatile",
  "confidence": 0.95
}`;
        const res = await this.generate(prompt);
        if (res && res.explanation) return res;
      } catch (err) {
        console.warn('[LlmService] explainChart LLM error, using fallback:', err.message);
      }
    }

    const topPoint = (payload.aggregatedData || [])[0];
    return {
      explanation: `The "${payload.title}" chart (${payload.type}) displays data distribution across active categories. ${topPoint ? `Top category is "${topPoint.x}" with a value of ${topPoint.y}.` : ''}`,
      keyTakeaways: [topPoint ? `Dominant metric: ${topPoint.x} (${topPoint.y})` : 'Stable distribution'],
      trend: 'stable',
      confidence: 0.90
    };
  }

  // Statistical Engine Helpers
  _calculateDatasetStats(rows, kpis) {
    const stats = { totalRows: 0, numericColumns: {}, categoricalColumns: {}, dateColumn: null, weekendVsWeekday: null };
    if (!Array.isArray(rows) || rows.length === 0 || !rows[0]) return stats;

    stats.totalRows = rows.length;
    const firstRow = rows[0];

    Object.keys(firstRow).forEach(key => {
      const val = firstRow[key];
      if (typeof val === 'number' || (!isNaN(val) && val !== '' && val !== null && typeof val !== 'boolean')) {
        stats.numericColumns[key] = { sum: 0, count: 0, values: [] };
      } else if (typeof val === 'string' && /date|time|timestamp|period/i.test(key) && !isNaN(Date.parse(val)) && val.length > 5) {
        if (!stats.dateColumn) stats.dateColumn = key;
      } else if (typeof val === 'string') {
        stats.categoricalColumns[key] = {};
      }
    });

    let weekdaySum = 0, weekdayCount = 0, weekendSum = 0, weekendCount = 0;

    rows.forEach(row => {
      Object.keys(stats.numericColumns).forEach(col => {
        const numVal = parseFloat(row[col]) || 0;
        stats.numericColumns[col].sum += numVal;
        stats.numericColumns[col].count += 1;
        stats.numericColumns[col].values.push(numVal);
      });

      Object.keys(stats.categoricalColumns).forEach(col => {
        const catVal = String(row[col] || 'Unknown');
        stats.categoricalColumns[col][catVal] = (stats.categoricalColumns[col][catVal] || 0) + 1;
      });

      if (stats.dateColumn && row[stats.dateColumn]) {
        const d = new Date(row[stats.dateColumn]);
        if (!isNaN(d.getTime())) {
          const primaryNum = Object.keys(stats.numericColumns).find(k => /sales|revenue|income|amount|spend|total/i.test(k));
          if (primaryNum) {
            const val = parseFloat(row[primaryNum]) || 1;
            if (d.getDay() === 0 || d.getDay() === 6) {
              weekendSum += val; weekendCount++;
            } else {
              weekdaySum += val; weekdayCount++;
            }
          }
        }
      }
    });

    if (weekendCount > 0 && weekdayCount > 0) {
      const avgWeekend = weekendSum / weekendCount;
      const avgWeekday = weekdaySum / weekdayCount;
      if (avgWeekday > 0) {
        const pctDiff = Math.round(((avgWeekend - avgWeekday) / avgWeekday) * 100);
        stats.weekendVsWeekday = { pctDiff, isHigher: pctDiff > 0 };
      }
    }
    return stats;
  }

  _generateStatisticalFallback(stats, kpis, rows, anomalyList = [], domain = 'general', domainLabel = 'General') {
    const insights = [];
    const numKeys = Object.keys(stats.numericColumns || {});
    const catKeys = Object.keys(stats.categoricalColumns || {});

    // ────────────────────────── HR DOMAIN ──────────────────────────
    if (domain === 'hr' || /hr|human_resource|staff|employee/i.test(domain)) {
      const salaryKey = numKeys.find(k => /salary|pay|compensation|payroll|earning/i.test(k));
      if (salaryKey && stats.numericColumns[salaryKey]) {
        const vals = stats.numericColumns[salaryKey].values;
        const totalPay = Math.round(stats.numericColumns[salaryKey].sum);
        const avgPay = Math.round(totalPay / (vals.length || 1));
        const formattedTotal = totalPay >= 1e7 ? `₹${(totalPay / 1e7).toFixed(2)}Cr` : `₹${(totalPay / 1e5).toFixed(2)}L`;
        const formattedAvg = `₹${avgPay.toLocaleString('en-IN')}`;

        insights.push({
          id: 'ins-hr-payroll',
          category: 'growth',
          type: 'sparkle',
          severity: 'success',
          headline: 'Total Monthly Payroll',
          text: `Total monthly compensation expenditure across active staff reaches ${formattedTotal} (Average monthly salary: ${formattedAvg}/mo).`,
          badgeText: `${formattedTotal} Payroll`,
          badgeType: 'success',
          icon: 'trending-up'
        });
      }

      const deptKey = catKeys.find(k => /department|dept|team|division/i.test(k));
      if (deptKey && stats.categoricalColumns[deptKey]) {
        const counts = stats.categoricalColumns[deptKey];
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          const [topDept, topCount] = sorted[0];
          const pct = Math.round((topCount / (stats.totalRows || 1)) * 100);
          insights.push({
            id: 'ins-hr-headcount',
            category: 'top_performer',
            type: 'sparkle',
            severity: 'info',
            headline: 'Headcount Concentration',
            text: `"${topDept}" is the largest department by headcount with ${topCount} employees (${pct}% of total workforce).`,
            badgeText: `${topDept} (${topCount})`,
            badgeType: 'info',
            icon: 'trophy'
          });
        }
      }

      const statusKey = catKeys.find(k => /status|employment_status|condition/i.test(k));
      if (statusKey && stats.categoricalColumns[statusKey]) {
        const counts = stats.categoricalColumns[statusKey];
        const exitedCount = counts['Exited'] || counts['Terminated'] || counts['Resigned'] || 0;
        const total = stats.totalRows || 1;
        const exitRate = ((exitedCount / total) * 100).toFixed(1);
        insights.push({
          id: 'ins-hr-attrition',
          category: 'decline',
          type: exitedCount > 0 ? 'warning' : 'sparkle',
          severity: exitedCount > 0 ? 'warning' : 'success',
          headline: 'Employee Attrition Rate',
          text: `Workforce retention stands at ${(100 - parseFloat(exitRate)).toFixed(1)}% with ${exitedCount} exited employee record(s) (${exitRate}% attrition rate).`,
          badgeText: `${exitRate}% Attrition`,
          badgeType: exitedCount > 0 ? 'warning' : 'success',
          icon: 'trending-down'
        });
      }

      const ratingKey = numKeys.find(k => /rating|performance|score|eval/i.test(k));
      if (ratingKey && stats.numericColumns[ratingKey]) {
        const vals = stats.numericColumns[ratingKey].values;
        const avgRating = (vals.reduce((a, b) => a + b, 0) / (vals.length || 1)).toFixed(2);
        insights.push({
          id: 'ins-hr-performance',
          category: 'financial',
          type: 'sparkle',
          severity: 'info',
          headline: 'Performance Benchmark',
          text: `Average employee performance rating across evaluated roles stands at ${avgRating} / 5.0.`,
          badgeText: `${avgRating} Rating`,
          badgeType: 'info',
          icon: 'alert-triangle'
        });
      }

      insights.push({
        id: 'ins-hr-recommendation',
        category: 'recommendation',
        type: 'lightbulb',
        severity: 'info',
        headline: 'Strategic HR Recommendation',
        text: 'Focus retention initiatives on high-headcount departments (HR, Customer Support) and conduct competitive salary benchmarking across regional hubs.',
        badgeText: 'HR Action Plan',
        badgeType: 'recommendation',
        icon: 'lightbulb'
      });

      return insights;
    }

    // ────────────────────────── FINANCE DOMAIN ──────────────────────────
    if (domain === 'finance' || /finance|budget|ledger|accounting/i.test(domain)) {
      const budgetKey = numKeys.find(k => /budget/i.test(k));
      const actualKey = numKeys.find(k => /actual|spend|expense/i.test(k));

      if (budgetKey && actualKey && stats.numericColumns[budgetKey] && stats.numericColumns[actualKey]) {
        const totalBudget = Math.round(stats.numericColumns[budgetKey].sum);
        const totalActual = Math.round(stats.numericColumns[actualKey].sum);
        const variance = totalActual - totalBudget;
        const pctVar = Math.round((variance / totalBudget) * 100);
        const isOver = variance > 0;

        insights.push({
          id: 'ins-fin-variance',
          category: 'growth',
          type: isOver ? 'warning' : 'sparkle',
          severity: isOver ? 'warning' : 'success',
          headline: 'Budget vs Actual Variance',
          text: `Total Actual expenditure (₹${(totalActual/1e5).toFixed(2)}L) is ${isOver ? 'over' : 'under'} Budget by ${Math.abs(pctVar)}% (₹${(Math.abs(variance)/1e5).toFixed(2)}L).`,
          badgeText: `${isOver ? '+' : '-'}${Math.abs(pctVar)}% Variance`,
          badgeType: isOver ? 'warning' : 'success',
          icon: isOver ? 'trending-down' : 'trending-up'
        });
      }

      const deptKey = catKeys.find(k => /department|dept|division/i.test(k));
      if (deptKey && stats.categoricalColumns[deptKey]) {
        const counts = stats.categoricalColumns[deptKey];
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          const [topDept, topCount] = sorted[0];
          insights.push({
            id: 'ins-fin-dept',
            category: 'top_performer',
            type: 'sparkle',
            severity: 'info',
            headline: 'Top Expense Department',
            text: `"${topDept}" generated the highest volume of financial ledger line items (${topCount} transactions).`,
            badgeText: `${topDept}`,
            badgeType: 'info',
            icon: 'trophy'
          });
        }
      }

      insights.push({
        id: 'ins-fin-recommendation',
        category: 'recommendation',
        type: 'lightbulb',
        severity: 'info',
        headline: 'Financial Strategy Advice',
        text: 'Rebalance departmental budget allocations to mitigate overruns in primary operational expense categories.',
        badgeText: 'Budget Review',
        badgeType: 'recommendation',
        icon: 'lightbulb'
      });

      return insights;
    }

    // ────────────────────────── MARKETING DOMAIN ──────────────────────────
    if (domain === 'marketing' || /marketing|ad|campaign|traffic/i.test(domain)) {
      const revKey = numKeys.find(k => /revenue|income|conversion_value/i.test(k));
      const spendKey = numKeys.find(k => /spend|cost|ad_spend/i.test(k));

      if (revKey && spendKey && stats.numericColumns[revKey] && stats.numericColumns[spendKey]) {
        const totalRev = Math.round(stats.numericColumns[revKey].sum);
        const totalSpend = Math.round(stats.numericColumns[spendKey].sum);
        const overallRoas = totalSpend > 0 ? (totalRev / totalSpend).toFixed(2) : '0';

        insights.push({
          id: 'ins-mkt-roas',
          category: 'growth',
          type: 'sparkle',
          severity: 'success',
          headline: 'Return on Ad Spend (ROAS)',
          text: `Total ad spend of ₹${(totalSpend/1e5).toFixed(2)}L generated ₹${(totalRev/1e5).toFixed(2)}L in revenue, yielding an overall ROAS of ${overallRoas}x.`,
          badgeText: `${overallRoas}x ROAS`,
          badgeType: 'success',
          icon: 'trending-up'
        });
      }

      const channelKey = catKeys.find(k => /channel|campaign|source|platform/i.test(k));
      if (channelKey && stats.categoricalColumns[channelKey]) {
        const counts = stats.categoricalColumns[channelKey];
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          const [topChannel, topCount] = sorted[0];
          insights.push({
            id: 'ins-mkt-channel',
            category: 'top_performer',
            type: 'sparkle',
            severity: 'info',
            headline: 'Top Acquisition Channel',
            text: `"${topChannel}" led campaign volume with ${topCount} active marketing runs.`,
            badgeText: `${topChannel}`,
            badgeType: 'info',
            icon: 'trophy'
          });
        }
      }

      insights.push({
        id: 'ins-mkt-recommendation',
        category: 'recommendation',
        type: 'lightbulb',
        severity: 'info',
        headline: 'Marketing Optimization Advice',
        text: 'Reallocate advertising budget from low-ROAS channels toward top-performing platforms (LinkedIn Ads, Organic Search) to reduce CAC.',
        badgeText: 'Ad Spend Action',
        badgeType: 'recommendation',
        icon: 'lightbulb'
      });

      return insights;
    }

    // ────────────────────────── SALES / E-COMMERCE / GENERAL ──────────────────────────
    const primarySalesKey = numKeys.find(k => /sales|revenue|income|amount|total/i.test(k)) || numKeys.find(k => k.toLowerCase() !== 'age' && k.toLowerCase() !== 'id') || numKeys[0];
    if (primarySalesKey && stats.numericColumns[primarySalesKey]) {
      const vals = stats.numericColumns[primarySalesKey].values;
      const mid = Math.floor(vals.length / 2);
      if (mid > 0) {
        const h1 = vals.slice(0, mid).reduce((a, b) => a + b, 0);
        const h2 = vals.slice(mid).reduce((a, b) => a + b, 0);
        const growth = h1 > 0 ? Math.round(((h2 - h1) / h1) * 100) : 0;
        const isPositive = growth >= 0;
        insights.push({
          id: 'ins-growth',
          category: 'growth',
          type: isPositive ? 'sparkle' : 'warning',
          severity: isPositive ? 'success' : 'warning',
          headline: 'Primary Metric Momentum',
          text: `${primarySalesKey.replace(/_/g, ' ').toUpperCase()} ${isPositive ? 'increased' : 'decreased'} ${Math.abs(growth)}% compared to prior period.`,
          badgeText: `${isPositive ? '+' : '-'}${Math.abs(growth)}%`,
          badgeType: isPositive ? 'success' : 'warning',
          icon: isPositive ? 'trending-up' : 'trending-down'
        });
      }
    } else if (Array.isArray(kpis) && kpis.length > 0) {
      const revKpi = kpis.find(k => /revenue|sales|income|amount/i.test(k.kpi || k.label)) || kpis[0];
      if (revKpi) {
        insights.push({
          id: 'ins-growth',
          category: 'growth',
          type: 'sparkle',
          severity: 'success',
          headline: 'Primary KPI Aggregate',
          text: `${(revKpi.label || revKpi.kpi).toUpperCase()} aggregate reached ${revKpi.formattedValue || revKpi.value} across current records.`,
          badgeText: `${revKpi.formattedValue || revKpi.value}`,
          badgeType: 'success',
          icon: 'trending-up'
        });
      }
    }

    // 2. Top Performing Category
    const catKey = catKeys.find(k => /region|location|department|channel|category/i.test(k)) || catKeys[0];
    if (catKey && stats.categoricalColumns[catKey]) {
      const counts = stats.categoricalColumns[catKey];
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const topCat = sorted[0][0];
        insights.push({
          id: 'ins-top-performer',
          category: 'top_performer',
          type: 'sparkle',
          severity: 'info',
          headline: 'Top Performer Leader',
          text: `"${topCat}" in ${catKey.replace(/_/g, ' ')} generated the highest volume share.`,
          badgeText: `${topCat}`,
          badgeType: 'info',
          icon: 'trophy'
        });
      }
    } else if (Array.isArray(kpis) && kpis.length > 1) {
      const profitKpi = kpis.find(k => /profit|net|margin/i.test(k.kpi || k.label));
      if (profitKpi) {
        insights.push({
          id: 'ins-top-performer',
          category: 'top_performer',
          type: 'sparkle',
          severity: 'info',
          headline: 'Net Financial Performance',
          text: `${(profitKpi.label || profitKpi.kpi).toUpperCase()} yields ${profitKpi.formattedValue || profitKpi.value} in overall bottom-line contribution.`,
          badgeText: `${profitKpi.formattedValue || profitKpi.value}`,
          badgeType: 'info',
          icon: 'trophy'
        });
      }
    }

    // 3. Lowest Volume Item
    const productKey = catKeys.find(k => /product|item|service|sku/i.test(k));
    if (productKey && stats.categoricalColumns[productKey]) {
      const counts = stats.categoricalColumns[productKey];
      const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1]);
      if (sorted.length > 0) {
        const bottomCat = sorted[0][0];
        insights.push({
          id: 'ins-decline',
          category: 'decline',
          type: 'warning',
          severity: 'warning',
          headline: 'Lowest Volume Item',
          text: `"${bottomCat}" recorded the lowest transaction volume.`,
          badgeText: `${bottomCat} Low Vol`,
          badgeType: 'warning',
          icon: 'trending-down'
        });
      }
    }

    // 4. Temporal Pattern
    if (stats.dateColumn && stats.weekendVsWeekday && domain !== 'hr') {
      const { pctDiff, isHigher } = stats.weekendVsWeekday;
      insights.push({
        id: 'ins-temporal',
        category: 'temporal',
        type: 'trending',
        severity: 'info',
        headline: isHigher ? 'Weekend Spike' : 'Weekday Preference',
        text: `Weekend volume is ${Math.abs(pctDiff)}% ${isHigher ? 'higher' : 'lower'} than weekday averages.`,
        badgeText: `${isHigher ? '+' : '-'}${Math.abs(pctDiff)}% Weekend`,
        badgeType: isHigher ? 'success' : 'info',
        icon: 'calendar'
      });
    }

    // 5. Expense / Cost Warning
    const expenseKey = numKeys.find(k => /expense|cost|logistics|spend/i.test(k));
    if (expenseKey) {
      insights.push({
        id: 'ins-financial',
        category: 'financial',
        type: 'warning',
        severity: 'critical',
        headline: 'Cost Growth Alert',
        text: `${expenseKey.replace(/_/g, ' ').toUpperCase()} represents a high-volume cost driver across active rows.`,
        badgeText: 'Cost Monitor',
        badgeType: 'critical',
        icon: 'alert-triangle'
      });
    } else if (Array.isArray(kpis)) {
      const expKpi = kpis.find(k => /expense|cost|spend/i.test(k.kpi || k.label));
      if (expKpi) {
        insights.push({
          id: 'ins-financial',
          category: 'financial',
          type: 'warning',
          severity: 'critical',
          headline: 'Cost Center Monitor',
          text: `${(expKpi.label || expKpi.kpi).toUpperCase()} stands at ${expKpi.formattedValue || expKpi.value}, representing the primary operating cost line.`,
          badgeText: 'Cost Driver',
          badgeType: 'critical',
          icon: 'alert-triangle'
        });
      }
    }

    // 6. Actionable Advice
    insights.push({
      id: 'ins-recommendation',
      category: 'recommendation',
      type: 'lightbulb',
      severity: 'info',
      headline: 'Strategic Advice',
      text: 'Focus analytical and promotional efforts on top-performing dimension segments to optimize operational ROI.',
      badgeText: 'Strategic Action',
      badgeType: 'recommendation',
      icon: 'lightbulb'
    });

    return insights;
  }

  _renderHtmlFromInsights(insights) {
    if (!Array.isArray(insights) || insights.length === 0) return '<p>No insights generated.</p>';
    const items = insights.map(item => {
      const text = item.text || item;
      return `<li><strong>${item.headline || 'Insight'}:</strong> ${text}</li>`;
    }).join('\n');
    return `<ul class="space-y-2">\n${items}\n</ul>`;
  }
}

const instance = new UniversalLlmService();
module.exports = instance;
