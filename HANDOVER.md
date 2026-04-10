# NavTrack — Handover Document

This document is the definitive reference for anyone taking over ownership or ongoing development of NavTrack. It covers purpose, architecture decisions, current feature state, data flows, known limitations, and prioritised next steps.

> If you haven't already, read the [README](./README.md) first for setup and API reference. This document assumes you have the app running.

---

## 1. What NavTrack Is

NavTrack is a **self-hosted mutual fund portfolio tracker** built specifically around Eurobank's fund range. It is a personal record-keeping and analytics tool — not a trading platform.

**Core capabilities:**

- Maintain a ledger of BUY / SELL / SWITCH / DIVIDEND_REINVEST transactions per portfolio
- Derive portfolio positions (units held, weighted average cost basis) automatically from the transaction ledger
- Store historical NAV (Net Asset Value) prices per fund
- Fetch NAV prices automatically from Yahoo Finance via **Sync All NAV** (incremental) or **Force Refresh NAV** (full-history overwrite) — from the UI or via API
- Run a **weekly automated NAV sync** every Monday at 07:00 Athens time via the background worker
- Compute on-demand P&L valuations at any historical date
- Manage reusable allocation templates for proportional bulk purchases
- Import and export all data as JSON or CSV

The system is intentionally simple: one user, one database, no authentication in the current build.

---

## 2. Repository Layout

```
navtrack/
├── backend/                NestJS API (TypeScript)
│   └── src/
│       ├── instruments/        Fund CRUD + NAV upsert + import/export
│       ├── portfolios/         Portfolio CRUD + positions + recalculate + import/export
│       ├── transactions/       Transaction ledger CRUD + clear-all
│       ├── templates/          Allocation templates + apply + import/export
│       ├── nav-prices/         NAV time-series storage
│       ├── valuation/          On-demand P&L calculation
│       └── sync/               Yahoo Finance NAV sync (incremental + force refresh)
│                               writes per-instrument results to sync_jobs table
├── frontend/               React 19 + Vite + Tailwind CSS
│   └── src/
│       ├── pages/              InstrumentList, InstrumentDetail,
│       │                       PortfolioList, PortfolioDetail
│       ├── components/         Shared UI (SyncAllButton, modals, charts, badges …)
│       ├── api/                Typed API client (client.ts)
│       └── types/              Shared TypeScript types
├── worker/                 Python 3.14 scheduled worker (APScheduler)
│   ├── worker.py               All scheduled logic (valuation + NAV sync)
│   ├── requirements.txt
│   └── Dockerfile
├── db/
│   └── init.sql              Full schema + seed data (runs on fresh volume only)
├── .env.example
├── docker-compose.yml
├── README.md
├── HANDOVER.md             (this file)
└── SECURITY.md
```

---

## 3. Technology Choices & Rationale

| Layer | Choice | Why |
|---|---|---|
| API | NestJS 11 (TypeScript) | Opinionated structure; decorators map cleanly to REST; TypeORM integration |
| ORM | TypeORM (`synchronize: false`) | Schema owned by SQL, not the ORM — no surprise migrations in production |
| Database | PostgreSQL 18 (Alpine) | `NUMERIC(18,6)` for exact monetary arithmetic; strong JSON support (`JSONB`) |
| Frontend | React 19 + Vite + Tailwind | Fast iteration; Vite HMR; Tailwind utility classes |
| Container | Docker Compose (4 services) | Single-command start; reproducible environments |
| Worker | Python + APScheduler | Lightweight; easy to extend for scraping/scheduled tasks |
| Proxy | nginx (inside `frontend` container) | Eliminates CORS by proxying `/api/*` to the backend |
| NAV data | Yahoo Finance (via `yfinance`) | Provides historical price data for Eurobank funds by ISIN/ticker |

---

## 4. Key Design Decisions

### 4.1 Positions Are Derived, Not Manually Entered

The `portfolio_positions` table is a **computed projection** of the transaction ledger, not a primary data store. The authoritative source of truth is the `transactions` table. The `POST /portfolios/:id/positions/recalculate` endpoint rebuilds positions from the ledger at any time.

The frontend triggers recalculation **automatically** after every transaction mutation (add, edit, delete, bulk import, buy template, clear all). There is no manual recalculate button in the UI.

### 4.2 Valuation is Always On-Demand

There is no cached or pre-computed valuation table. Every call to `GET /portfolios/:id/valuation` computes P&L live from positions × NAV prices. This keeps the data model simple and avoids staleness, at the cost of a small compute overhead per page load.

