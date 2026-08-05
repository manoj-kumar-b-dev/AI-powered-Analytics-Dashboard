/**
 * Recommendation Pipeline
 *
 * Orchestrates the full analytics recommendation flow:
 *
 *   1. Semantic Column Classification
 *   2. Domain-aware KPI Candidate Generation (deterministic)
 *   3. Domain-aware Chart Candidate Generation (deterministic)
 *   4. AI Enrichment (Gemini — suggests additional candidates)
 *   5. AI recommendations pass through Aggregation Validation gate
 *   6. Business Value Scoring
 *   7. Deduplication
 *   8. Ranking + Limits
 *
 * The AI is used for enrichment, NOT for final authority.
 * Deterministic validation always runs after AI.
 *
 * Returns:
 *   { kpiCandidates: [], chartCandidates: [], columnSemantics: Map }
 */

const { classifyColumns } = require('../semantic/semanticClassifier');
const { generateKPICandidates, validateExternalKPICandidate } = require('../kpi/kpiCandidateGenerator');
const { generateChartCandidates, validateExternalChartCandidate } = require('../charts/chartCandidateGenerator');
const { scoreAndRankKPIs, scoreAndRankCharts, buildColumnQualityMap } = require('../scoring/businessValueScorer');
const { deduplicateKPIs, deduplicateCharts, applyKPILimits, applyChartLimits } = require('./deduplicator');
const { geminiGenerate, isGeminiAvailable } = require('../../config/gemini');

// --- Universal engine modules (Steps 3-8) ---
const { buildRelationshipModel } = require('../relationships/relationshipModel');
const { discoverCapabilities } = require('../capabilities/capabilityDiscoveryEngine');
const { generateIntents } = require('../intents/analyticalIntentGenerator');
const { generateUniversalKPICandidates } = require('../kpi/universalKPIGenerator');
const { generateUniversalChartCandidates } = require('../charts/universalChartGenerator');
const { validateKPICandidates, validateChartCandidates } = require('../validation/statisticalValidator');

// ---------------------------------------------------------------------------
// AI prompt for semantic enrichment
// ---------------------------------------------------------------------------

/**
 * Builds the Gemini prompt for domain-aware recommendation enrichment.
 * The AI is asked to suggest ADDITIONAL candidates beyond the deterministic ones.
 *
 * @param {string} domain
 * @param {Array} schema - dataset schema
 * @param {Array} existingKPITitles - already generated KPI titles (to avoid duplicates)
 * @param {Array} existingChartTitles - already generated chart titles
 * @returns {string}
 */
const buildEnrichmentPrompt = (domain, schema, existingKPITitles, existingChartTitles) => {
  const schemaText = schema.map(col => {
    const samples = col.sampleValues?.slice(0, 3).map(v => JSON.stringify(v)).join(', ') || '';
    return `- "${col.column}" (type: ${col.type}${samples ? `, samples: [${samples}]` : ''})`;
  }).join('\n');

  return `You are a senior business intelligence analyst specializing in ${domain.toUpperCase()} analytics.

Dataset Domain: "${domain}"

Dataset Schema:
${schemaText}

Already generated KPIs (do not repeat these):
${existingKPITitles.length > 0 ? existingKPITitles.map(t => `- ${t}`).join('\n') : '- (none yet)'}

Already generated charts (do not repeat these):
${existingChartTitles.length > 0 ? existingChartTitles.map(t => `- ${t}`).join('\n') : '- (none yet)'}

Your task: Suggest UP TO 4 additional high-value KPIs and UP TO 4 additional charts for this ${domain} dataset.

CRITICAL RULES you must follow:
1. Only reference column names that EXACTLY match the schema above
2. For aggregation, follow these semantic rules:
   - Identifiers (ID, code, key): COUNT or COUNT_DISTINCT only — never sum/avg
   - Age, experience, tenure: AVG or distribution — never SUM
   - Ratings, scores, performance: AVG or distribution — never SUM
   - Percentages, rates, attendance%: AVG — never SUM
   - Monetary amounts (salary, revenue, cost): SUM or AVG
   - Date columns: use for time-series grouping, trend, min/max — never sum/avg
   - Status columns: COUNT or percentage_distribution only
3. aggregation must be one of: sum, avg, count, count_distinct, none
4. chartType must be one of: line, bar, pie, scatter

Return ONLY valid JSON — no markdown, no explanation:
{
  "kpiCandidates": [
    {
      "title": "KPI Title",
      "column": "exact_column_name",
      "aggregation": "avg",
      "format": "number",
      "icon": "Activity",
      "color": "blue",
      "priority": "secondary",
      "businessReason": "Why this KPI is valuable for ${domain} analysis."
    }
  ],
  "chartCandidates": [
    {
      "title": "Chart Title",
      "chartType": "bar",
      "xField": "exact_column_name",
      "yField": "exact_column_name_or__count",
      "aggregation": "avg",
      "priority": "secondary",
      "businessReason": "Why this chart is valuable for ${domain} analysis."
    }
  ]
}`;
};

