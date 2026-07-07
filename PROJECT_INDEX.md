# Project Index

A complete navigation guide for all files and folders in the project. Use this to quickly locate code and understand dependencies.

---

## BACKEND

### Configuration

#### `backend/src/config/passport.js`
- **Purpose:** Configure Passport authentication strategies (local login, Google OAuth)
- **Exports:** `configurePassport()` function
- **Dependencies:** passport, passport-google-oauth20, User model
- **Used By:** `backend/src/app.js`

---

### Middleware

#### `backend/src/middleware/auth.js`
- **Purpose:** JWT validation and role-based access control
- **Exports:**
  - `requireAuth` — Validates Bearer token, extracts user info
  - `requireRole(...roles)` — Checks if user has allowed role
- **Dependencies:** jsonwebtoken
- **Used By:** All protected routes (auth, datasources, dashboards, etc.)

#### `backend/src/middleware/tenantContext.js`
- **Purpose:** Multi-tenant isolation using AsyncLocalStorage
- **Exports:** `tenantMiddleware` function
- **Dependencies:** AsyncLocalStorage (Node.js builtin)
- **Used By:** `backend/src/app.js` (runs after auth)
- **Function:** Stores `orgId` in context, Mongoose plugin uses it to auto-filter queries

---

### Models

#### `backend/src/models/user.js`
- **Purpose:** User schema definition
- **Fields:** email, password (hashed), orgIds, role, googleId, createdAt
- **Methods:** Password hashing/comparison, token generation
- **Used By:** Auth routes, organization management
- **Dependencies:** mongoose, bcryptjs

#### `backend/src/models/org.js`
- **Purpose:** Organization schema (workspace/tenant)
- **Fields:** name, members (with roles), subscription tier, createdAt
- **Methods:** Add/remove members, role assignment
- **Used By:** Organization routes, tenant context
- **Dependencies:** mongoose

#### `backend/src/models/refreshToken.js`
- **Purpose:** Store hashed refresh tokens for secure session management
- **Fields:** userId, orgId, tokenHash (SHA-256), expiresAt, revokedAt
- **Methods:** Token creation, reuse detection, family invalidation
- **Used By:** Auth routes for token rotation
- **Dependencies:** mongoose, crypto

#### `backend/src/models/dataSource.js`
- **Purpose:** Metadata for uploaded CSV/Excel files
- **Fields:** orgId, name, fileName, schema (inferred columns), status (staging/confirmed), createdAt
- **Methods:** Schema inference, file type detection
- **Used By:** Data source routes, chart suggestions
- **Dependencies:** mongoose

#### `backend/src/models/dataRow.js`
- **Purpose:** Store individual rows from uploaded files
- **Fields:** orgId, dataSourceId, data (column values), rowNumber, createdAt
- **Indexes:** (orgId, dataSourceId) for efficient querying
- **Used By:** Chart data aggregation, analytics
- **Dependencies:** mongoose

#### `backend/src/models/dashboard.js`
- **Purpose:** Dashboard grid configurations and widget metadata
- **Fields:** orgId, name, layout (react-grid-layout config), widgets (array), createdAt, updatedAt
- **Methods:** Widget CRUD, layout updates
- **Used By:** Dashboard routes, frontend grid rendering
- **Dependencies:** mongoose

---

### Routes

#### `backend/src/routes/auth.js`
- **Purpose:** Authentication endpoints
- **Endpoints:**
  - `POST /auth/register` — Create user + organization
  - `POST /auth/login` — Sign in with email/password
  - `POST /auth/refresh` — Rotate tokens
  - `POST /auth/logout` — Revoke session
  - `GET /auth/google` — OAuth callback
  - `GET /auth/me` — Current user info
  - `PUT /auth/switch-org` — Change active organization
- **Middleware:** No auth on register/login; requireAuth on others
- **Used By:** Frontend AuthContext, login flow
- **Dependencies:** User, RefreshToken models; Passport config

#### `backend/src/routes/org.js`
- **Purpose:** Organization management
- **Endpoints:**
  - `POST /orgs/:orgId/invite` — Generate invite link (admin only)
  - `POST /orgs/invite/accept` — Accept invite
  - `GET /orgs/:orgId` — Organization details
