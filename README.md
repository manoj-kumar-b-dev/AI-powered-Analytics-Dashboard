# Multi-Tenant SaaS Analytics Platform — Tier 1 Foundation

This is the foundation layer for a multi-tenant SaaS analytics platform. It implements stateless JWT authentication with refresh token rotation, automatic Mongoose multi-tenant isolation, automated CSV/Excel schema inference, server-side data aggregation with downsampling, automated chart recommendation engines, and customizable dashboard grid workspaces.

---

## Directory Structure

```
/
├── backend/
│   ├── src/
│   │   ├── config/          # Passport and strategy configurations
│   │   ├── middleware/      # Auth, tenant boundary injections, role validation
│   │   ├── models/          # User, Org, RefreshToken, DataSource, DataRow, Dashboard schemas
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # File parsing, column cast tools, chart recommenders
│   │   └── app.js           # Server initializer
│   ├── tests/               # Integration suites
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/      # AutoChart, KpiCardRow layouts
    │   ├── context/         # Auth state context with auto token-refresh retry hook
    │   ├── App.jsx          # Unified dashboard app core
    │   ├── index.css        # Premium dark glassmorphic styling tokens
    │   └── main.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Architecture & Security Highlights

### 1. Zero-Leak Multi-Tenancy (Feature 2)
Tenancy boundaries are enforced using Node's `AsyncLocalStorage` and a global Mongoose plugin.
- When an API endpoint is requested, `requireAuth` validates the access token and initiates a context block containing the user's `orgId`.
- The custom Mongoose plugin intercepts Mongoose query builders (`find`, `findOne`, `count`, etc.) and automatically appends `{ orgId }` constraints.
- Aggregation pipelines are similarly intercepted; a `$match` filter targeting the active tenant is prepended before any grouping stages occur.
- It is structurally impossible to query database models without scoping filters except on explicitly unauthenticated endpoints (like login).

### 2. Secure Refresh Token Rotation (Feature 1)
- Sessions issue short-lived Access Tokens (15 min) and long-lived opaque Refresh Tokens (14 days).
- Refresh tokens are stored in the database as SHA-256 hashes (protecting sessions from database breaches) and sent to clients via `httpOnly` secure cookies.
- Token refresh rotates the credentials. If a reuse is detected (indicating token theft), the backend invalidates the entire token family, logging out all sessions in that family.

### 3. Server-Side Aggregation & Downsampling (Feature 4 & 5)
- All KPI counts and chart coordinates are computed database-side using MongoDB aggregate pipelines.
- To prevent frontend rendering crashes, data pipelines automatically cap and downsample records to `max 100 points`. Categorical coordinates combine excess classes into an "Other" category. Time series downsample using regular interval skips to preserve trend visual shapes.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm
- MongoDB (or we run with in-memory Mongo database in tests)

### Backend Setup
1. Enter the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create your `.env` file:
   ```bash
   cp .env.example .env
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Enter the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Start Vite dev server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## API Endpoints List

### Auth Route (`/auth`)
- `POST /auth/register` — Create user and provision organization (owner role).
- `POST /auth/login` — Sign in with email and password.
- `POST /auth/refresh` — Invalidate previous refresh token, rotate cookie credentials, and issue access token.
- `POST /auth/logout` — Revoke active refresh token.
- `GET /auth/google` — Initiate Passport Google OAuth strategy.
- `PUT /auth/switch-org` — Swaps acting workspace context (returns new scoped JWT).
- `GET /auth/me` — Retrieves session details and list of associated organizations.

### Organization Route (`/orgs`)
- `POST /orgs/:orgId/invite` — Generate signed workspace invite link (Admin/Owner only).
- `POST /orgs/invite/accept` — Accept invite (link to existing profile or create new user credentials).
- `GET /orgs/:orgId` — Fetch current organization settings.

### Data Sources Route (`/datasources`)
- `POST /datasources/upload` — Staging multi-part file drop. Normalizes columns and runs type inference.
- `GET /datasources` — List all registered data sets.
- `GET /datasources/:id/preview` — Returns validation anomalies and first 50 staging rows.
- `POST /datasources/:id/confirm` — Commit staging set as a verified schema.
- `DELETE /datasources/:id` — Delete source and clean up rows.

### Analytics Route (`/analytics`)
- `GET /analytics/:id/suggest-charts` — Runs deterministic heuristic rules to suggest chart pairings.
- `GET /analytics/:id/chart-data` — Downsampled coordinates query.
- `POST /analytics/:id/kpi-mapping` — Overrides synonym auto-detection mappings.
- `GET /analytics/:id/kpis` — Computes KPI averages and growth targets.

### Dashboards Route (`/dashboards`)
- `POST /dashboards` — Save dashboard.
- `GET /dashboards` — List all org dashboards.
- `GET /dashboards/:id` — Resolves and returns dashboard schema + live widget aggregations.
- `PUT /dashboards/:id` — Update grid widget dimensions or configs.
- `DELETE /dashboards/:id` — Delete board.
