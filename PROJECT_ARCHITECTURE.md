# Project Architecture

A comprehensive guide to understanding the Multi-Tenant SaaS Analytics Platform structure. Read this in 10 minutes to grasp the entire system.

## Project Overview

The SaaS Analytics Platform is a multi-tenant application that allows organizations to upload CSV/Excel files, automatically infer schemas, generate intelligent chart recommendations, and build customizable analytical dashboards. The platform enforces strict tenant isolation at the database level and provides secure JWT-based authentication with refresh token rotation.

**Key Features:**
- Multi-tenant data isolation with zero data leakage
- Secure stateless JWT authentication with refresh token rotation
- Automatic CSV/Excel schema inference and validation
- Server-side data aggregation and downsampling
- AI-powered chart recommendation engine
- Customizable dashboard grid workspaces
- Google OAuth integration
- Organization invitations and role-based access

---

## Technology Stack

### Backend
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT (jsonwebtoken), Passport.js, Passport Google OAuth 2.0
- **File Handling:** Multer (uploads), xlsx (Excel parsing), papaparse (CSV parsing)
- **Security:** bcryptjs (password hashing), zod (validation)
- **Testing:** Jest, Supertest

### Frontend
- **Runtime:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS 4 with PostCSS
- **State Management:** Zustand
- **UI Components:** Custom + Lucide React icons
- **Charting:** Recharts
- **Layout:** react-grid-layout
- **File Upload:** react-dropzone
- **Animation:** Framer Motion
- **CSV Parsing:** papaparse, xlsx

---

## Frontend Architecture

### Directory Structure
```
frontend/src/
├── components/                  # Reusable UI components
│   ├── dashboard/              # Dashboard-specific widgets
│   │   ├── AIChatWidget.jsx
│   │   ├── AIInsightsPanel.jsx
│   │   ├── KPIStatus.jsx
│   │   ├── MetricCard.jsx
│   │   ├── QuickActions.jsx
│   │   ├── RecentUploadsTable.jsx
│   │   ├── RevenueChart.jsx
│   │   ├── SalesByRegionChart.jsx
│   │   ├── SalesOverviewChart.jsx
│   │   └── TopProducts.jsx
│   ├── layout/                 # Layout components
│   │   ├── Sidebar.jsx
│   │   └── Topbar.jsx
│   ├── ui/                     # Base UI components
│   │   ├── avatar.jsx
│   │   ├── badge.jsx
│   │   ├── button.jsx
│   │   ├── card.jsx
│   │   ├── dropdown-menu.jsx
│   │   └── input.jsx
│   ├── AddWidgetModal.jsx       # Modal for adding chart widgets
│   ├── AuthScreen.jsx           # Login/Register UI
│   ├── AutoChart.jsx            # Auto-generated chart wrapper
│   ├── DashboardView.jsx        # Dashboard grid layout
│   ├── DataSourcesView.jsx      # Data source upload & preview
│   ├── Header.jsx               # Top navigation bar
│   └── KpiCardRow.jsx           # KPI metrics display
├── context/                     # React context (state)
│   └── AuthContext.jsx          # Authentication state with auto-refresh
├── hooks/                       # Custom React hooks
│   ├── useDashboards.js         # Dashboard CRUD & grid management
│   └── useDataSources.js        # Data source upload & preview
├── constants/                   # Static data
│   ├── kpiSynonyms.js          # KPI name mappings
│   └── mockData.js             # Sample data for development
├── pages/                       # Page-level components
│   └── Dashboard.jsx            # Premium dashboard page
├── App.jsx                      # Root app component
├── main.jsx                     # Vite entry point
└── index.css                    # Global Tailwind styles
```

### State Management
- **Auth Context:** Stores user, organizations, active org ID, token auto-refresh logic
- **Dashboard Hook:** Manages dashboard list, selected dashboard, widget grid, layout changes
- **DataSource Hook:** Manages uploaded files, preview data, KPI mappings, chart suggestions