- **Middleware:** requireAuth, requireRole(['admin', 'owner'])
- **Used By:** Invite flow, member management
- **Dependencies:** Organization, User models

#### `backend/src/routes/dataSource.js`
- **Purpose:** CSV/Excel upload and data source management
- **Endpoints:**
  - `POST /datasources/upload` — Upload file, infer schema
  - `GET /datasources` — List all sources (current org)
  - `GET /datasources/:id/preview` — First 50 rows + validation errors
  - `POST /datasources/:id/confirm` — Commit schema, import rows
  - `DELETE /datasources/:id` — Delete source and all rows
- **Middleware:** requireAuth
- **Uses:** parserService.inferSchema(), Multer file handling
- **Used By:** Frontend DataSourcesView, upload flow
- **Dependencies:** DataSource, DataRow models; Multer, xlsx, papaparse

#### `backend/src/routes/analytics.js`
- **Purpose:** Chart recommendations, aggregated data, KPI calculations
- **Endpoints:**
  - `GET /analytics/:id/suggest-charts` — AI chart recommendations
  - `GET /analytics/:id/chart-data` — Aggregated coordinates (max 100 points)
  - `GET /analytics/:id/kpis` — KPI metrics (sum, average, count, growth)
  - `POST /analytics/:id/kpi-mapping` — Override synonym mappings
- **Middleware:** requireAuth
- **Uses:** chartService.recommendCharts(), MongoDB aggregation pipelines
- **Used By:** Frontend chart rendering, KPI display
- **Dependencies:** DataSource, DataRow models; chartService, parserService

#### `backend/src/routes/dashboard.js`
- **Purpose:** Dashboard CRUD and grid management
- **Endpoints:**
  - `POST /dashboards` — Create dashboard
  - `GET /dashboards` — List org dashboards
  - `GET /dashboards/:id` — Dashboard + live widget data
  - `PUT /dashboards/:id` — Update layout/widgets
  - `DELETE /dashboards/:id` — Delete dashboard
- **Middleware:** requireAuth
- **Used By:** Frontend DashboardView, grid layout
- **Dependencies:** Dashboard, DataRow models

#### `backend/src/routes/dashboardAnalytics.js`
- **Purpose:** Live data for dashboard widgets
- **Endpoints:** (typically called by dashboard route)
- **Used By:** Backend dashboard route resolution
- **Dependencies:** DataRow, DataSource models

---

### Services

#### `backend/src/services/parserService.js`
- **Purpose:** CSV/Excel parsing and schema inference
- **Exports:**
  - `inferSchema(buffer, fileType)` — Analyze columns, detect types
  - `parseRows(buffer, fileType, schema)` — Convert rows to objects
  - `detectColumnType(values)` — Infer single column type (string/number/date/boolean)
- **Algorithm:** Samples first 100 rows, analyzes 30% of values
- **Used By:** dataSource route (upload), chart service
- **Dependencies:** xlsx, papaparse

#### `backend/src/services/chartService.js`
- **Purpose:** AI-powered chart type recommendations
- **Exports:**
  - `recommendCharts(schema, dataPreview)` — Suggest chart types
  - `determineChartType(numericCount, categoricalCount, dateCount)` — Heuristic logic
- **Heuristics:**
  - 1 numeric + 1 categorical → Bar Chart
  - 1 numeric + 1 date → Line Chart
  - 2 numeric → Scatter Plot
  - 3+ categorical → Pie Chart
  - 2+ numeric → Heatmap
- **Used By:** analytics route, frontend suggestions
- **Dependencies:** schema analyzer

---

### Main Application File

#### `backend/src/app.js`
- **Purpose:** Express app initialization and middleware setup
- **Imports:** All routes, middleware, models
- **Setup:** CORS, JWT validation, tenant context, database connection, error handling
- **Error Handler:** Global middleware catches unhandled errors
- **Entry Point:** `node src/app.js` or `npm run dev`
- **Dependencies:** All routes, models, middleware

---

### Configuration