// ---------------------------------------------------------------------------
// AI enrichment
// ---------------------------------------------------------------------------

/**
 * Calls the AI to suggest additional candidates beyond the deterministic ones.
 * Returns raw suggestions that must be validated before use.
 *
 * @param {string} domain
 * @param {Array} schema
 * @param {Array} existingKPITitles
 * @param {Array} existingChartTitles
 * @returns {Promise<{ kpiCandidates: Array, chartCandidates: Array }>}
 */
const fetchAIEnrichment = async (domain, schema, existingKPITitles, existingChartTitles) => {
  if (!isGeminiAvailable()) {
    return { kpiCandidates: [], chartCandidates: [] };
  }

  try {
    const prompt = buildEnrichmentPrompt(domain, schema, existingKPITitles, existingChartTitles);
    const result = await geminiGenerate(prompt);

    if (!result || typeof result !== 'object') {
      console.warn('[RecommendationPipeline] AI enrichment returned non-object, skipping');
      return { kpiCandidates: [], chartCandidates: [] };
    }

    return {
      kpiCandidates: Array.isArray(result.kpiCandidates) ? result.kpiCandidates : [],
      chartCandidates: Array.isArray(result.chartCandidates) ? result.chartCandidates : []
    };
  } catch (err) {
    console.error('[RecommendationPipeline] AI enrichment error:', err.message);
    return { kpiCandidates: [], chartCandidates: [] };
  }
};

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Runs the full recommendation pipeline for a dataset.
 *
 * @param {string} domain - Detected dataset domain (e.g., 'hr', 'sales')
 * @param {Array} schema - DataSource.schema array
 * @param {Object} [options]
 * @param {boolean} [options.skipAI=false] - Skip AI enrichment (useful in tests)
 * @returns {Promise<{
 *   kpiCandidates: Array,
 *   chartCandidates: Array,
 *   columnSemantics: Map
 * }>}
 */