### Data Flow (Frontend)
1. User logs in via AuthScreen → AuthContext fetches token + user data
2. Dashboard loads dashboards list → User selects dashboard or creates new one
3. User uploads CSV → DataSourcesView stages file → Shows schema preview
4. User confirms file → API suggests charts → User adds widgets to dashboard
5. Dashboard grid updates → Saves layout to backend
6. Charts render with live data from aggregation endpoints

---

## Backend Architecture

### Directory Structure
```
backend/src/
├── config/                      # Configuration
│   └── passport.js             # Passport strategies (local, Google OAuth)
├── middleware/                  # Express middleware
│   ├── auth.js                 # JWT validation (requireAuth, requireRole)
│   └── tenantContext.js        # Multi-tenant isolation enforcer
├── models/                      # Mongoose schemas
│   ├── user.js                 # User model
│   ├── org.js                  # Organization model
│   ├── refreshToken.js         # Refresh token store
│   ├── dataSource.js           # Data source metadata
│   ├── dataRow.js              # Raw data rows
│   ├── dashboard.js            # Dashboard configurations
│   └── [...other models]
├── routes/                      # API route handlers
│   ├── auth.js                 # /auth endpoints
│   ├── org.js                  # /orgs endpoints
│   ├── dataSource.js           # /datasources endpoints
│   ├── analytics.js            # /analytics endpoints
│   ├── dashboard.js            # /dashboards endpoints
│   └── [...other routes]
├── services/                    # Business logic
│   ├── chartService.js         # Chart type recommendations
│   ├── parserService.js        # CSV/Excel parsing & schema inference
│   └── [...other services]
└── app.js                       # Express app setup
```

### Security & Multi-Tenancy

#### Tenant Isolation (AsyncLocalStorage)
- Request enters → `requireAuth` middleware validates JWT and extracts `orgId`
- `tenantMiddleware` stores `orgId` in `AsyncLocalStorage` (thread-safe context)
- Mongoose plugin intercepts all queries and prepends `{ orgId }` filter
- Aggregation pipelines automatically inject `$match: { orgId }` at start
- **Result:** Impossible to query user's data from another organization

#### JWT & Refresh Tokens
- Access Token: Short-lived (15 min), issued on login/refresh
- Refresh Token: Long-lived (14 days), stored as SHA-256 hash in DB, sent via httpOnly cookie
- Token Rotation: Each refresh issues new tokens and rotates credentials
- Reuse Detection: If old token reused, entire token family invalidated (indicates theft)

### Data Models

#### User
- `_id` (ObjectId)
- `email` (unique)
- `password` (hashed)
- `orgIds` (array of org refs)
- `role` (owner, admin, member)
- `googleId` (optional)

#### Organization
- `_id` (ObjectId)
- `name`
- `members` (array of user refs + roles)
- `subscription` (free, pro, enterprise)

#### DataSource
- `_id` (ObjectId)
- `orgId` (tenant scoping)
- `name`
- `fileName`
- `schema` (inferred column types)
- `status` (staging, confirmed, archived)
- `createdAt`

#### DataRow
- `_id` (ObjectId)
- `orgId` (tenant scoping)
- `dataSourceId` (ref)
- `data` (object with column values)
- `rowNumber`

#### Dashboard
- `_id` (ObjectId)
- `orgId` (tenant scoping)
- `name`
- `layout` (react-grid-layout config)
- `widgets` (array of { id, type, dataSourceId, config })

---

## Data Flow

### CSV Upload & Schema Inference Flow
```
1. Frontend: User selects file → FormData sent to /datasources/upload
2. Backend: Multer saves file → parserService.inferSchema()
   - Reads first 100 rows
   - Samples each column value
   - Infers type (string, number, date, boolean)
   - Returns schema with column metadata
3. Backend: Creates DataSource with status='staging'
4. Frontend: Shows preview (first 50 rows) with inferred types
5. User: Confirms schema or adjusts type mappings
6. Frontend: POST /datasources/:id/confirm
7. Backend: Copies all rows into DataRow collection
   - status changes to 'confirmed'
   - Rows indexed by (orgId, dataSourceId) for efficient queries
```