#### `backend/.env` (not in repo, create from .env.example)
- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — Secret key for JWT signing (min 32 chars)
- `FRONTEND_URL` — CORS origin
- `GOOGLE_CLIENT_ID` — OAuth 2.0 credentials
- `GOOGLE_CLIENT_SECRET`
- `NODE_ENV` — production/development/test
- `PORT` — Server port (default 5000)

#### `backend/.env.example`
- Template for environment variables
- Used as reference for setup

#### `backend/package.json`
- **Main:** `src/app.js`
- **Scripts:**
  - `start` — Run server
  - `dev` — Run with nodemon (auto-reload)
  - `test` — Run Jest tests
- **Dependencies:** Express, MongoDB, JWT, file handling, OAuth

#### `backend/tests/integration.test.js`
- **Purpose:** Integration tests for API endpoints
- **Test Suites:** Auth, datasources, dashboards, analytics
- **Uses:** Jest, Supertest, MongoDB test database
- **Run:** `npm test`

---

## FRONTEND

### Components

#### `frontend/src/components/Header.jsx`
- **Purpose:** Top navigation bar with org switcher and user menu
- **Props:** activeTab, setActiveTab, user, organisations, activeOrgId, switchOrg, logout
- **Dependencies:** Header.jsx uses Topbar.jsx internally
- **Used By:** App.jsx (legacy view)
- **Size:** < 300 lines

#### `frontend/src/components/DashboardView.jsx`
- **Purpose:** Main dashboard grid layout with widget management
- **Props:** dashboards, selectedDashboardId, activeDashboard, widgets, layout
- **Features:** react-grid-layout, responsive grid, widget add/remove
- **Used By:** App.jsx (legacy view)
- **Dependencies:** react-grid-layout, dashboard hooks
- **Size:** < 300 lines

#### `frontend/src/components/DataSourcesView.jsx`
- **Purpose:** CSV/Excel upload, preview, schema confirmation, KPI mapping
- **Props:** dataSources, preview, suggestedCharts, uploadLoading, uploadError
- **Features:** Drag-and-drop upload, file preview, schema validation, KPI mapping UI
- **Used By:** App.jsx (legacy view)
- **Dependencies:** react-dropzone, DataRow visualization
- **Size:** < 300 lines

#### `frontend/src/components/AddWidgetModal.jsx`
- **Purpose:** Modal dialog for adding widgets to dashboard
- **Props:** showAddWidgetModal, dataSources, handleAddWidget, setShowAddWidgetModal
- **Features:** Chart type selection, axis mapping, widget preview
- **Used By:** App.jsx, DashboardView.jsx
- **Dependencies:** Button, Input UI components
- **Size:** < 300 lines

#### `frontend/src/components/AuthScreen.jsx`
- **Purpose:** Login and registration UI
- **Props:** None (uses AuthContext)
- **Features:** Email/password input, Google OAuth button, form validation
- **Used By:** App.jsx (when user not authenticated)
- **Dependencies:** AuthContext, Button, Input UI components
- **Size:** < 300 lines

#### `frontend/src/components/AutoChart.jsx`
- **Purpose:** Wrapper that auto-renders correct chart type based on config
- **Props:** chartType, data, xAxis, yAxis, config
- **Supported Types:** bar, line, scatter, pie, area, composed
- **Used By:** DashboardView widgets, chart previews
- **Dependencies:** Recharts
- **Size:** < 300 lines

#### `frontend/src/components/KpiCardRow.jsx`
- **Purpose:** Display row of KPI metric cards
- **Props:** kpiData (array of metrics)
- **Features:** Shows value, growth rate, trend visualization
- **Used By:** DashboardView, premium Dashboard page
- **Dependencies:** MetricCard component
- **Size:** < 300 lines

---

### Dashboard Components (Reusable Widgets)

#### `frontend/src/components/dashboard/MetricCard.jsx`
- **Purpose:** Single KPI/metric display card
- **Props:** title, value, growth, icon, trend
- **Features:** Value display, growth percentage, color coding (positive/negative)
- **Used By:** KpiCardRow, premium dashboard
- **Dependencies:** Lucide React icons
- **Size:** < 100 lines