The worker's daily valuation job (18:30 Athens) performs the same calculation but only logs the result to stdout — it does not persist to a separate table.

### 4.3 NAV Upsert Semantics

Posting a NAV entry for an `(instrument_id, date)` pair that already exists updates the value rather than erroring or creating a duplicate. This makes bulk import and the sync job safe to run repeatedly.

### 4.4 Import Skips, Never Overwrites

For all import endpoints (instruments, templates, portfolios/transactions), duplicate detection skips existing records rather than overwriting them. This is intentionally conservative — the user must manually edit or delete existing data if they want to replace it.

### 4.5 Single Origin via nginx Proxy

The nginx configuration inside the `frontend` container proxies `/api/*` to `backend:8080/api/*`. The React app always calls `/api/...` (relative), never a full backend URL. This means:
- No CORS configuration is needed
- The same pattern works identically in development and production
- `VITE_API_BASE_URL` build arg defaults to `/api`

### 4.6 Schema Migrations Are Manual SQL Files

There is no migration framework (Flyway, Liquibase, TypeORM migrations). The complete current schema lives in `db/init.sql`. On a fresh volume, `init.sql` creates the full schema. On existing volumes, any schema changes must be applied as manual `ALTER TABLE` / `CREATE TABLE` statements.

**This is the most significant operational risk.** Introduce a proper migration tool before the schema changes further.

### 4.7 NAV Sync: Two Modes + Weekly Scheduler

The `SyncModule` (`backend/src/sync/`) integrates with Yahoo Finance to fetch historical NAV prices:

- **Incremental** (`POST /sync/all`) — fetches only new data since the last recorded date per instrument. Safe to run any time.
- **Force Refresh** (`POST /sync/all?refresh=true&overwrite=true`) — re-fetches full history and overwrites existing prices. Use when data is missing or incorrect.

The UI exposes both modes via buttons in the Instruments page header. Their display order is **Force Refresh NAV** (left) then **Sync All NAV** (right).

In addition, the **worker** runs an independent incremental sync **every Monday at 07:00 Athens time** via APScheduler, and optionally on container startup if `SYNC_ON_STARTUP=true`.

### 4.8 Yahoo Finance Ticker Caching

The first time an instrument is synced, its Yahoo Finance ticker is resolved from the ISIN via `yf.Search`. The result is persisted in `instruments.external_ids` as `{"yahoo_ticker": "<symbol>"}`. All subsequent syncs read from this cache, skipping the resolution API call entirely.

### 4.9 Rate-Limit Handling in the Worker

Yahoo Finance applies rate limits to unauthenticated requests. The worker implements automatic retries with backoff: **15 s → 30 s → 60 s** between attempts, up to 3 retries. A 3-second inter-instrument delay is always applied during sequential syncs. The backend sync service has similar resilience.

### 4.10 sync_jobs Audit Table

Every sync run — whether triggered by the UI, API, worker scheduler, or startup — writes a row to the `sync_jobs` table per instrument. This records status (`SUCCESS`/`FAILED`), records fetched/upserted, any error message, timestamps, and the trigger source (`SCHEDULER`, `WORKER_STARTUP`, `API`). This is useful for auditing NAV data freshness and debugging sync failures.

---

## 5. Current Feature State

### ✅ Fully Working

- Portfolio and position management
- Full transaction ledger (BUY / SELL / SWITCH / DIVIDEND_REINVEST)
- Automatic position recalculation after every transaction mutation
- On-demand P&L valuation at any historical date
- Historical NAV storage and 30-day chart per instrument
- Allocation templates with proportional bulk BUY execution
- Import / Export for instruments, templates, and portfolios (JSON + CSV)
- Asset-class allocation charts (by class and by instrument)
- **Sync All NAV** button — incremental Yahoo Finance sync for all instruments
- **Force Refresh NAV** button — full-history overwrite with confirmation prompt
- Live sync results modal (per-instrument success/failure, records upserted)
- **Weekly automated NAV sync** — every Monday 07:00 Athens via the worker scheduler
- **SYNC_ON_STARTUP** env var — opt-in full sync on worker container start
- Yahoo Finance ticker caching in `instruments.external_ids`
- Rate-limit retry with backoff in the worker sync logic
- `sync_jobs` audit table — persists per-instrument sync results
- Full CRUD with edit/delete inline on all major entities
- Light/dark mode (system preference)
- Responsive layout (desktop + mobile)

### ⚠️ Partial / Manual