### Chart Generation & Recommendation Flow
```
1. Frontend: User selects data source
2. Frontend: GET /analytics/:id/suggest-charts
3. Backend: chartService.recommendCharts(schema)
   - Analyzes columns: numeric, categorical, date
   - Applies heuristic rules:
     - 1 numeric + 1 categorical → Bar Chart
     - 2 numeric → Scatter Plot
     - 1 numeric + 1 date → Line Chart
     - 3+ categorical → Pie Chart
   - Returns array of suggested { type, xAxis, yAxis, config }
4. Frontend: User picks chart type and axis mappings
5. User: Clicks "Add to Dashboard"
6. Frontend: POST /dashboards/:id/widget (adds to grid layout)
7. Backend: Saves widget config with dataSourceId + chart config
```

### Dashboard Grid & Widget Flow
```
1. Frontend: useDashboards hook loads dashboard + widgets
2. Frontend: Renders react-grid-layout with widget grid
3. User: Drags/resizes widget → onLayoutChange fired
4. Frontend: Debounced PUT /dashboards/:id with new layout
5. Backend: Saves grid layout coordinates
6. Each Widget: Fetches live data from /analytics/:id/chart-data
   - Returns aggregated, downsampled coordinates
   - Max 100 points per chart
7. Frontend: Recharts renders with live data
```

### KPI Extraction Flow
```
1. Frontend: GET /analytics/:id/kpis
2. Backend: Analyzes schema for KPI columns
   - Looks for columns like: "revenue", "sales", "profit", etc.
   - Uses kpiSynonyms constant to match column names
3. Backend: Aggregates using MongoDB $group + $sum
   - Computes total, average, count, growth rate
4. Frontend: MetricCard components display KPI cards
```

---

## Authentication Flow

### Login Sequence
```
1. Frontend: User enters email/password on AuthScreen
2. Frontend: POST /auth/login { email, password }
3. Backend: Verify credentials, hash password check
4. Backend: Create JWT (access token)
   - Payload: { userId, orgId, role }
   - Expires: 15 minutes
5. Backend: Create refresh token (opaque)
   - Hash it with SHA-256
   - Store in RefreshToken collection
   - Return as httpOnly secure cookie
6. Backend: Return { accessToken, user, organisations }
7. Frontend: Store accessToken in localStorage
8. Frontend: AuthContext auto-attaches to all API calls as "Bearer {token}"
```

### Token Refresh Flow
```
1. Frontend: API returns 401 (token expired)
2. Frontend: AuthContext intercepts → POST /auth/refresh
   - Refresh token in cookie sent automatically
3. Backend: Validate refresh token
4. Backend: Check for reuse (security violation)
   - If reused: Invalidate entire token family, user logs out
5. Backend: Issue new access token + rotate refresh token
6. Frontend: Update localStorage token
7. Frontend: Retry original request with new token
```

---

## API Layer

### Authentication Endpoints
- `POST /auth/register` — Create account + org
- `POST /auth/login` — Sign in
- `POST /auth/refresh` — Get new access token
- `POST /auth/logout` — Revoke token
- `GET /auth/google` — OAuth callback
- `GET /auth/me` — Session info
- `PUT /auth/switch-org` — Change active org

### Data Sources Endpoints
- `POST /datasources/upload` — Stage CSV/Excel
- `GET /datasources` — List all sources
- `GET /datasources/:id/preview` — Staging preview
- `POST /datasources/:id/confirm` — Commit schema
- `DELETE /datasources/:id` — Delete source