#### `frontend/src/components/dashboard/RevenueChart.jsx`
- **Purpose:** Revenue trend line chart
- **Props:** data (time-series coordinates)
- **Used By:** Premium dashboard
- **Dependencies:** Recharts
- **Size:** < 150 lines

#### `frontend/src/components/dashboard/SalesOverviewChart.jsx`
- **Purpose:** Sales overview bar chart
- **Props:** data (category-value pairs)
- **Used By:** Premium dashboard
- **Dependencies:** Recharts
- **Size:** < 150 lines

#### `frontend/src/components/dashboard/SalesByRegionChart.jsx`
- **Purpose:** Regional sales distribution pie chart
- **Props:** data (region-sales pairs)
- **Used By:** Premium dashboard
- **Dependencies:** Recharts
- **Size:** < 150 lines

#### `frontend/src/components/dashboard/TopProducts.jsx`
- **Purpose:** Table of top performing products
- **Props:** data (product list with sales)
- **Used By:** Premium dashboard
- **Dependencies:** Table UI components
- **Size:** < 150 lines

#### `frontend/src/components/dashboard/KPIStatus.jsx`
- **Purpose:** KPI summary status boxes
- **Props:** kpiData
- **Used By:** Premium dashboard
- **Dependencies:** MetricCard
- **Size:** < 150 lines

#### `frontend/src/components/dashboard/AIInsightsPanel.jsx`
- **Purpose:** AI-generated insights from data
- **Props:** data, insights
- **Features:** Text insights, recommendations
- **Used By:** Premium dashboard
- **Dependencies:** None (pure UI)
- **Size:** < 150 lines

#### `frontend/src/components/dashboard/AIChatWidget.jsx`
- **Purpose:** Chat interface for AI data questions
- **Props:** dashboardId
- **Features:** Message input, response display
- **Used By:** Premium dashboard
- **Dependencies:** None (placeholder)
- **Size:** < 150 lines

#### `frontend/src/components/dashboard/QuickActions.jsx`
- **Purpose:** Quick action buttons (download, share, etc.)
- **Props:** dashboardId
- **Used By:** Premium dashboard
- **Dependencies:** Button UI components
- **Size:** < 100 lines

#### `frontend/src/components/dashboard/RecentUploadsTable.jsx`
- **Purpose:** Table of recently uploaded data sources
- **Props:** uploads (array)
- **Used By:** Premium dashboard
- **Dependencies:** Table UI components
- **Size:** < 150 lines

---

### Layout Components

#### `frontend/src/components/layout/Topbar.jsx`
- **Purpose:** Top navigation bar
- **Props:** activeTab, setActiveTab, user, organisations, switchOrg, logout
- **Features:** Tab switcher, user dropdown
- **Used By:** Header.jsx
- **Dependencies:** Dropdown UI component, Avatar
- **Size:** < 200 lines

#### `frontend/src/components/layout/Sidebar.jsx`
- **Purpose:** Left sidebar navigation (premium view)
- **Props:** activeTab, setActiveTab, user
- **Features:** Navigation links, org context
- **Used By:** Premium Dashboard page
- **Dependencies:** Lucide React icons
- **Size:** < 150 lines

---

### UI Components (Base Library)

#### `frontend/src/components/ui/button.jsx`
- **Purpose:** Reusable button component
- **Props:** variant, size, disabled, onClick, children
- **Variants:** primary, secondary, danger, ghost
- **Used By:** All components
- **Dependencies:** Tailwind CSS

#### `frontend/src/components/ui/input.jsx`
- **Purpose:** Text input field
- **Props:** type, placeholder, value, onChange, disabled
- **Used By:** AuthScreen, forms
- **Dependencies:** Tailwind CSS

#### `frontend/src/components/ui/card.jsx`
- **Purpose:** Card container with border and padding
- **Props:** children, className
- **Used By:** MetricCard, dashboard widgets
- **Dependencies:** Tailwind CSS

#### `frontend/src/components/ui/badge.jsx`
- **Purpose:** Small label/tag component
- **Props:** variant, children
- **Used By:** Status indicators, tags
- **Dependencies:** Tailwind CSS

