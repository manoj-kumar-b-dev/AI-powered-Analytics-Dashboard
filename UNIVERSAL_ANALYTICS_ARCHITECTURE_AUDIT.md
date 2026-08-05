# Universal Analytics Architecture Audit

**Project:** AI-powered SaaS Analytics Dashboard  
**Status:** Phase 1 — Complete Deep Audit (Ready for Phase 2 Planning)  
**Auditor:** Principal AI Analytics Architect  
**Audit Date:** 2026-07-14  
**Codebase Snapshot:** `e:\AI-powered-Analytics-Dashboard`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Actual Runtime Architecture & Data Flow](#2-actual-runtime-architecture--data-flow)
3. [Complete File Inventory](#3-complete-file-inventory)
4. [Critical Findings — Answers to Audit Questions](#4-critical-findings--answers-to-audit-questions)
5. [Architectural Violations](#5-architectural-violations)
6. [Dead Code Inventory](#6-dead-code-inventory)
7. [Domain-Specific Code Inventory](#7-domain-specific-code-inventory)
8. [Current Scoring & Selection Logic](#8-current-scoring--selection-logic)
9. [LLM Responsibility Audit](#9-llm-responsibility-audit)
10. [Frontend Analytics Audit — Critical Finding](#10-frontend-analytics-audit--critical-finding)
11. [Temporal Intelligence Audit](#11-temporal-intelligence-audit)
12. [Missing Architecture — Target vs Actual](#12-missing-architecture--target-vs-actual)
13. [What Is Already Good — Reuse List](#13-what-is-already-good--reuse-list)
14. [Recommended Migration Plan](#14-recommended-migration-plan)

---

## 1. Executive Summary

The project contains **two partially overlapping analytics systems** operating simultaneously:

### System A — Backend Semantic Pipeline (Primary)

The dominant pipeline is **domain-template-driven**. The flow is:

```
Upload → Domain Detect → Domain Profile Templates → Semantic Validate → AI Enrich → Score → Dedup → Execute → Dashboard
```

Domain detection via `DatasetClassifierService` controls which hardcoded template set (`domainProfiles.js`, 1,070 lines, 13+ domains) is used to generate ALL KPI and chart candidates. Datasets that do not match a domain fall into a `general` fallback with minimal templates.

### System B — Frontend Visualization Pipeline (Secondary — CRITICAL FINDING)

A **completely separate** analytics pipeline exists inside the React frontend. `useAutoVisualization.js` + `visualizationUtils.js` (782 lines) independently detects column types, aggregates raw data rows in the browser, recommends chart types, and generates NLP insights — all in pure JavaScript on the client side. This powers the Dataset Preview / Analytics tab.

### Core Problems

| # | Problem | Impact |
|---|---------|--------|
| 1 | Domain templates control candidate generation | Unrecognized datasets get minimal dashboards |
| 2 | No pre-execution statistical validation | Low-variance or insufficient data charts pass through |
| 3 | No post-execution result validation | NaN, Infinity, empty results render on the dashboard |
| 4 | No Analytical Intent layer | Charts are selected from templates, not from analytical questions |
| 5 | Frontend recalculates analytics independently | Duplicate logic, inconsistent results between tabs |
| 6 | Temporal aggregation is naive | Raw ISO date strings grouped individually — no granularity selection |
| 7 | No pipeline observability | No structured trace of what was generated, rejected, or selected |
| 8 | Filter application regenerates the entire pipeline | Every filter re-runs domain classify + template match + AI call |
| 9 | `services/ai/` folder contains 10+ dead files | Confusion about the active LLM code path |
| 10 | Hardcoded domain-specific filter keys in Zustand store | Filter UI assumes sales/HR column names |

---

## 2. Actual Runtime Architecture & Data Flow

### 2.1 Dataset Upload Flow

```
[Browser] File drag-and-drop or file picker
       |
       v POST /datasources/upload  (multipart/form-data)
[dataSourceController.js].uploadFile()
       |
       v
[dataSourceService.js].handleFileImport()
       |
       v
[parserService.js].parseUploadedFile()
   |-- Papa.parse (CSV) or XLSX.read (Excel)
   |-- sanitizeHeaders()       -- strips special chars, deduplicates column names
   |-- inferSchema()           -- samples all rows, detects 7 types via 80% vote:
   |       text / numeric / date / boolean / categorical / currency / percentage
   |-- validateRows()          -- counts type-mismatch rows for data quality report
   +-- Returns: { headers, rows, schema, rowCount, sheetNames, validation }
       |
       v
[DataSource model] saved to MongoDB (schema stored, rows NOT yet saved)
       |
       v
[Response] --> Frontend shows schema confirmation step with column type preview
```

### 2.2 Schema Confirmation & Analytics Generation

```
[Browser] User clicks "Confirm & Save"
       |
       v POST /datasources/:id/confirm
[dataSourceController.js].confirmDataSource()
       |
       v
All rows cast to correct types and saved as individual DataRow documents in MongoDB
       |
       v
[analyticsService.js].persistAnalytics(dataSourceId, orgId)
       |
       v
[analyticsService.js].generateDashboard(dataSource, filters={})
       |
       |-- STEP 1: Domain Classification
       |       [datasetClassifierService.js].classifyDataset(fileName, schema)
       |       -- Keyword matching: normalized column names vs. 15 domain keyword lists
       |       -- Primary keywords = 3 pts, secondary = 1 pt, filename match = 2 pts extra
       |       -- Returns: { domain, domainLabel, confidence }
       |       -- CRITICAL: This domain string controls ALL downstream candidate generation
       |
       |-- STEP 2: KPI Recommendation
       |       [kpiRecommendationService.js].recommendKPIs(schema, domain)
       |           +-- [recommendationPipeline.js].runRecommendationPipeline(domain, schema)
       |               |-- [semanticClassifier.js].classifyColumns(schema)
       |               |       -> Returns Map<columnName, { semanticRole, confidence, reason }>
       |               |       -> 16 semantic roles (identifier, monetary_metric, ...)
       |               |       -> Pure regex + cardinality-based classification
       |               |       -> NO statistical summaries (min/max/mean/stddev not computed here)
       |               |
       |               |-- [businessValueScorer.js].buildColumnQualityMap(schema)
       |               |       -> Computes missing-value penalty per column
       |               |
       |               |-- [kpiCandidateGenerator.js].generateKPICandidates(domain, columnSemantics, schema)
       |               |       +-- getDomainProfile(domain)  <-- LOADS HARDCODED DOMAIN TEMPLATE
       |               |           Iterates domain kpiTemplates[]
       |               |           Validates aggregation via aggregationRules.js
       |               |           Returns matched KPI candidates for this domain only
       |               |
       |               |-- [chartCandidateGenerator.js].generateChartCandidates(domain, columnSemantics)
       |               |       +-- getDomainProfile(domain)  <-- LOADS HARDCODED DOMAIN TEMPLATE
       |               |           Validates aggregation via aggregationRules.js
       |               |
       |               |-- AI Enrichment (Gemini/Groq via config/gemini.js)
       |               |       -- Prompt: "You are a {domain} analyst. Suggest 4 additional KPIs/charts..."
       |               |       -- Response validated by validateExternalKPICandidate / validateExternalChartCandidate
       |               |       -- Accepted AI candidates added to candidate pool
       |               |
       |               |-- [businessValueScorer.js].scoreAndRankKPIs() / scoreAndRankCharts()
       |               |       -- 7-dimension weighted scoring (domain relevance 25%)
       |               |
       |               |-- [deduplicator.js].deduplicateKPIs() / deduplicateCharts()
       |               |       -- Exact dedup by column+aggregation signature
       |               |       -- Intent dedup by xField+yField+aggregation (charts)
       |               |
       |               +-- [deduplicator.js].applyKPILimits() / applyChartLimits()
       |                       -- Max 6 KPIs, Max 6 charts total (4 primary + up to 3 secondary)
       |
       |-- STEP 3: KPI Execution
       |       [analyticsService.js].calculateKPIs(dataSource, activeKPIs, filters)
       |           -- MongoDB aggregate() calls on DataRow collection
       |           -- Supports: sum, avg, count, count_distinct
       |           -- Period comparison: splits dataset chronologically for delta percentage
       |           -- Growth KPI auto-appended if date column + period bounds exist
       |           -- NO validation of resulting values (NaN, Infinity not checked)
       |
       |-- STEP 4: Chart Execution
       |       [analyticsService.js].generateCharts(dataSource, mappedCols, filters, domain)
       |           -- For each chart candidate:
       |             MongoDB aggregate() -> group by xField -> compute yVal
       |           -- Date columns: grouped as-is (NO temporal granularity selection)
       |           -- Scatter plots: raw rows projected (up to 100)
       |           -- Line charts: linear forecast appended via analyticsEngine.forecastSeries()
       |           -- Result capped at 100 points (downsampling, not aggregation)
       |           -- NO check for zero variance, empty results, NaN
       |
       |-- STEP 5: Rule Engine
       |       [ruleEngineService.js].evaluateRules(dataSourceId)
       |
       |-- STEP 6: Insight Generation (LLM)
       |       [insightGeneratorService.js].generateInsights(kpis, alerts, domain, domainLabel)
       |           -- Gemini/Groq prompt with computed KPI values and rule alerts
       |           -- Falls back to rule-based insights if AI unavailable
       |
       +-- Returns: { domain, domainLabel, confidence, kpis, charts, insights, filters, reports, recommendations }
           |
           v
       Saved to Analytics collection (MongoDB cache, 6-hour TTL)
```

### 2.3 Dashboard Loading Flow

```
[Browser] Dashboard mounts -> fetchDashboard()
       |
       v GET /dashboard?datasetId=...&[filters]
[dashboardAnalyticsController.js].getUnifiedDashboard()
       |
       |-- IF filters present (date, department, region, product, category, salesperson):
       |       -> Re-runs AnalyticsService.generateDashboard() FULLY
       |          (re-classifies domain, re-runs templates, re-calls AI, re-executes all queries)
       |
       +-- IF no filters:
               -> Checks Analytics cache (6h TTL)
               -> If stale/missing: calls AnalyticsService.persistAnalytics()
               -> Returns cached { kpis, charts, insights, filters, reports, recommendations }
```

> **CRITICAL BUG:** Every filter application re-runs the ENTIRE pipeline including domain classification, template matching, and AI enrichment. This is extremely expensive and semantically wrong — filtering should only affect aggregation queries, not recommendation generation.

### 2.4 Frontend Dataset Preview (Parallel Analytics System)

```
[Dashboard.jsx] renders <AutoVisualizationContainer dsId=... />
       |
       v
[useAutoVisualization.js]
       |-- fetchDataSourceAllRows(dsId) -> GET /datasources/:id/rows -> returns ALL raw rows to browser
       |-- detectColumnTypes(rawRows, headers) -> frontend type detection (visualizationUtils.js)
       |-- recommendChart(colTypes, rawRows, headers) -> frontend chart type selection
       |-- aggregateData(rawRows, xField, yField, aggregation, ...) -> JS aggregation in browser
       +-- generateInsights(aggregatedData, ...) -> frontend NLP insight generation
```

> **CRITICAL VIOLATION:** This is a complete second analytics pipeline running in the browser. It contradicts the architectural requirement that the frontend must NOT calculate KPIs, decide aggregations, or perform semantic analysis.

---

## 3. Complete File Inventory

### 3.1 Backend — Ingestion & Parsing

| File | Responsibility | Lines | Status |
|------|---------------|-------|--------|
| `backend/src/services/parserService.js` | CSV/Excel parsing, schema inference (7 types), row casting, validation | 355 | **Keep & Strengthen** — lacks null ratio, unique ratio, statistical summaries |
| `backend/src/services/dataSourceService.js` | File import orchestration, DataSource creation | 151 | **Keep** |
| `backend/src/controllers/dataSourceController.js` | REST endpoints for upload, confirm, delete | 168 | **Keep** |
| `backend/src/models/dataSource.js` | DataSource Mongoose schema | 67 | **Keep** |
| `backend/src/models/dataRow.js` | Individual row storage | 17 | **Keep** |

### 3.2 Backend — Classification

| File | Responsibility | Lines | Status |
|------|---------------|-------|--------|
| `backend/src/services/datasetClassifier/datasetClassifierService.js` | Keyword-based domain detection (15 domains) | 182 | **Demote to Optional Context** — must NOT control candidates |
| `backend/src/analytics/semantic/semanticClassifier.js` | Column -> 16 semantic roles (name regex + cardinality) | 468 | **Keep & Strengthen** — add stats-based profiling |
| `backend/src/analytics/domain/domainProfiles.js` | 13 domain templates (KPI + chart configs), 1,070 lines | 1070 | **PRIMARY BLOCKER — Remove** after universal replacement |

### 3.3 Backend — Candidate Generation

| File | Responsibility | Lines | Status |
|------|---------------|-------|--------|
| `backend/src/analytics/kpi/kpiCandidateGenerator.js` | KPI candidates from domain templates | 205 | **Replace** — switch to intent-based universal generation |
| `backend/src/analytics/charts/chartCandidateGenerator.js` | Chart candidates from domain templates | 277 | **Replace** — switch to intent-based universal generation |
| `backend/src/analytics/aggregation/aggregationRules.js` | Aggregation validity rules per semantic role | 306 | **Keep & Extend** — excellent foundation |

### 3.4 Backend — Recommendation Orchestration

| File | Responsibility | Lines | Status |
|------|---------------|-------|--------|
| `backend/src/analytics/recommendations/recommendationPipeline.js` | Main recommendation orchestrator | 241 | **Modify** — replace domain-template path with intent-based path |
| `backend/src/analytics/recommendations/deduplicator.js` | KPI/chart deduplication + limits | 208 | **Keep & Extend** — add diversity optimization |
| `backend/src/services/kpiRecommendation/kpiRecommendationService.js` | Thin wrapper calling recommendation pipeline | 82 | **Keep** |
| `backend/src/services/chartRecommendation/chartRecommendationService.js` | Thin wrapper calling recommendation pipeline | 66 | **Keep** |

### 3.5 Backend — Scoring

| File | Responsibility | Lines | Status |
|------|---------------|-------|--------|
| `backend/src/analytics/scoring/businessValueScorer.js` | 7-dimension weighted scoring (domain relevance 25%) | 278 | **Replace** — rewrite as Analytical Utility Scorer |

### 3.6 Backend — Execution & Orchestration

| File | Responsibility | Lines | Status |
|------|---------------|-------|--------|
| `backend/src/services/analyticsService.js` | Main pipeline orchestrator + KPI/chart MongoDB execution | 729 | **Modify** — integrate new phases, fix filter-regeneration bug |
| `backend/src/services/analytics/analyticsEngine.js` | Pearson correlation, linear forecast, anomaly detection | 141 | **Keep** — reuse for correlation intent |
| `backend/src/controllers/dashboardAnalyticsController.js` | Dashboard GET + filter routing | 108 | **Modify** — fix filter-causes-full-regen bug |
| `backend/src/services/ruleEngine/ruleEngineService.js` | Simple rule evaluation | 93 | **Keep** |

### 3.7 Backend — AI / LLM

| File | Responsibility | Lines | Status |
|------|---------------|-------|--------|
| `backend/src/config/gemini.js` | Gemini + Groq client (queue-based, rate limited) | 140 | **Keep** — used by active recommendation pipeline |
| `backend/src/config/aiConfig.js` | AI provider config (multi-provider) | ~80 | **Keep** |
| `backend/src/services/ai/llmClient.js` | Multi-provider LLM dispatch (Gemini, Groq, OpenAI, Anthropic) | 364 | **DEAD CODE** — not called by active pipeline |
| `backend/src/services/ai/aiService.js` | Hardcoded keyword-based chat responses | 92 | **DEAD CODE — Delete** |
| `backend/src/services/ai/kpiRecommendationEngine.js` | Old LLM-based KPI recommender | 148 | **DEAD CODE — Delete** |
| `backend/src/services/ai/chartRecommendationEngine.js` | Old LLM-based chart recommender | ~200 | **DEAD CODE — Delete** |
| `backend/src/services/ai/columnRoleDetector.js` | Old column role detector | 185 | **DEAD CODE — Delete** |
| `backend/src/services/ai/datasetClassifier.js` | Old LLM-based classifier | 119 | **DEAD CODE — Delete** |
| `backend/src/services/ai/geminiClient.js` | Old Gemini wrapper | 21 | **DEAD CODE — Delete** |
| `backend/src/services/ai/insightGenerator.js` | Old insight generator | 183 | **DEAD CODE — Delete** |
| `backend/src/services/ai/promptBuilder.js` | Prompt builder for old pipeline | 81 | **DEAD CODE — Delete** |
| `backend/src/services/ai/responseParser.js` | Response parser for old pipeline | 52 | **DEAD CODE — Delete** |
| `backend/src/services/ai/retryHandler.js` | Retry logic for old pipeline | 140 | **DEAD CODE — Delete** |
| `backend/src/services/ai/schemaValidator.js` | Zod schema validator for old pipeline | 30 | **DEAD CODE — Delete** |
| `backend/src/services/insightGenerator/insightGeneratorService.js` | Active LLM insight generation | 163 | **Keep & Upgrade** |

### 3.8 Backend — Metadata & Profiling

| File | Responsibility | Lines | Status |
|------|---------------|-------|--------|
| `backend/src/services/metadata/extractMetadata.js` | Metadata extraction | ~100 | **Audit needed** |
| `backend/src/services/metadata/detectors/typeDetectors.js` | Physical type detection | ~200 | **Keep** |
| `backend/src/services/metadata/detectors/missingValueDetector.js` | Missing value detection | ~20 | **Keep** |
| `backend/src/services/metadata/detectors/duplicateDetector.js` | Duplicate row detection | ~60 | **Keep** |
| `backend/src/services/ruleEngine/classifyColumns.js` | Column classification | 78 | **Audit** — may duplicate semanticClassifier |

### 3.9 Backend — Models

| File | Responsibility | Lines | Status |
|------|---------------|-------|--------|
| `backend/src/models/analytics.js` | Analytics document (all Mixed types — flexible) | 20 | **Keep** |
| `backend/src/models/dataSource.js` | DataSource with schema[] and validation | 67 | **Keep** — may need `columnSemantics` field added |
| `backend/src/models/dashboardPreference.js` | User widget preferences | 27 | **Keep** |

### 3.10 Frontend — Dashboard Rendering

| File | Responsibility | Lines | Status |
|------|---------------|-------|--------|
| `frontend/src/features/dashboard/pages/Dashboard.jsx` | Main dashboard page | 343 | **Keep — render-only** |
| `frontend/src/features/dashboard/DashboardRenderer.jsx` | Layout grid + widget dispatch | 113 | **Keep — render-only** |
| `frontend/src/features/dashboard/ChartWidget.jsx` | Recharts chart renderer | 189 | **Keep — render-only** |
| `frontend/src/features/dashboard/KpiCard.jsx` | KPI card renderer | ~100 | **Keep — render-only** |
| `frontend/src/features/dashboard/store/dashboardStore.js` | Zustand store — API calls + filter state | 84 | **Modify** — fix hardcoded filter keys |

### 3.11 Frontend — Second Analytics Pipeline (Violation)

| File | Responsibility | Lines | Status |
|------|---------------|-------|--------|
| `frontend/src/utils/visualizationUtils.js` | Type detect, chart recommend, aggregate, insight gen IN BROWSER | 782 | **Must Restrict** — move aggregation to backend |
| `frontend/src/features/analytics/hooks/useAutoVisualization.js` | Hook orchestrating frontend analytics | 175 | **Must Restrict** — should only render backend results |
| `frontend/src/features/analytics/components/AutoVisualizationContainer.jsx` | Full frontend analytics UI | ~262 | **Modify** — keep UI, remove frontend aggregation |
| `frontend/src/features/analytics/components/ChartRenderer.jsx` | Complex chart rendering | ~600 | **Keep — render-only after fix** |
| `frontend/src/features/analytics/components/ChartControls.jsx` | User chart type/axis controls | ~400 | **Keep** |
| `frontend/src/features/analytics/components/ChartInsights.jsx` | Insight display | ~150 | **Keep** |

---

## 4. Critical Findings — Answers to Audit Questions

### Q1: What happens after a dataset is uploaded?

`parserService.js` detects physical types only (no semantic profiling, no null ratio, no unique ratio, no statistical summaries). The schema is saved with `sampleValues[]`. Rows are NOT saved until the user confirms. Upon confirmation, rows are bulk-saved as `DataRow` documents and `analyticsService.persistAnalytics()` triggers the full pipeline.

### Q2: Which service is the pipeline orchestrator?

`analyticsService.js` — the `generateDashboard()` static method is the single entry point. It chains: domain classifier -> KPIRecommendationService -> ChartRecommendationService -> MongoDB execution queries -> insight generation.

### Q3: Is the old architecture still active?

Yes. The `services/ai/` folder contains 10+ files from a previous LLM-first architecture that are **completely unused** by the active pipeline.

### Q4: Is more than one analytics pipeline active?

**Yes — two pipelines are active:**
1. **Backend Semantic Pipeline** — powers the main dashboard KPIs and charts
2. **Frontend Visualization Pipeline** — powers the Dataset Preview / Analytics tab with client-side aggregation

### Q5: Is domain classification controlling recommendation generation?

**Yes — critically so.** `DatasetClassifierService.classifyDataset()` returns a domain string that flows into `runRecommendationPipeline()`, which calls `getDomainProfile(domain)` to load the KPI and chart templates. Domain is the primary selector of what analytics get generated.

### Q6: Are there domain-specific recommendation templates?

Yes. `domainProfiles.js` contains templates for: `hr`, `sales`, `marketing`, `finance`, `crm`, `inventory`, `ecommerce`, `customer_support`, `healthcare`, `education`, `manufacturing`, `logistics`, `banking`, `project_management`, `general`. Each defines exact column patterns, aggregations, icons, and priorities hardcoded per domain.

### Q7: Domain-specific rules?

Yes. Every domain has `kpiTemplates[]` and `chartTemplates[]` with `requiredSemanticRoles`, `preferredColumnPatterns`, and domain-specific labels. The AI enrichment prompt explicitly states: `"You are a senior business intelligence analyst specializing in ${domain.toUpperCase()} analytics."` The domain string embeds itself into the AI system prompt.

### Q8: Is the LLM generating actual KPI values?

**No.** The LLM (Gemini/Groq) only suggests candidate *specifications* (column name, aggregation type, title). All calculations are MongoDB aggregate pipelines executed deterministically by `analyticsService.js`.

### Q9: Is the frontend calculating analytics?

**Yes — in the AutoVisualization path.** `visualizationUtils.js` `aggregateData()` performs JavaScript-based grouping and aggregation of raw rows in the browser. `recommendChart()` selects chart types based on detected column types. This directly contradicts the architectural requirement.

### Q10: Are raw rows sent directly to charts?

- **Main dashboard non-scatter charts**: No — pre-aggregated `{ x, y }` points returned  
- **Main dashboard scatter charts**: Yes — up to 100 raw rows projected with `$project`  
- **AutoVisualization (preview tab)**: Yes — ALL rows fetched, aggregated in browser via JavaScript

### Q11: Where are aggregations executed?

- **Main dashboard**: MongoDB `aggregate()` in `analyticsService.generateCharts()`
- **AutoVisualization preview**: JavaScript `aggregateData()` in `visualizationUtils.js` (browser)

### Q12: Where are dates aggregated?

- **Main dashboard**: `$group: { _id: "$data.dateCol" }` — groups by exact date value stored. No granularity selection. Results sorted chronologically. Raw ISO strings formatted to `YYYY-MM-DD` after query. **No month/week/quarter grouping.** Downsampling via interval skipping (not temporal aggregation).
- **AutoVisualization**: `visualizationUtils.js` has date granularity selection but runs in the browser.

### Q13: How are candidates scored?

`businessValueScorer.js` uses 7 dimensions (see Section 8 for full breakdown). The dominant weight is **Domain Relevance at 25%**, drawn from the hardcoded template's `domainRelevance` field (85–100 for primary domain templates, 65 for AI-generated candidates).

### Q14: How are final recommendations selected?

1. Scored and sorted descending by weighted score  
2. KPI dedup: exact `column + aggregation` signature  
3. Chart dedup: exact signature, then intent signature (`xField + yField + agg`)  
4. Limits applied: max 6 KPIs, max 6 charts total

### Q15: Why does dashboard quality differ between datasets?

1. **Domain mismatch**: Column names don't match keywords -> wrong or `general` domain -> few templates fire
2. **Template column matching failure**: `findBestColumn()` may find no match -> KPI/chart template silently skipped
3. **AI enrichment inconsistency**: AI suggestions are not always accepted; prompt quality depends on domain
4. **No statistical validation**: Zero-variance results, single-category breakdowns, empty time series all pass
5. **No result validation**: NaN values, empty result arrays render on the dashboard

---

## 5. Architectural Violations

### Violation 1: Domain as Primary Controller (Critical)

```
analyticsService.generateDashboard()
  -> DatasetClassifierService.classifyDataset()   <- determines domain string
  -> KPIRecommendationService.recommendKPIs(schema, domain)
     -> runRecommendationPipeline(domain, schema)
        -> generateKPICandidates(domain, ...)
           -> getDomainProfile(domain)   <- ALL candidates sourced from domain template
```

The domain string passes through 4 layers and controls 100% of deterministic candidate generation.

### Violation 2: Frontend Analytics Calculation

`useAutoVisualization.js` -> `aggregateData()` in `visualizationUtils.js` performs grouping, filtering, and aggregation of raw rows in JavaScript in the browser, violating the principle that "the frontend must NOT calculate KPIs, decide aggregations, or perform semantic analysis."

### Violation 3: Filter Application Reruns Entire Pipeline

```javascript
// dashboardAnalyticsController.js — current behavior
if (hasFilters) {
  const filteredData = await AnalyticsService.generateDashboard(dataSource.toObject(), filters);
  // This re-runs: domain classify + template match + AI enrich + full execution
}
```

Applying a date filter should only affect MongoDB aggregate queries, NOT recommendation generation.

### Violation 4: No Analytical Intent Layer

The pipeline jumps directly from semantic classification to chart selection via domain templates. There is no intermediate representation of "what analytical question does this chart answer?" The Analytical Intent concept does not exist in the current system.

### Violation 5: No Result Validation

After `DataRow.aggregate(pipeline)`, results are immediately placed in `charts[].resolvedData`. There is no check for empty result arrays, NaN or Infinity values, zero variance (all Y values identical), single data point, or excessive categories in pie charts.

### Violation 6: Temporal Intelligence Missing

The current date grouping:
```javascript
pipeline.push({ $group: { _id: `$data.${xField}` } });
// Groups by exact Date object value — no monthly/quarterly aggregation
// 365 days of data produces 365 data points, then downsampled by skipping
```

No `TemporalAggregationExecutor`, no granularity selection based on date range, no `$dateToString` formatting.

### Violation 7: Duplicate Type Detection Logic

Type detection exists in three separate, inconsistent places:
1. `parserService.js` (backend, 80% threshold voting, 7 types)
2. `visualizationUtils.js` (frontend, own implementation, different logic)
3. `semanticClassifier.js` (backend, reads schema `type` field from parser output)

### Violation 8: Hardcoded Filter Keys in Frontend Store

```javascript
// dashboardStore.js — domain-specific filter keys
filters: {
  date: "", department: "", region: "", product: "", category: "", salesperson: ""
}
```

These are sales/HR-specific keys hardcoded in the Zustand store. They do not adapt to the actual dataset columns.

---

## 6. Dead Code Inventory

The following files are entirely unused by the active runtime pipeline. They represent a previous LLM-first architecture attempt.

| File | Why Dead |
|------|----------|
| `backend/src/services/ai/aiService.js` | Hardcoded keyword-based chat. Not imported by any active route. |
| `backend/src/services/ai/kpiRecommendationEngine.js` | Calls `repositories/datasetRepository` (not in active service index). Uses old retryHandler. |
| `backend/src/services/ai/chartRecommendationEngine.js` | Same old architecture. Superseded by chartCandidateGenerator. |
| `backend/src/services/ai/columnRoleDetector.js` | Old role detector. Superseded by `semanticClassifier.js`. |
| `backend/src/services/ai/datasetClassifier.js` | Old LLM-based classifier. Superseded by `datasetClassifierService.js`. |
| `backend/src/services/ai/geminiClient.js` | Old Gemini wrapper. Active pipeline uses `config/gemini.js`. |
| `backend/src/services/ai/insightGenerator.js` | Old insight generator. Active is `insightGeneratorService.js`. |
| `backend/src/services/ai/promptBuilder.js` | Prompt builder for old pipeline. |
| `backend/src/services/ai/responseParser.js` | Response parser for old pipeline. |
| `backend/src/services/ai/retryHandler.js` | Retry logic for old pipeline. |
| `backend/src/services/ai/schemaValidator.js` | Zod validation for old pipeline. |
| `backend/src/services/dashboard/dashboardGenerator.js` | Old dashboard generator. |
| `backend/test-err.js` | Root-level throwaway test script. |
| `backend/test-mapping.js` | Root-level throwaway test script. |
| `backend/test_gemini_recs.js` | Root-level throwaway test script. |

> **Note:** Verify `services/ai/llmClient.js` is not imported anywhere before deleting. It contains useful multi-provider dispatch logic but appears unused by the active pipeline (which uses `config/gemini.js` directly).

---

## 7. Domain-Specific Code Inventory

All domain-specific code that must be isolated or removed in the universal architecture:

| Location | Type | Description |
|----------|------|-------------|
| `domainProfiles.js` L22-1070 | Templates | 13+ hardcoded domain template objects with KPI and chart specs |
| `datasetClassifierService.js` L13-89 | Keywords | `DOMAIN_KEYWORDS` for 15 domains |
| `recommendationPipeline.js` L49 | Prompt | AI prompt says "specializing in ${domain.toUpperCase()} analytics" |
| `kpiCandidateGenerator.js` L100 | Logic | `getDomainProfile(domain)` call drives all KPI generation |
| `chartCandidateGenerator.js` L96 | Logic | `getDomainProfile(domain)` call drives all chart generation |
| `analyticsService.js` L435-438 | Logic | Hardcodes `revenueKpi` or `salesKpi` for growth calculation |
| `analyticsService.js` L484-490 | Logic | Hardcoded fix for `order_id + quantity + avg` -> customer grouping |
| `insightGeneratorService.js` L78 | Prompt | "specializing in ${domainLabel} analytics" |
| `dashboardStore.js` L6-13 | Frontend | Hardcoded filter keys: `department, region, product, salesperson` |
| `businessValueScorer.js` L99 | Scoring | `domainScore` at 25% of final score |
| `insightGeneratorService.js` L23-63 | Fallback | Hardcoded fallback insights for `revenue`, `profit`, `growth` KPI keys |
| `analyticsService.js` L174 | KPI format | `isCurrency` check hardcoded for `revenue/expenses/profit` keywords |

---

## 8. Current Scoring & Selection Logic

### KPI Score Formula

```
score = (domainRelevance   * 0.25)   <- 85-100 from template, or 65 from AI suggestion
      + (roleBusinessValue * 0.20)   <- fixed lookup table per semantic role
      + (usefulnessScore   * 0.20)   <- 90 if priority=primary, 65 if secondary
      + (aggSuitability    * 0.15)   <- 100 if preferred, 70 if allowed, 0 if forbidden
      + (dataQualityScore  * 0.10)   <- 100 - (missingPct * 1.5)
      + (usefulnessScore   * 0.05)   <- reused as viz proxy
      + (80               * 0.05)   <- uniqueness ALWAYS fixed at 80 (not computed)
```

### Problems with Current Scoring

- `domainRelevance` (25% weight) comes from the hardcoded template — not computed from data
- `uniquenessScore` is always 80 — never actually computed from redundancy
- `informationGain`, `statisticalQuality`, `dataCoverage` do not exist
- No diversity component — top-N selection may pick all charts from the same metric
- Primary/secondary priority distinction is domain-template-driven, not data-driven

### Chart Scoring

Same 7-dimension structure with chart-type suitability (line/bar/pie vs X-axis semantic role) replacing visualization proxy.

---

## 9. LLM Responsibility Audit

### Active LLM Usage

| Usage | Where | LLM Role | Valid? |
|-------|-------|----------|--------|
| Candidate enrichment | `recommendationPipeline.js` L185-213 | Suggests additional KPI/chart candidates | YES — validated before acceptance |
| Insight generation | `insightGeneratorService.js` | Generates natural language insights from computed KPI values | YES — uses computed values |

### LLM Violations

| Issue | Location |
|-------|----------|
| AI enrichment prompt is domain-biased | `buildEnrichmentPrompt()` — "specializing in {domain}" |
| No fallback schema validation if LLM returns unexpected JSON shape | `fetchAIEnrichment()` accepts any object |
| Insight fallback is domain-specific | `fallbackGenerateInsights()` hardcodes `kpiMap.revenue`, `kpiMap.profit`, `kpiMap.growth` |

### What the LLM Does NOT Do (Correct)

- Does NOT calculate KPI values ✅
- Does NOT generate chart data points ✅  
- Does NOT control aggregation execution ✅
- All LLM suggestions pass through `validateExternalKPICandidate()` / `validateExternalChartCandidate()` ✅

---

## 10. Frontend Analytics Audit — Critical Finding

### The Second Pipeline

`visualizationUtils.js` (782 lines) implements a complete parallel analytics engine in the browser:

```javascript
export const detectColumnTypes = (rows, headers) => { ... }        // Type detection
export const recommendChart = (colTypes, rawRows, headers) => { ... } // Chart selection
export const aggregateData = (rows, xField, yField, agg, ...) => { ... } // Data aggregation
export const generateInsights = (aggregatedData, ...) => { ... }    // Insight generation
```

`aggregateData()` supports: `count`, `sum`, `avg`, `min`, `max`, `median`, and date parsing — a fully independent aggregation engine running in JavaScript.

### Problems

1. Sends ALL rows to the browser (scalability issue at tens of thousands of rows)
2. JavaScript aggregation is inconsistent with MongoDB aggregation semantics
3. Duplicates backend logic (type detection, aggregation, recommendation)
4. No semantic validation — can aggregate identifiers, sum ages
5. Inconsistent results between preview tab and main dashboard tab
6. No multi-tenancy data isolation enforcement on client-side

### Remediation

Keep the UI components (`ChartRenderer`, `ChartControls`, `ChartInsights`) as render-only. Create a backend `/analytics/preview` endpoint that accepts chart config parameters and returns pre-aggregated data. The frontend calls the API and renders results only.

---

## 11. Temporal Intelligence Audit

### Current Implementation

```javascript
// analyticsService.generateCharts() — current code
pipeline.push({ $group: { _id: `$data.${xField}` } });
// Groups by EXACT date value stored as Date object in MongoDB
// 365 days of data -> 365 data points

// Post-aggregation downsampling (not aggregation):
const interval = Math.ceil(results.length / maxPoints);
results = results.filter((_, i) => i % interval === 0).slice(0, maxPoints);
// Drops intermediate data points — NOT temporal aggregation
```

### Critical Problems

1. No temporal granularity selection (day / week / month / quarter / year)
2. Downsampling drops data instead of aggregating — meaningless for trend analysis
3. No check: does the date range warrant monthly or daily grouping?
4. No `$dateToString` with format strings in MongoDB pipeline
5. MongoDB date grouping depends on stored date type (Date object vs. string — inconsistent)

### Target Module Required

```javascript
// TemporalAggregationExecutor — NEW MODULE
// 1. Query date range (min, max) from dataset
// 2. Compute range in days
// 3. Select granularity:
//    < 60 days    -> day
//    < 180 days   -> week
//    < 730 days   -> month (default)
//    < 2000 days  -> quarter
//    >= 2000 days -> year
// 4. Build $dateToString format based on granularity
// 5. Group, aggregate metric, sort chronologically
// 6. Format labels for display (Jan 2024, Q1 2024, etc.)
```

---

## 12. Missing Architecture — Target vs Actual

| Phase | Target Component | Current Status |
|-------|-----------------|----------------|
| Phase 2 | Universal Semantic Model with statistics | MISSING — semanticClassifier lacks null ratio, unique ratio, cardinality, min/max/mean |
| Phase 3 | Hybrid Semantic Understanding | PARTIAL — deterministic regex exists, LLM enrichment exists, stats-based profiling missing |
| Phase 4 | Dataset Relationship Modeling | MISSING — no temporal-measure or dimension-measure relationship detection |
| Phase 5 | Analytical Capability Discovery Engine | MISSING — no capability discovery before candidate generation |
| Phase 6 | Analytical Intent Generation | MISSING — no intent layer, charts from templates not questions |
| Phase 7 | Universal KPI Candidate Generation | MISSING — only domain-template-driven |
| Phase 8 | Universal Analysis Candidate Generation | MISSING — only domain-template-driven |
| Phase 9 | Mathematical Validation | PARTIAL — `aggregationRules.js` covers math/semantic, statistical not validated |
| Phase 9 | Statistical Validation | MISSING — no cardinality check, no variance check, no coverage check |
| Phase 10 | Analytical Utility Scoring | MISSING — `businessValueScorer.js` exists but with domain bias |
| Phase 11 | Semantic Redundancy Detection | PARTIAL — deduplicator exists but no semantic role-based grouping |
| Phase 12 | Diversity Optimization | MISSING — top-N selection only, no intent diversity |
| Phase 13 | Post-Selection Visualization Selection | MISSING — chart type is in template, not selected from intent |
| Phase 14 | Deterministic Execution Engine | PARTIAL — MongoDB aggregation exists, not modular |
| Phase 15 | Temporal Intelligence | MISSING — no granularity selection |
| Phase 16 | Result Validation | MISSING — no post-execution validation |
| Phase 17 | Optional Domain Context | MISSING — domain is currently mandatory controller |
| Phase 18 | Constrained LLM Responsibilities | PARTIAL — LLM doesn't calculate values, but prompt is domain-biased |
| Phase 19 | Pipeline Observability / Trace | MISSING — console.log only, no structured trace |
| Phase 20 | Clean Dashboard Configuration | PARTIAL — served from cache, minimal config schema |

---

## 13. What Is Already Good — Reuse List

These components are well-implemented and should be kept with minimal or no changes:

| Component | Why Keep |
|-----------|----------|
| `parserService.js` | Solid CSV/Excel parsing with 7-type inference |
| `semanticClassifier.js` | 16 semantic roles, regex patterns well organized — needs stats enhancement |
| `aggregationRules.js` | Excellent foundation: forbidden/allowed/preferred per role — keep as-is |
| `deduplicator.js` | Two-pass dedup (exact + intent) is architecturally sound |
| `analyticsEngine.js` | Pearson correlation and linear regression for forecast |
| `insightGeneratorService.js` | Correct LLM + fallback pattern, validates output format |
| `kpiCandidateGenerator.js` | `validateExternalKPICandidate()` is reusable for all pipelines |
| `chartCandidateGenerator.js` | `validateExternalChartCandidate()` is reusable for all pipelines |
| `businessValueScorer.js` | Structure is reusable, weights must change |
| `recommendationPipeline.js` | Stage 1-2 (semantic + quality) reusable; stages 3-4 need replacement |
| `config/gemini.js` | Queue-based rate limiting, multi-provider fallback — keep |
| `DashboardRenderer.jsx` | Clean render-only component |
| `ChartWidget.jsx` | Clean Recharts wrapper |
| `ChartRenderer.jsx` | Rich chart rendering with multiple types |
| `ruleEngineService.js` | Data quality rule evaluation is orthogonal to analytics |

---

## 14. Recommended Migration Plan

### Priority Order — Lowest Risk First

```
Step 1:  Remove Dead Code (services/ai/ folder — 10+ unused files)
   |
   v
Step 2:  Strengthen Semantic Profiling
         (add null ratio, unique ratio, cardinality, value stats to semanticClassifier)
   |
   v
Step 3:  Dataset Relationship Modeling (new module)
         (detect temporal-measure, dimension-measure, category-measure relationships)
   |
   v
Step 4:  Analytical Capability Discovery (new module)
         (determine what analysis types are possible before generating candidates)
   |
   v
Step 5:  Analytical Intent Generation (new module)
         (generate analytical questions before selecting chart types)
   |
   v
Step 6:  Universal Candidate Generation
         (replace domainProfiles-driven path with intent-based path)
   |
   v
Step 7:  Statistical Validation + Result Validation
         (extend aggregationRules + add post-execution checks)
   |
   v
Step 8:  Analytical Utility Scoring
         (replace businessValueScorer domain weights with information-gain based scoring)
   |
   v
Step 9:  Diversity Optimization
         (extend deduplicator with diversity-aware selection)
   |
   v
Step 10: Temporal Intelligence (new TemporalAggregationExecutor)
         (granularity selection, $dateToString, chronological sort)
   |
   v
Step 11: Fix Filter Regeneration Bug
         (analyticsService + controller — filters should not re-run recommendations)
   |
   v
Step 12: Move Frontend Analytics to Backend
         (new /analytics/preview endpoint, frontend becomes render-only)
   |
   v
Step 13: Demote Domain to Optional Context
         (after universal pipeline is fully working and tested)
   |
   v
Step 14: Pipeline Observability
         (structured trace object per pipeline run)
```

### Module Disposition Summary

| Module | Current Role | Target Action |
|--------|-------------|--------------|
| `domainProfiles.js` | Primary controller | **Remove** after universal generation is working |
| `datasetClassifierService.js` | Primary controller | **Demote** to optional context provider |
| `semanticClassifier.js` | Basic regex roles | **Strengthen** with stats profiling |
| `aggregationRules.js` | Math/semantic rules | **Keep & Extend** |
| `kpiCandidateGenerator.js` | Domain-template | **Replace** with universal intent generator |
| `chartCandidateGenerator.js` | Domain-template | **Replace** with universal intent generator |
| `businessValueScorer.js` | Domain-biased 25% | **Replace** with Analytical Utility Scorer |
| `deduplicator.js` | Exact + intent dedup | **Keep & Extend** with diversity |
| `recommendationPipeline.js` | Domain orchestrator | **Modify** to plug in new universal stages |
| `analyticsService.js` | Orchestrator + executor | **Modify** — fix filter bug, add result validation |
| `services/ai/*` (12 files) | Old dead code | **Delete** all |
| `visualizationUtils.js` (frontend) | Full browser analytics | **Restrict** to display utilities only |
| `useAutoVisualization.js` | Frontend analytics hook | **Modify** to call backend API instead |
| New: `CapabilityDiscoveryEngine.js` | — | **Create** |
| New: `RelationshipModel.js` | — | **Create** |
| New: `AnalyticalIntentGenerator.js` | — | **Create** |
| New: `TemporalAggregationExecutor.js` | — | **Create** |
| New: `ResultValidator.js` | — | **Create** |
| New: `PipelineTracer.js` | — | **Create** |
| New: `UniversalKPIGenerator.js` | — | **Create** |
| New: `UniversalChartGenerator.js` | — | **Create** |

---

## Appendix A — Current State Data Flow (Simplified)

```
CSV/Excel File
      |
      v
parserService  (physical types only — no stats)
      |
      v
DataSource + DataRow (MongoDB)
      |
      v
DatasetClassifierService  (domain keyword match)
      | domain string controls everything below
      v
semanticClassifier  (regex -> 16 roles)
      |
      v
kpiCandidateGenerator <-- getDomainProfile(domain) <-- domainProfiles.js
chartCandidateGenerator <-- getDomainProfile(domain) <-- domainProfiles.js
      |
      v
AI Enrichment (Gemini/Groq) -> validated candidates added
      |
      v
businessValueScorer (domain-biased, 25% domain weight)
      |
      v
deduplicator (exact + intent)
      |
      v
analyticsService.calculateKPIs (MongoDB aggregate)
analyticsService.generateCharts (MongoDB aggregate, no granularity)
      |  NO result validation
      v
Analytics document (cached 6h)
      |
      v
React renders (render-only for main dashboard)

SEPARATELY (AutoVisualization tab):
AutoVisualizationContainer -> fetchAllRows -> aggregate IN BROWSER -> render
```

## Appendix B — Target State Data Flow

```
CSV/Excel File
      |
      v
parserService (physical types + stats: null ratio, unique ratio, cardinality, min/max/mean)
      |
      v
semanticClassifier (enhanced: regex + stats + LLM assist for ambiguous)
      |
      v
Universal Semantic Model (full column profiles with statistics)
      |
      |----------------------------+
      v                            v
RelationshipModel           Optional Domain Context
(temporal-measure,          (from DatasetClassifierService
 dimension-measure,          — advisory only, not controlling)
 measure-measure)
      |
      +----------------------------+
                   |
                   v
     CapabilityDiscoveryEngine
     (what analysis types are actually possible?)
                   |
                   v
     AnalyticalIntentGenerator
     (what analytical questions can be answered?)
                   |
                   v
     Universal Candidate Generation
     (KPI + analysis candidates from intents, not domain templates)
                   |
                   v
     Multi-Stage Validation
     |--Mathematical Validation (aggregationRules.js)
     |--Semantic Validation     (semantic role checks)
     +--Statistical Validation  (cardinality, variance, coverage — NEW)
                   |
                   v
     Analytical Utility Scoring
     (information gain, interpretability, uniqueness, diversity)
                   |
                   v
     Semantic Redundancy Detection
                   |
                   v
     Diversity Optimizer
                   |
                   v
     VisualizationSelectionEngine
     (chart type selected from analytical intent + cardinality)
                   |
                   v
     Deterministic Execution
     |-- KPIExecutor
     |-- AggregationExecutor
     |-- TemporalAggregationExecutor  (NEW — granularity selection)
     |-- CorrelationExecutor
     +-- FormulaExecutor
                   |
                   v
     Result Validation  (NEW — NaN, empty, zero-variance checks)
                   |
                   v
     Dashboard Configuration + Pipeline Trace
                   |
                   v
     React renders (render-only — no frontend analytics)
```

---

*Audit complete. This document represents the actual runtime state as of 2026-07-14. Awaiting review before proceeding to Phase 2 — Implementation Planning.*
