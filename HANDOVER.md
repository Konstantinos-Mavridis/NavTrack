# NavTrack — Handover Document

This document is intended for a developer or team taking over ownership of
NavTrack. It covers the system's purpose, architecture decisions, current
state, known limitations, and recommended next steps.

---

## 1. What NavTrack Is

NavTrack is a **self-hosted mutual fund portfolio tracker** built specifically
around Eurobank's fund range. It is not a trading platform — it is a
personal record-keeping and analytics tool.

Core capabilities:

- Maintain a ledger of BUY / SELL / SWITCH / DIVIDEND_REINVEST transactions
  per portfolio
- Derive portfolio positions (units held, weighted average cost basis)
  automatically from the transaction ledger
- Store historical NAV (Net Asset Value) prices per fund
- Compute on-demand P&L valuations at any historical date
- Manage reusable allocation templates for proportional bulk purchases
- Import and export all data as JSON or CSV

The system is intentionally simple: one user, one database, no authentication
in the current build.

---

## 2. Repository Layout

```
navtrack/
├── backend/          NestJS API (TypeScript)
│   └── src/
│       ├── instruments/      Fund CRUD + NAV upsert + import/export
│       ├── portfolios/       Portfolio CRUD + positions + recalculate
│       ├── transactions/     Transaction ledger CRUD + clear-all
│       ├── templates/        Allocation templates + apply + import/export
│       ├── nav-prices/       NAV time-series storage
│       ├── valuation/        On-demand P&L calculation
│       └── sync/             NAV sync trigger (used by UI "Sync All")
├── frontend/         React 18 + Vite + Tailwind CSS
│   └── src/
│       ├── pages/            InstrumentList, InstrumentDetail,
│       │                     PortfolioList, PortfolioDetail
│       ├── components/       Shared UI (modals, charts, badges, etc.)
│       ├── api/              Typed API client (client.ts)
│       └── types/            Shared TypeScript types
├── worker/           Python 3.12 scheduled worker (APScheduler)
├── db/
│   ├── init.sql              Full schema + seed data (runs on fresh volume)
│   ├── migration_templates.sql
│   └── migration_precision_6.sql
├── .env.example
├── docker-compose.yml
├── README.md
└── HANDOVER.md       (this file)
```

---

## 3. Technology Choices & Rationale

| Layer | Choice | Why |
|---|---|---|
| API | NestJS 10 (TypeScript) | Opinionated structure; decorators map cleanly to REST; TypeORM integration |
| ORM | TypeORM (`synchronize: false`) | Schema owned by SQL, not the ORM — no surprise migrations in production |
| Database | PostgreSQL 16 | `NUMERIC(18,6)` for exact monetary arithmetic; strong JSON support (`JSONB`) |
| Frontend | React 18 + Vite + Tailwind | Fast iteration; Vite HMR; Tailwind utility classes |
| Container | Docker Compose (4 services) | Single-command start; reproducible environments |
| Worker | Python + APScheduler | Lightweight; easy to extend for scraping/scheduled tasks |
| Proxy | nginx (inside `frontend` container) | Eliminates CORS by proxying `/api/*` to the backend |

---

## 4. Key Design Decisions

### 4.1 Positions Are Derived, Not Manually Entered

The `portfolio_positions` table is a **computed projection** of the transaction
ledger, not a primary data store. The authoritative source of truth is the
`transactions` table. The `POST /portfolios/:id/positions/recalculate`
endpoint rebuilds positions from the ledger at any time.

The frontend triggers recalculation **automatically** after every transaction
mutation (add, edit, delete, bulk import, buy template, clear all). There is
no manual recalculate button in the UI.

### 4.2 Valuation is Always On-Demand

There is no cached or pre-computed valuation table. Every call to
`GET /portfolios/:id/valuation` computes P&L live from positions × NAV prices.
This keeps the data model simple and avoids staleness, at the cost of a small
compute overhead per page load.

### 4.3 NAV Upsert Semantics

Posting a NAV entry for an `(instrument_id, date)` pair that already exists
updates the value rather than erroring or creating a duplicate. This makes
bulk import and the scraper job safe to run repeatedly.

### 4.4 Import Skips, Never Overwrites

For all import endpoints (instruments, templates, portfolios/transactions),
duplicate detection skips existing records rather than overwriting them.
This is intentionally conservative — the user must manually edit or delete
existing data if they want to replace it.

### 4.5 Single Origin via nginx Proxy

The nginx configuration inside the `frontend` container proxies `/api/*`
to `backend:8080/api/*`. The React app always calls `/api/...` (relative),
never a full backend URL. This means:
- No CORS configuration is needed
- The same pattern works identically in development and production
- The `VITE_API_BASE_URL` build arg defaults to `/api`

### 4.6 Schema Migrations Are Manual SQL Files

There is no migration framework (Flyway, Liquibase, TypeORM migrations).
Schema changes are applied as numbered SQL files in `db/`. On a fresh volume,
`init.sql` creates the full current schema. On existing volumes, migration
files must be applied manually (see README Quick Start → Upgrading).

**This is the most significant operational risk for the current handover.**
Recommended next step: introduce a proper migration tool before the schema
changes further.

---

## 5. Current Feature State

### ✅ Fully Working