#### `frontend/src/components/ui/avatar.jsx`
- **Purpose:** User avatar display
- **Props:** src, alt, name
- **Used By:** Topbar, user menus
- **Dependencies:** Tailwind CSS

#### `frontend/src/components/ui/dropdown-menu.jsx`
- **Purpose:** Dropdown menu (user menu, org switcher)
- **Props:** trigger, items
- **Items Structure:** { label, onClick, icon }
- **Used By:** Topbar, Header
- **Dependencies:** Lucide React icons
- **Size:** < 150 lines

---

### Context

#### `frontend/src/context/AuthContext.jsx`
- **Purpose:** Global authentication state and auto-refresh logic
- **Exports:** `AuthProvider` component, `useAuth()` hook
- **State:**
  - `user` (userId, email, role)
  - `organisations` (list)
  - `activeOrgId`
  - `token` (access token)
  - `loading`
- **Functions:**
  - `login(email, password)`
  - `register(email, password, orgName)`
  - `logout()`
  - `switchOrg(orgId)`
  - `refreshToken()` (auto-retry on 401)
- **Auto-Refresh:** Intercepts 401 responses, auto-refreshes token, retries request
- **Used By:** All authenticated components via useAuth()
- **Dependencies:** localStorage (token persistence), fetch API
- **Size:** < 250 lines

---

### Hooks

#### `frontend/src/hooks/useDashboards.js`
- **Purpose:** Manage dashboard list, grid layout, widget CRUD
- **Exports:** Hook returning object with:
  - `dashboards` (list)
  - `selectedDashboardId`
  - `activeDashboard`
  - `showAddWidgetModal`
  - `loadActiveDashboard(id)`
  - `createDashboard(name)`
  - `deleteDashboard(id)`
  - `handleLayoutChange(newLayout)`
  - `handleAddWidget(widget)`
  - `removeWidget(widgetId)`
- **API Calls:** GET /dashboards, POST /dashboards, PUT /dashboards/:id, DELETE /dashboards/:id
- **Used By:** DashboardView.jsx, App.jsx
- **Dependencies:** AuthContext for orgId and auth header
- **Size:** < 200 lines

#### `frontend/src/hooks/useDataSources.js`
- **Purpose:** Manage uploaded files, preview, KPI mappings, chart suggestions
- **Exports:** Hook returning object with:
  - `dataSources` (list)
  - `selectedDSId`
  - `dsPreview` (first 50 rows)
  - `kpiData` (computed KPIs)
  - `suggestedCharts`
  - `uploadError`, `uploadLoading`
  - `selectDataSourceForPreview(id)`
  - `handleFileUpload(file)`
  - `confirmDataSource()`
  - `deleteDataSource()`
  - `handleKpiMappingChange(newMapping)`
  - `saveKpiMappings()`
- **API Calls:** POST /datasources/upload, GET /datasources, GET /datasources/:id/preview, POST /datasources/:id/confirm, DELETE /datasources/:id, POST /analytics/:id/kpi-mapping
- **Used By:** DataSourcesView.jsx, App.jsx
- **Dependencies:** AuthContext, file parsing utils
- **Size:** < 200 lines

---

### Constants

#### `frontend/src/constants/kpiSynonyms.js`
- **Purpose:** Map common column names to KPI types
- **Structure:** `{ revenueColumns: ['revenue', 'sales', ...], profitColumns: [...] }`
- **Used By:** Backend chartService, frontend KPI display
- **Update Frequency:** As new KPI types are identified

#### `frontend/src/constants/mockData.js`
- **Purpose:** Sample data for development and testing
- **Includes:** Mock dashboards, mock data sources, mock chart data
- **Used By:** Components during development
- **Note:** Replace with real API calls in production

---

### Pages

#### `frontend/src/pages/Dashboard.jsx`
- **Purpose:** Premium dashboard page (main user interface)
- **Props:** onSwitchToLegacy
- **Components:** Sidebar, Topbar, dashboard widgets, charts, KPIs
- **Features:** Responsive grid, live data updates, widget management
- **Used By:** App.jsx (when viewMode === 'premium')
- **Size:** < 300 lines

---

### App & Entry

