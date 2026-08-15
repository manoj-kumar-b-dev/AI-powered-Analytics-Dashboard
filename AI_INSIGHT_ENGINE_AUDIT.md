# AI Insight Engine Architecture Audit

## 1. Overview
This audit examines the existing analytics infrastructure, data models, calculation services, LLM integration modules, and runtime flow in the AI-powered Analytics Dashboard workspace.

The goal is to prepare for the implementation of the **AI Insight Generation Feature** (Insight Engine), strictly adhering to the architectural boundary: **The Insight Engine must NEVER perform data calculations or compute raw metrics.** It interprets pre-calculated, structured analytics outputs produced by the Universal Analytics Engine.

---

## 2. Reusable Analytics & Calculation Modules

| Module / Service | File Path | Responsibilities & Capabilities |
| :--- | :--- | :--- |
| **AnalyticsService** | [`backend/src/services/analyticsService.js`](file:///e:/AI-powered-Analytics-Dashboard/backend/src/services/analyticsService.js) | Computes KPIs, generates temporal/categorical aggregated charts, calculates period-over-period comparisons (`calculateKPIs`, `generateCharts`, `generateDashboard`). |
| **AnalyticsEngine** | [`backend/src/services/analytics/analyticsEngine.js`](file:///e:/AI-powered-Analytics-Dashboard/backend/src/services/analytics/analyticsEngine.js) | Statistical engine computing Pearson Correlation Matrix (`calculateCorrelationMatrix`), time-series linear forecasts (`forecastSeries`), and Z-Score outlier detection (`detectAnomalies`). |
| **TemporalAggregationExecutor** | [`backend/src/analytics/execution/temporalAggregationExecutor.js`](file:///e:/AI-powered-Analytics-Dashboard/backend/src/analytics/execution/temporalAggregationExecutor.js) | Constructs granularity-aware MongoDB aggregation pipelines (day, week, month, year) for time series data. |
| **RuleEngineService** | [`backend/src/services/ruleEngine/ruleEngineService.js`](file:///e:/AI-powered-Analytics-Dashboard/backend/src/services/ruleEngine/ruleEngineService.js) | Evaluates business thresholds against rows to identify data anomalies and rule alerts. |
| **AnalysisEngine** | [`backend/src/services/analysisEngine.js`](file:///e:/AI-powered-Analytics-Dashboard/backend/src/services/analysisEngine.js) | Safe server-side execution engine for ad-hoc queries (`group_by`, `compare_periods`, `filter_and_aggregate`, `top_n`). |

---

## 3. Existing Analytics Outputs & Data Contracts

Final analytics exist in MongoDB models and are cached in the `Analytics` collection:

1. **KPI Cards** (`AnalyticsService.calculateKPIs`):
   - `kpi`: Metric key (e.g., `revenue`, `total_count`).
   - `label`: Display title.
   - `value`: Raw calculated numeric value.
   - `formattedValue`: Abbreviated & currency-formatted string (e.g. `₹1.5M`).
   - `deltaPct`: Period-over-period change percentage.
   - `deltaDirection`: Direction (`up`, `down`, `flat`).
   - `period`: Comparison label (`vs prior period`).

2. **Charts & Widgets** (`AnalyticsService.generateCharts`):
   - `id`, `type`: Widget identifier and chart type (`line-chart`, `bar-chart`, `pie-chart`).
   - `title`: Generated title.
   - `config`: `{ xField, yField, aggregation }`.
   - `resolvedData`: Aggregation results `[{ x, y }]`.
   - `forecast`: Linear regression forecast data points `[{ x, y }]`.

3. **Statistics & Correlations** (`AnalyticsEngine`):
   - Pearson matrix: `[{ variable: "colA", correlations: [{ variable: "colB", correlation: 0.85 }] }]`.

4. **Outliers & Anomalies** (`AnalyticsEngine` & `RuleEngineService`):
   - Z-score outliers: `[{ index, point: { x, y }, zScore, message }]`.
   - Rule alerts: `[{ label, severity, triggeredCount }]`.

---

## 4. Dashboard Configuration & Persistence

- **Data Source Model**: [`backend/src/models/dataSource.js`](file:///e:/AI-powered-Analytics-Dashboard/backend/src/models/dataSource.js) — Stores schema, domain classification, and column mapping (`kpiMapping`).
- **Analytics Cache Model**: [`backend/src/models/analytics.js`](file:///e:/AI-powered-Analytics-Dashboard/backend/src/models/analytics.js) — Persists `{ dataSourceId, orgId, kpis, charts, insights, filters, reports, recommendations }`.
- **Controller**: [`backend/src/controllers/dashboardAnalyticsController.js`](file:///e:/AI-powered-Analytics-Dashboard/backend/src/controllers/dashboardAnalyticsController.js) — Handles cached dashboard fetching via `GET /dashboard-analytics/:dataSourceId`.

---

## 5. LLM Integration Infrastructure

- **Client Wrapper**: [`backend/src/config/gemini.js`](file:///e:/AI-powered-Analytics-Dashboard/backend/src/config/gemini.js)
  - Supports **Gemini** (`gemini-2.0-flash`), **Groq** (`llama-3.3-70b-versatile`), and **xAI Grok** (`grok-beta`).
  - Implements automatic request rate limiting queue (`QUEUE_DELAY_MS = 4000`).
  - Generates strictly structured JSON objects (`responseMimeType: 'application/json'`).
- **Current Insight Service**: [`backend/src/services/insightGenerator/insightGeneratorService.js`](file:///e:/AI-powered-Analytics-Dashboard/backend/src/services/insightGenerator/insightGeneratorService.js)
  - Currently takes basic KPI summaries and rule engine alerts to generate basic insights.

---

## 6. Runtime Flow

```
Dataset Upload (CSV/Excel)
       ↓
Dataset Parser Service & Metadata Profiler
       ↓
Dataset Classifier Service (Domain Identification: Sales, HR, Finance, etc.)
       ↓
KPI & Chart Recommendation Services
       ↓
Universal Analytics Engine (Mongo Aggregation, AnalyticsEngine Correlations & Outliers)
       ↓
Analytics Execution Results (KPIs, Charts, Correlations, Outliers, Trends)
       ↓
[NEW] Analytics Context Builder (Normalizes outputs into single object without re-calculation)
       ↓
[NEW] LLM Insight Generator (System Prompt + Zero Calculation Policy + Strict JSON Schema)
       ↓
Structured Insights (Executive Summary, Key Insights, Patterns, Anomalies, Risks, Opportunities, Recommendations)
```

---

## 7. Next Steps for Implementation

With the runtime flow and analytics locations established, implementation will proceed through the following phases:
1. **AnalyticsContextBuilder**: Assembles calculated metrics into a normalized JSON structure.
2. **LLM Prompting & Strict JSON Schema**: Crafts senior business analyst system prompt prohibiting calculation or fabrication.
3. **Structured Generators**: Implements Executive Summary, Key Insights, Patterns, Anomalies, Risks, Opportunities, and Recommendations.
4. **Frontend UI Components**: Builds reusable React cards (`ExecutiveSummaryCard`, `InsightCard`, `PatternCard`, `RiskCard`, `OpportunityCard`, `RecommendationCard`) and `Explain Chart` modal.
5. **Multi-Domain Verification**: Validates across 10 dataset domains (Sales, HR, Finance, Healthcare, Education, IoT, Inventory, Survey, Marketing, Unknown).