const runRecommendationPipeline = async (domain, schema, options = {}) => {
  const { skipAI = false } = options;
  const tag = '[RecommendationPipeline]';

  console.log(`${tag} Starting pipeline for domain: "${domain}" with ${schema.length} columns`);

  // ─── Step 1: Semantic Column Classification ──────────────────────────────
  const columnSemantics = classifyColumns(schema);

  console.log(`${tag} Semantic classification complete:`);
  for (const [col, sem] of columnSemantics.entries()) {
    console.log(`${tag}   "${col}" → ${sem.semanticRole} (${Math.round(sem.confidence * 100)}%) [agg=${sem.isAggregatable}, dim=${sem.isDimensionalizable}, temp=${sem.isTemporal}]`);
  }

  // ─── Step 2: Build column quality map ────────────────────────────────────
  const columnQualityMap = buildColumnQualityMap(schema);

  // ─── Step 2a: Relationship Modeling ──────────────────────────────────────
  const relationshipModel = buildRelationshipModel(columnSemantics);
  console.log(`${tag} Relationships: ${relationshipModel.relationships.length} discovered (` +
    `temporal=${relationshipModel.temporalColumns.length}, ` +
    `measures=${relationshipModel.measureColumns.length}, ` +
    `dimensions=${relationshipModel.dimensionColumns.length}, ` +
    `identifiers=${relationshipModel.identifierColumns.length})`);

  // ─── Step 2b: Capability Discovery ───────────────────────────────────────
  const capabilities = discoverCapabilities(relationshipModel);
  console.log(`${tag} Capabilities discovered: ${capabilities.map(c => `${c.capability}(${c.score})`).join(', ')}`);

  // ─── Step 2c: Analytical Intent Generation ────────────────────────────────
  const { kpiIntents, chartIntents } = generateIntents(capabilities, columnSemantics);
  console.log(`${tag} Intents: ${kpiIntents.length} KPI intents, ${chartIntents.length} chart intents`);

  // ─── Step 3: Universal KPI Candidate Generation (from intents) ───────────
  let kpiCandidates = generateUniversalKPICandidates(kpiIntents, columnSemantics);
  console.log(`${tag} Universal KPI candidates: ${kpiCandidates.length}`);

  // ─── Step 3b: Domain template supplement (fills gaps during transition) ──
  // Domain templates run as SECONDARY — they only add candidates not already
  // covered by the universal pipeline. Will be removed in Step 14.
  const domainKPIs = generateKPICandidates(domain, columnSemantics, schema);
  const universalKPIKeys = new Set(kpiCandidates.map(k => `${k.column}|${k.aggregation}`));
  const supplementKPIs = domainKPIs.filter(dk =>
    !universalKPIKeys.has(`${dk.column}|${dk.aggregation}`)
  ).map(dk => ({ ...dk, source: dk.source || 'domain-template' }));
  kpiCandidates = [...kpiCandidates, ...supplementKPIs];
  console.log(`${tag} Domain KPI supplement: +${supplementKPIs.length} candidates`);

  // ─── Step 4: Universal Chart Candidate Generation (from intents) ─────────
  let chartCandidates = generateUniversalChartCandidates(chartIntents, columnSemantics);
  console.log(`${tag} Universal chart candidates: ${chartCandidates.length}`);

  // ─── Step 4b: Domain template supplement ─────────────────────────────────
  const domainCharts = generateChartCandidates(domain, columnSemantics);
  const universalChartKeys = new Set(chartCandidates.map(c => `${c.xField}|${c.yField}|${c.aggregation}`));
  const supplementCharts = domainCharts.filter(dc =>
    !universalChartKeys.has(`${dc.xField}|${dc.yField}|${dc.aggregation}`)
  ).map(dc => ({ ...dc, source: dc.source || 'domain-template' }));
  chartCandidates = [...chartCandidates, ...supplementCharts];
  console.log(`${tag} Domain chart supplement: +${supplementCharts.length} candidates`);

  // ─── Step 4c: Statistical pre-execution validation ────────────────────────
  const kpiValidation = validateKPICandidates(kpiCandidates, columnSemantics);
  if (kpiValidation.rejected.length > 0) {
    console.log(`${tag} Statistical validator rejected ${kpiValidation.rejected.length} KPI candidates:`);
    kpiValidation.rejected.forEach(r => console.log(`${tag}   REJECTED KPI "${r.candidate.column}": ${r.reason}`));
  }
  kpiCandidates = kpiValidation.valid;

  const chartValidation = validateChartCandidates(chartCandidates, columnSemantics);
  if (chartValidation.rejected.length > 0) {
    console.log(`${tag} Statistical validator rejected ${chartValidation.rejected.length} chart candidates:`);
    chartValidation.rejected.forEach(r => console.log(`${tag}   REJECTED chart "${r.candidate.xField}→${r.candidate.yField}": ${r.reason}`));
  }
  chartCandidates = chartValidation.valid;

  // ─── Step 5: AI Enrichment ────────────────────────────────────────────────
  if (!skipAI) {
    const existingKPITitles = kpiCandidates.map(k => k.title);
    const existingChartTitles = chartCandidates.map(c => c.title);

    const aiResult = await fetchAIEnrichment(domain, schema, existingKPITitles, existingChartTitles);

    // Validate AI KPI candidates before accepting
    let aiKPIAccepted = 0;
    for (const aiKPI of (aiResult.kpiCandidates || [])) {
      const validated = validateExternalKPICandidate(aiKPI, columnSemantics);
      if (validated) {
        kpiCandidates.push({ ...validated, source: 'ai', priority: validated.priority || 'secondary', domainRelevance: 65 });
        aiKPIAccepted++;
      }
    }

    // Validate AI chart candidates before accepting
    let aiChartAccepted = 0;
    for (const aiChart of (aiResult.chartCandidates || [])) {
      const validated = validateExternalChartCandidate(aiChart, columnSemantics);
      if (validated) {
        chartCandidates.push({ ...validated, source: 'ai', priority: validated.priority || 'secondary' });
        aiChartAccepted++;
      }
    }

    console.log(`${tag} AI enrichment: ${aiKPIAccepted} KPIs and ${aiChartAccepted} charts accepted (out of ${aiResult.kpiCandidates.length} KPI and ${aiResult.chartCandidates.length} chart suggestions)`);
  }

  // ─── Step 6: Business Value Scoring ──────────────────────────────────────
  kpiCandidates = scoreAndRankKPIs(kpiCandidates, columnQualityMap);
  chartCandidates = scoreAndRankCharts(chartCandidates, columnQualityMap);

  // ─── Step 7: Deduplication ────────────────────────────────────────────────
  kpiCandidates = deduplicateKPIs(kpiCandidates);
  chartCandidates = deduplicateCharts(chartCandidates);

  // ─── Step 8: Apply Limits ────────────────────────────────────────────────
  kpiCandidates = applyKPILimits(kpiCandidates);
  chartCandidates = applyChartLimits(chartCandidates);

  console.log(`${tag} Final: ${kpiCandidates.length} KPIs, ${chartCandidates.length} charts`);
  kpiCandidates.forEach(k => console.log(`${tag}   KPI: "${k.title}" (col=${k.column}, agg=${k.aggregation}, score=${k.score}, src=${k.source || 'unknown'})`));
  chartCandidates.forEach(c => console.log(`${tag}   Chart: "${c.title}" (x=${c.xField}, y=${c.yField}, agg=${c.aggregation}, score=${c.score}, src=${c.source || 'unknown'})`));

  return {
    kpiCandidates,
    chartCandidates,
    columnSemantics,
    // Expose relationship model and capabilities for downstream use
    relationshipModel,
    capabilities
  };
};

module.exports = {
  runRecommendationPipeline
};