#### `frontend/src/App.jsx`
- **Purpose:** Root component, authentication gate, main app layout
- **Features:**
  - Renders AuthScreen if not authenticated
  - Routes between legacy and premium views
  - Manages tab state (dashboards vs datasources)
  - Integrates dashboards and datasources hooks
- **Size:** < 300 lines

#### `frontend/src/main.jsx`
- **Purpose:** Vite entry point
- **Renders:** App component into root DOM element
- **Dependencies:** React, AuthContext provider

#### `frontend/src/index.css`
- **Purpose:** Global styles, Tailwind directives, CSS variables
- **Includes:** Dark theme tokens, glassmorphic design tokens, animations

---

### Configuration

#### `frontend/vite.config.js`
- **Purpose:** Vite build configuration
- **Settings:** React plugin, dev server port (5173)
- **Build Output:** dist/ folder

#### `frontend/tailwind.config.js`
- **Purpose:** Tailwind CSS configuration
- **Customizations:** Dark theme colors, premium design tokens
- **Extends:** Theme colors, typography, spacing

#### `frontend/postcss.config.js`
- **Purpose:** PostCSS plugins (Tailwind CSS)
- **Plugins:** Tailwind CSS, Autoprefixer

#### `frontend/package.json`
- **Main Type:** ES Module
- **Scripts:**
  - `dev` — Start Vite dev server (localhost:5173)
  - `build` — Build for production (dist/)
  - `preview` — Preview built site locally
- **Dependencies:** React, Vite, Tailwind, Recharts, etc.

#### `frontend/index.html`
- **Purpose:** HTML entry point
- **Root Element:** `<div id="app"></div>`
- **Imports:** main.jsx via script tag

---

## SHARED & DATA

### Data Files

#### `Data Source/sample_sales_data.xlsx`
- **Purpose:** Sample data for testing upload flow
- **Contents:** Sales records with date, region, product, revenue, profit, quantity
- **Used For:** Development testing, demo purposes

---

## Documentation Files

#### `README.md`
- **Purpose:** Project overview, architecture summary, setup instructions
- **Audience:** Developers, stakeholders
- **Last Updated:** (Check file)

#### `PROJECT_ARCHITECTURE.md` (This Document)
- **Purpose:** Comprehensive architecture guide
- **Sections:** Tech stack, data flow, auth flow, API layer, state management, best practices
- **Target Read Time:** 10 minutes
- **Audience:** All developers

#### `PROJECT_INDEX.md` (This Document)
- **Purpose:** File-by-file navigation and dependencies
- **Structure:** Organized by backend/frontend sections
- **Each File Entry:** Purpose, dependencies, used by, size
- **Audience:** Developers looking for specific functionality

#### `AI_RULES.md`
- **Purpose:** Development rules for AI assistant behavior
- **Rules:** Code style, component size limits, naming conventions, best practices
- **Used By:** AI development assistants
- **Audience:** Development team + AI

---

## Dependency Map

### Critical Path for Feature Development

**Add a New Chart Type:**
1. Update `chartService.js` (heuristic rules)
2. Add `AutoChart.jsx` variant
3. Test with sample data

**Add a New KPI:**
1. Update `kpiSynonyms.js` (column name mapping)
2. Update backend analytics route aggregation logic
3. Add `MetricCard` variant if needed
4. Test in DataSourcesView

**Add a Dashboard Widget:**
1. Create new widget component in `components/dashboard/`
2. Update Dashboard.jsx to include component
3. Update dashboard model to store widget config
4. Add POST /dashboards/:id endpoint logic if needed

**Add Multi-Org Feature:**
1. Verify `tenantMiddleware` is active
2. Ensure all models have `orgId` field
3. Verify all routes check `req.user.orgId`
4. Test tenant isolation with multiple orgs

---

## File Size Reference

| File Type | Recommended Max | Current Project Standard |
|-----------|-----------------|--------------------------|
| Component | 300 lines | < 300 lines |
| Hook | 200 lines | < 200 lines |
| Service | No limit | Domain-focused |
| Route Handler | 100 lines per endpoint | Modular |
| Model | 150 lines | Focused |
| Middleware | 50 lines | Single responsibility |