- **Daily valuation job** — logs P&L at 18:30 Athens time but does not persist results to a dedicated table. Results are stdout-only (visible via `docker-compose logs -f worker`).

### ❌ Not Yet Built

- Authentication / multi-user support
- Realised P&L tracking for SELL and SWITCH transactions
- Email / push notifications (e.g. daily P&L summary)
- Unit or integration tests
- Formal schema migration tooling (Flyway, Liquibase, or TypeORM migrations)
- CI/CD pipeline
- Multi-currency support (instruments have a `currency` field; all values currently assumed EUR)

---

## 6. Data Flow: Adding a Transaction

The most important user flow to understand end-to-end:

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

## 7. Data Flow: NAV Sync (UI / API)

```
User clicks "Force Refresh NAV" or "Sync All NAV"
        │
        ▼
POST /api/sync/all  (+ ?refresh=true&overwrite=true for force)
        │
        ▼
NestJS SyncService.syncAll()
  → fetches all instruments from DB
  → for each instrument:
      → reads cached yahoo_ticker from external_ids (or resolves + caches it)
      → calls Yahoo Finance API for price history (with retry/backoff)
      → bulk-upserts into nav_prices
      → writes row to sync_jobs table
        │
        ▼
Returns per-instrument SyncResult[]
  { isin, yahooTicker, status, recordsFetched, recordsUpserted, error? }
        │
        ▼
UI results modal renders per-instrument rows
  → onComplete() callback fires → page data refreshes
```

---

## 8. Data Flow: Worker Scheduled NAV Sync

```
APScheduler fires weekly_nav_sync (Monday 07:00 Athens)
        │
        ▼
worker.run_nav_sync(triggered_by="SCHEDULER")
  → connects directly to PostgreSQL
  → for each instrument:
      → reads cached yahoo_ticker (or resolves + caches)
      → determines from_date = MAX(nav_prices.date) + 1 day
      → fetches from Yahoo Finance via yfinance
      → upserts nav_prices rows
      → writes row to sync_jobs
      → sleeps 3 s before next instrument
        │
        ▼
Logs summary: fetched / upserted / errors
```

---

## 9. Running Locally Without Docker

For development, each service can be run natively:

```bash
# Database (still easiest via Docker)
docker run -e POSTGRES_DB=portfolio_db -e POSTGRES_USER=portfolio_user \
  -e POSTGRES_PASSWORD=portfolio_pass -p 5432:5432 postgres:18-alpine

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

## 10. Making Schema Changes

1. Write the `ALTER TABLE` / `CREATE TABLE` SQL statement.
2. Apply it to the running container:
   ```bash
   docker compose exec db psql -U portfolio_user -d portfolio_db
   -- then paste/run your SQL
   ```
3. Update `db/init.sql` to reflect the new schema (so fresh installs get it).
4. Update the corresponding TypeORM entity in `backend/src/`.
5. Update this document and the README if the change is user-visible or architectural.

> **Strongly recommended:** introduce Flyway or TypeORM migrations before making further schema changes. The current manual approach is fragile for any deployment with a live data volume.

---

## 11. Key Files Reference

| File | Purpose |
|---|---|
| `docker-compose.yml` | Defines all 4 services, networking, volumes, and port mappings |
| `.env.example` | Template for all required environment variables |
| `db/init.sql` | Full schema + seed data — runs once on a fresh volume |
| `backend/src/sync/sync.service.ts` | Yahoo Finance NAV fetching logic; writes to `sync_jobs` |
| `backend/src/valuation/valuation.service.ts` | Core P&L calculation logic |
| `backend/src/portfolios/positions.service.ts` | Position recalculation from ledger |
| `frontend/src/components/SyncAllButton.tsx` | Force Refresh NAV + Sync All NAV buttons and results modal |
| `frontend/src/pages/PortfolioDetail.tsx` | Most complex page: positions, transactions, charts, valuation |
| `frontend/src/api/client.ts` | Typed API client — all fetch calls go through here |
| `worker/worker.py` | All scheduled jobs: daily valuation (18:30) + weekly NAV sync (Mon 07:00) |

---

## 12. Environment & Secrets

- All configurable values live in `.env` (copied from `.env.example`).
- `.env` is listed in `.gitignore` and must **never** be committed.
- For production, use Docker secrets, Vault, or your platform's secret store.
- There are currently **no third-party API keys** required — Yahoo Finance is accessed via the `yfinance` library without authentication. This may change if Yahoo restricts unauthenticated access; if that happens, add a `YAHOO_FINANCE_API_KEY` env var and update both the backend `SyncService` and `worker.py`.

---

## 13. Recommended Next Steps (Priority Order)

| Priority | Task | Notes |
|---|---|---|
| 🔴 High | Introduce a migration tool | Flyway or TypeORM migrations — schema changes without versioning risk silent data loss |
| 🔴 High | Add authentication | Single-user JWT is sufficient; see README → Extending the App |
| 🟡 Medium | Realised P&L tracking | SELL and SWITCH transactions are recorded but realised gain is not yet computed |
| 🟡 Medium | Write integration tests | Focus on valuation logic and recalculate endpoint — these are the most critical |
| 🟡 Medium | CI/CD pipeline | GitHub Actions: lint → test → build → push Docker image |
| 🟡 Medium | Persist daily valuation results | Write the worker's daily valuation log to a `valuation_snapshots` table for trend analysis |
| 🟢 Low | Email / notification summary | Daily P&L email via the worker scheduler |
| 🟢 Low | Multi-currency support | All values currently assumed EUR; instruments have `currency` field ready |
| 🟢 Low | Yahoo Finance API resilience | Consider adding a paid or authenticated data source as a fallback |

---

## 14. Known Gotchas

- **NAV sync requires live internet access.** The `worker` and `backend` containers must reach Yahoo Finance. In air-gapped or firewalled environments this fails — check container logs.
- **`synchronize: false` in TypeORM** means entity changes do NOT auto-migrate the DB. Always manually apply schema changes and update `init.sql`.
- **`init.sql` only runs on a fresh volume.** If the Docker volume already exists, `init.sql` is ignored. To reset completely: `docker-compose down -v`.
- **Import skips duplicates silently.** If a re-import appears to do nothing, the records already exist. Delete them first if you need to replace them.
- **Valuation uses the latest NAV on or before the requested date.** If no NAV exists for an instrument before the valuation date, that position's value will be zero. Run a sync first.
- **The worker's daily valuation job logs to stdout only** — visible via `docker-compose logs -f worker`. It does not write to a DB table.
- **`SYNC_ON_STARTUP=true` can trigger Yahoo rate limits.** Firing 11 sequential ticker resolutions immediately on boot is the exact pattern that causes 429 errors. Use this only on a cold DB where you accept the wait. The retry/backoff logic will handle it, but startup will take several minutes.
- **Yahoo Finance ticker cache.** If a cached ticker in `external_ids` becomes stale (e.g. a fund changes its listing symbol), clear it manually: `UPDATE instruments SET external_ids = external_ids - 'yahoo_ticker' WHERE isin = '<ISIN>';`

---

## 15. Contact & Ownership

| Role | Name | GitHub |
|---|---|---|
| Original author | Konstantinos Mavridis | [@Konstantinos-Mavridis](https://github.com/Konstantinos-Mavridis) |

---

## 16. Useful Commands Cheatsheet

```bash
# Start everything
docker-compose up --build

# Stop without losing data
docker-compose down

# Wipe all data and start fresh
docker-compose down -v && docker-compose up --build

# View backend logs
docker-compose logs -f backend

# View worker logs (valuation + sync output)
docker-compose logs -f worker

# Open a psql shell
docker compose exec db psql -U portfolio_user -d portfolio_db

# Rebuild only the frontend
docker-compose build frontend && docker-compose up -d frontend

# Rebuild only the backend
docker-compose build backend && docker-compose up -d backend

# Trigger incremental NAV sync via API (through frontend nginx proxy)
curl -X POST http://localhost:3000/api/sync/all

# Trigger force refresh NAV sync via API
curl -X POST "http://localhost:3000/api/sync/all?refresh=true&overwrite=true"

# Manually recalculate positions for a portfolio
PORTFOLIO_ID=$(curl -s http://localhost:3000/api/portfolios | jq -r '.[0].id')
curl -X POST "http://localhost:3000/api/portfolios/$PORTFOLIO_ID/positions/recalculate"

# Clear a stale Yahoo Finance ticker cache for one instrument
docker compose exec db psql -U portfolio_user -d portfolio_db -c \
  "UPDATE instruments SET external_ids = external_ids - 'yahoo_ticker' WHERE isin = '<ISIN>';"

# View recent sync job audit log
docker compose exec db psql -U portfolio_user -d portfolio_db -c \
  "SELECT i.isin, s.status, s.records_upserted, s.triggered_by, s.completed_at \
   FROM sync_jobs s JOIN instruments i ON i.id = s.instrument_id \
   ORDER BY s.completed_at DESC LIMIT 20;"
```