- Portfolio and position management
- Full transaction ledger (BUY / SELL / SWITCH / DIVIDEND_REINVEST)
- Automatic position recalculation after every transaction mutation
- On-demand P&L valuation at any historical date
- Historical NAV storage and 30-day chart
- Allocation templates with proportional bulk BUY execution
- Import / Export for instruments, templates, and portfolios (JSON + CSV)
- Asset-class allocation charts (by class and by instrument)
- "Sync All" button to trigger NAV fetching for all instruments
- Full CRUD with edit/delete inline on all major entities
- Light/dark mode (system preference)
- Responsive layout (desktop + mobile)

### ⚠️ Partial / Manual

- **NAV data entry** — no automatic scraper is wired up. NAVs can be entered
  manually via the Instrument Detail page or bulk-loaded via the API/import.
  The FT data source URLs are stored per instrument, ready for a scraper.
- **Worker scheduled job** — logs a daily valuation at 18:30 Athens time but
  does not yet fetch live NAV data from external sources.

### ❌ Not Yet Built

- Authentication / multi-user support
- Automated NAV scraping from Financial Times or Eurobank AM
- Email / push notifications (e.g. daily P&L summary)
- Unit or integration tests
- Formal schema migration tooling
- CI/CD pipeline

---

## 6. Data Flow: Adding a Transaction

This is the most important user flow to understand end-to-end:

```
User fills TransactionFormModal
        │
        ▼
POST /api/portfolios/:id/transactions
        │
        ▼
NestJS TransactionsService.create()
  → inserts row into `transactions` table
        │
        ▼  (frontend: autoRecalculate() fires silently)
POST /api/portfolios/:id/positions/recalculate
        │
        ▼
NestJS PositionsService.recalculate()
  → reads all transactions for portfolio
  → groups by instrument_id
  → sums units; computes weighted-avg cost basis
  → upserts into `portfolio_positions`
        │
        ▼
GET /api/portfolios/:id/valuation
  → reads positions × nav_prices
  → returns P&L, weights, allocation
        │
        ▼
UI re-renders positions tab + stat cards
```

The same flow applies for template buys, imports, and deletions.

---

## 7. Running Locally Without Docker

For development, each service can be run natively:

```bash
# Database (still easiest via Docker)
docker run -e POSTGRES_DB=portfolio_db -e POSTGRES_USER=portfolio_user \
  -e POSTGRES_PASSWORD=portfolio_pass -p 5432:5432 postgres:16

# Apply schema
psql -U portfolio_user -d portfolio_db -h localhost < db/init.sql

# Backend
cd backend
npm install
npm run start:dev   # starts on :8080

# Frontend
cd frontend
npm install
npm run dev         # starts on :5173 (Vite dev server)
# Set VITE_API_BASE_URL=http://localhost:8080/api in .env.local

# Worker (optional)
cd worker
pip install -r requirements.txt
python worker.py
```

---

## 8. Making Schema Changes

1. Write a new `db/migration_XXXX_description.sql` file.
2. Apply it to running containers:
   ```bash
   docker compose exec -T db psql -U portfolio_user -d portfolio_db \
     < db/migration_XXXX_description.sql
   ```
3. Update the corresponding TypeORM entity in `backend/src/`.
4. Update `db/init.sql` to reflect the new schema (for future fresh installs).
5. Update this document and the README if the change is significant.

---

## 9. Environment & Secrets

- All configurable values live in `.env` (copied from `.env.example`).
- `.env` is listed in `.gitignore` and must **never** be committed.
- For production, use Docker secrets, Vault, or your platform's secret store.
- There are no API keys or external service credentials in the current build
  (NAV fetching is manual).

---

## 10. Recommended Next Steps (Priority Order)

| Priority | Task | Notes |
|---|---|---|
| 🔴 High | Introduce a migration tool | Flyway or TypeORM migrations — schema is drifting without versioning |
| 🔴 High | Add authentication | Single-user JWT is sufficient; see README → Extending the App |
| 🟡 Medium | Automated NAV scraping | FT URLs already stored per instrument; Python worker is ready to extend |
| 🟡 Medium | Write integration tests | Focus on valuation logic and recalculate endpoint — these are the most critical |
| 🟡 Medium | CI/CD pipeline | GitHub Actions: lint → test → build → push Docker image |
| 🟢 Low | Email / notification summary | Daily P&L email via the worker scheduler |
| 🟢 Low | Realised P&L tracking | SELL and SWITCH transactions are recorded but realised gain is not yet computed |
| 🟢 Low | Multi-currency support | All values currently assumed EUR; instruments have `currency` field ready |

---

## 11. Contact & Ownership

| Role | Name | GitHub |
|---|---|---|
| Original author | Konstantinos Mavridis | [@Konstantinos-Mavridis](https://github.com/Konstantinos-Mavridis) |

---

## 12. Useful Commands Cheatsheet

```bash
# Start everything
docker-compose up --build

# Stop without losing data
docker-compose down

# Wipe all data and start fresh
docker-compose down -v && docker-compose up --build

# View backend logs
docker-compose logs -f backend

# View worker logs
docker-compose logs -f worker

# Open a psql shell
docker compose exec db psql -U portfolio_user -d portfolio_db

# Apply a migration
docker compose exec -T db psql -U portfolio_user -d portfolio_db \
  < db/migration_XXXX.sql

# Rebuild only the frontend
docker-compose build frontend && docker-compose up -d frontend

# Rebuild only the backend
docker-compose build backend && docker-compose up -d backend
```