### Analytics Endpoints
- `GET /analytics/:id/suggest-charts` — Chart recommendations
- `GET /analytics/:id/chart-data` — Aggregated chart coordinates
- `GET /analytics/:id/kpis` — KPI metrics
- `POST /analytics/:id/kpi-mapping` — Override KPI synonyms

### Dashboard Endpoints
- `POST /dashboards` — Create dashboard
- `GET /dashboards` — List all dashboards
- `GET /dashboards/:id` — Dashboard + live widget data
- `PUT /dashboards/:id` — Update layout
- `DELETE /dashboards/:id` — Delete dashboard

---

## State Management Pattern

### Frontend State Hierarchy
```
AuthContext (Global)
├── user
├── organisations
├── activeOrgId
├── token (access token)
├── loading

useDashboards Hook (Scoped to active dashboard)
├── dashboards (list)
├── selectedDashboardId
├── activeDashboard
├── widgets
├── layout (grid config)

useDataSources Hook (Scoped to upload flow)
├── dataSources (list)
├── selectedDSId
├── dsPreview
├── schema (inferred columns)
├── kpiData
├── suggestedCharts
```

### Data Fetching Pattern
- Hooks use `useState` for loading/error states
- `useEffect` triggers API calls on mount or dependency change
- Errors stored in hook state and displayed in UI
- Debouncing applied to frequent operations (layout saves)

---

## Deployment

### Environment Variables

**Backend (.env)**
```
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_secret_key_min_32_chars
FRONTEND_URL=https://your-frontend.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NODE_ENV=production
PORT=5000
```

**Frontend (.env)**
```
VITE_API_URL=https://api.your-domain.com
```

### Build & Deploy Steps

**Backend:**
```bash
cd backend
npm install
npm run build  # (if applicable)
npm start
```

**Frontend:**
```bash
cd frontend
npm install
npm run build
# Deploy dist/ folder to CDN/hosting
```

---

## Coding Standards

### General
- Never rewrite unrelated files
- Never modify working features without permission
- Always preserve existing functionality
- Follow existing code style and patterns

### Component Constraints
- Keep components under 300 lines
- Keep hooks under 200 lines
- Keep services focused on one domain
- Use meaningful, descriptive naming
- Avoid deeply nested components
- Prefer composition over monolithic components

### Performance
- Avoid unnecessary re-renders
- Memoize expensive computations
- Use debouncing for frequent updates
- Reuse existing utilities and components
- Avoid hardcoded API URLs (use env vars)

### Code Quality
- Avoid duplicate code
- Keep functions small and focused
- Use proper error handling
- Add comments for complex logic
- Use strict validation (Zod for backend)

---

## Best Practices

### Multi-Tenancy
- Always filter queries by `orgId`
- Never assume user can access data without verification
- Verify role before sensitive operations
- Use AsyncLocalStorage for tenant context (backend)

### Security
- Validate all user inputs (Zod schemas)
- Hash passwords with bcryptjs
- Use httpOnly cookies for refresh tokens
- Implement rate limiting on auth endpoints
- Add CORS restrictions
- Sanitize file uploads

### Performance
- Use MongoDB aggregation pipelines
- Implement query pagination
- Cache frequently accessed data
- Downsample large datasets to 100 points max
- Index frequently queried fields

### Error Handling
- Return consistent error format: `{ error: { code, message } }`
- Log errors to console (or external service)
- Don't expose internal error details to client
- Use appropriate HTTP status codes

---

## Quick Reference

| Task | File | Command |
|------|------|---------|
| Start backend | `backend/src/app.js` | `npm run dev` |
| Start frontend | `frontend/src/main.jsx` | `npm run dev` |
| Run tests | `backend/tests/` | `npm test` |
| Build frontend | `frontend/vite.config.js` | `npm run build` |
| View API routes | `backend/src/routes/` | (Check route files) |
| View data models | `backend/src/models/` | (Check model files) |
| View components | `frontend/src/components/` | (Check component files) |

