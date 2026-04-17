# NavTrack — Handover Document

This document is the definitive reference for anyone taking over ownership or ongoing development of NavTrack. It covers purpose, architecture decisions, current feature state, data flows, known limitations, and prioritised next steps.

---

## 1. Purpose

NavTrack is a self-hosted mutual-fund portfolio tracker with a bias toward **Eurobank's fund range**. It is intended for a single user or small private deployment where the user wants to:

- Record mutual-fund transactions
- Track historical NAV prices
- See current and historical portfolio valuation and P&L
- Reuse allocation templates for repeat investment patterns
- Run manual or scheduled Yahoo Finance NAV synchronisation jobs
- Keep the entire stack running locally via Docker Compose

The product is intentionally simple:
- no auth layer
- no external SaaS dependencies beyond Yahoo Finance lookups
- no live market streaming
- no broker integrations
- no background queues beyond the Python scheduler worker

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS |
| Frontend server | nginx |
| Backend API | NestJS 11, TypeScript, TypeORM |
| Database | PostgreSQL 18 |
| Background worker | Python 3.14, APScheduler, psycopg 3, yfinance |
| Container orchestration | Docker Compose |
| Image registry | GitHub Container Registry (GHCR) |
| CI/CD | GitHub Actions |

---

## 3. High-Level Architecture

```text
Browser
  ↓
nginx frontend container (:80 inside container, :3000 on host)
  ├─ serves React build output
  └─ proxies /api/* → backend:8080

backend container
  ├─ REST API for CRUD, valuation, import/export, sync triggers
  └─ TypeORM connection to PostgreSQL

worker container
  ├─ direct PostgreSQL access
  ├─ scheduled valuation logging
  └─ scheduled Yahoo Finance NAV sync jobs

db container
  └─ PostgreSQL with schema + seed created by db/init.sql on first boot
```

The browser only talks to **one origin** (`http://localhost:3000`) thanks to nginx proxying `/api` to the backend. This avoids CORS complexity.

---

## 4. Core Product Behaviour

### 4.1 Transactions Drive Positions

Positions are not treated as the source of truth. The canonical record is the **transactions ledger**.

Whenever a transaction changes, the backend recalculates portfolio positions by replaying the entire ledger in date order.

Supported transaction types:
- `BUY`
- `SELL`
- `SWITCH`
- `DIVIDEND_REINVEST`

The frontend triggers recalculation **automatically** after every transaction mutation (add, edit, delete, bulk import, buy template, clear all). There is no manual recalculate button in the UI.

### 4.2 Valuation is Always On-Demand

There is no cached or pre-computed valuation table. Every call to `GET /portfolios/:id/valuation` computes P&L live from positions × NAV prices. This keeps the data model simple and avoids staleness, at the cost of a small compute overhead per page load.

The worker's daily valuation job (23:00 Athens) performs the same calculation but only logs the result to stdout — it does not persist to a separate table.

### 4.3 NAV Upsert Semantics

Posting a NAV entry for an `(instrument_id, date)` pair that already exists updates the value rather than erroring or creating a duplicate. This makes bulk import and the sync job safe to run repeatedly.

### 4.4 Import Skips, Never Overwrites

For all import endpoints (instruments, templates, portfolios/transactions), duplicate detection skips existing records rather than overwriting them. This is intentionally conservative — the user must manually edit or delete existing data if they want to replace it.

### 4.5 Single Origin via nginx Proxy

The nginx configuration inside the `frontend` container proxies `/api/*` to `backend:8080/api/*`. The React app always calls `/api/...` (relative), never a full backend URL. This means:
- No CORS configuration is needed
- Frontend deploys cleanly in both local and production compose setups
- `VITE_API_BASE_URL` can safely stay `/api` unless the proxy model changes

---

## 5. Data Model Overview

The schema is created by `db/init.sql`.

### 5.1 Main Tables

| Table | Purpose |
|---|---|
| `instruments` | Mutual fund master records |
| `nav_prices` | Historical NAVs per instrument by date |
| `portfolios` | Portfolio containers |
| `transactions` | Ledger of investment actions |
| `positions` | Materialised current holdings rebuilt from ledger |
| `allocation_templates` | Template headers |
| `allocation_template_items` | Template line items / weights |
| `sync_jobs` | Audit log for sync attempts |

### 5.2 Notable Constraints

- `nav_prices` has `UNIQUE (instrument_id, date)`
- `allocation_template_items` has `UNIQUE (template_id, instrument_id)`
- Risk level is constrained to 1–7
- Transaction type is limited to the four supported enums
- Positions are numeric and non-negative after recalculation

---

## 6. Worker Behaviour

The worker has **two responsibilities**:
1. Log valuation snapshots to stdout on a schedule
2. Perform Yahoo Finance NAV syncs on a schedule or at startup

At container boot it:
1. Waits for PostgreSQL to become available
2. Verifies the `portfolios` table exists
3. Checks that the seed data looks sane
4. Runs one immediate valuation pass
5. Optionally performs a full incremental NAV sync if `SYNC_ON_STARTUP=true`

In addition, the **worker** runs a full incremental sync on container startup if `SYNC_ON_STARTUP=true`.

### 6.1 Current Schedules

| Job | Schedule | Notes |
|---|---|---|
| Afternoon NAV sync | Mon–Fri 16:05 Europe/Athens | Catches funds whose NAVs are available by mid-afternoon |
| Evening NAV sync | Mon–Fri 22:05 Europe/Athens | Safety-net run after Yahoo's delayed end-of-day batch |
| Daily valuation | Daily 23:05 Europe/Athens | Logs valuations after both NAV syncs have had time to complete |

### 6.2 Trigger Sources Written to `sync_jobs`

The worker/backend currently writes these trigger values:
- `MANUAL_SINGLE`
- `MANUAL_ALL`
- `WORKER_STARTUP`
- `SCHEDULER_AFTERNOON`
- `SCHEDULER_EVENING`

---

## 7. Feature Inventory

### 7.1 Portfolios

Implemented:
- List portfolios
- Create / edit / delete portfolios
- Portfolio detail page with:
  - summary metrics
  - allocation charts
  - positions table
  - transactions table
  - import/export
  - historical valuation by date

### 7.2 Transactions

Implemented:
- Add transaction
- Edit transaction
- Delete transaction
- Clear all transactions for a portfolio
- Apply allocation template to generate bulk BUY transactions
- Automatic positions recalculation after every mutation

### 7.3 Instruments

Implemented:
- List/search instruments
- Create / edit / delete instruments
- View NAV history
- Add manual NAV entries
- Import/export NAV history
- Force refresh a single instrument from Yahoo
- Sync all instruments from Yahoo

### 7.4 Templates

Implemented:
- List templates
- Create / edit / delete templates
- Store template line items with target percentages
- Import/export templates

### 7.5 Sync Jobs

Implemented:
- Store one audit row per sync attempt
- View sync job list in the UI
- Capture trigger source, status, fetched count, upsert count, and error text

---

## 8. Data Flow: Worker Scheduled NAV Sync

```text
APScheduler fires scheduled sync job
        │
        ▼
worker.run_nav_sync(triggered_by="SCHEDULER_*")
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

Important details:
- Sync is incremental, not full-history on every run
- Upsert makes the process idempotent
- A pause between instruments reduces Yahoo rate-limit risk
- Results are durable in `sync_jobs`

---

## 9. Data Flow: On-Demand Valuation

```text
Frontend page loads / user changes valuation date
        │
        ▼
GET /api/portfolios/:id/valuation?date=YYYY-MM-DD
        │
        ▼
Backend loads positions for portfolio
        │
        ▼
For each position:
  look up latest NAV on or before requested date
        │
        ▼
Aggregate cost, value, unrealised P&L, return %
        │
        ▼
Return JSON to frontend
```

Because valuation is live, there is no separate snapshot table or ETL process to maintain.

---

## 10. Important Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | `navtrack` | Used in network / volume naming and image naming |
| `CONTAINER_REGISTRY_NAMESPACE` | `konstantinos-mavridis` | GHCR namespace for pre-built images |
| `POSTGRES_DB` | `navtrack_db` | DB name |
| `POSTGRES_USER` | `navtrack_user` | DB user |
| `POSTGRES_PASSWORD` | `navtrack_pass` | **Must change for real deployment** |
| `BACKEND_PORT` | `8080` | Backend service port |
| `FRONTEND_PORT` | `3000` | Frontend exposed host port |
| `SYNC_ON_STARTUP` | `true` | Triggers a full sync on worker startup. Set to `false` to skip and avoid Yahoo Finance rate limits on every boot. |

`VITE_API_BASE_URL` is baked into the frontend at build time and defaults to `/api`.

---

## 11. Versioning & Release Process

NavTrack uses a single **Semantic Versioning** (`vX.Y.Z`) tag shared across all three services. All Docker images are released together.

### Version files

| File | Field | Service |
|---|---|---|
| `backend/package.json` | `version` | Backend |
| `frontend/package.json` | `version` | Frontend |
| `worker/VERSION` | plain text | Worker |

All three files are bumped atomically by the `release.yml` workflow — never edit them manually.

### Release workflow (`release.yml`)

Triggered manually via **Actions → Release → Run workflow**. Inputs:

| Input | Required | Description |
|---|---|---|
| `version` | Yes | New version, no leading `v` (e.g. `1.2.0`) |
| `release_notes` | No | Markdown release notes; shown in the GitHub Release body |
| `prerelease` | No | Tick to mark as pre-release (skips promoting as `latest`) |

Workflow steps:

1. **Validate** — rejects non-SemVer input and fails if the tag already exists.
2. **Checkout** — full history of `main`.
3. **Bump** — writes new version into all three version files.
4. **Commit** — pushes a `chore(release): bump version to X.Y.Z [skip ci]` commit to `main`. The `[skip ci]` trailer prevents CI Gate from triggering a redundant Docker build from the bump commit.
5. **Tag** — creates and pushes an annotated Git tag `vX.Y.Z`.
6. **GitHub Release** — creates a release entry visible on the [Releases page](https://github.com/Konstantinos-Mavridis/NavTrack/releases), using the `release_notes` input as the body (falls back to a link to `CHANGELOG.md` if empty).
7. **Dispatch** — triggers `docker-backend.yml`, `docker-frontend.yml`, and `docker-worker.yml` at the new tag ref.

### Resulting Docker image tags

Every build triggered by a `vX.Y.Z` tag produces the following GHCR tags automatically:

| Tag | Example |
|---|---|
| Full version | `1.2.3` |
| Minor alias | `1.2` |
| Major alias | `1` |
| Short SHA | `sha-a1b2c3d` |
| `latest` | `latest` (stable releases only) |

### Changelog

Maintain [`CHANGELOG.md`](./CHANGELOG.md) using the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Add entries to the `[Unreleased]` section during development; promote them to a versioned section when cutting a release. The workflow does **not** edit the changelog automatically.

### Version bump guide

| Change | Bump |
|---|---|
| Bug fixes, dependency bumps, infra tweaks | `PATCH` |
| New features, non-breaking API additions | `MINOR` |
| Breaking API changes, major DB migrations | `MAJOR` |

---

## 12. CI/CD Pipeline

| Workflow | Trigger | Purpose |
|---|---|---|
| `sonarqube.yml` | Push / PR to `main`, `workflow_call` | Static analysis |
| `codeql.yml` | Push / PR to `main`, weekly | Security analysis |
| `ci-gate.yml` | After SonarQube + CodeQL complete | Waits for both to pass, dispatches Docker builds for changed services |
| `docker-backend.yml` | `workflow_dispatch` / `workflow_call` | Builds + pushes backend image |
| `docker-frontend.yml` | `workflow_dispatch` / `workflow_call` | Builds + pushes frontend image |
| `docker-worker.yml` | `workflow_dispatch` / `workflow_call` | Builds + pushes worker image |
| `docker-all.yml` | `workflow_dispatch` | Rebuilds all three images at the latest release tag |
| `release.yml` | `workflow_dispatch` | Cuts a release (see §11) |

The `workflow_call` trigger on each Docker workflow allows `release.yml` to invoke them directly at a tag ref, ensuring semver image tags are applied correctly.

---

## 13. Current Operational Notes

- **Manual sync buttons exist in the UI** — users do not need to wait for the scheduler.
- **SYNC_ON_STARTUP** env var — opt-in full sync on worker container start
- **The scheduler uses Europe/Athens timezone** explicitly.
- **The database is internal-only by default** — no host port exposure unless manually added.
- **TypeORM does not own schema migrations** — `db/init.sql` is the schema source of truth.
- **Imports skip duplicates instead of updating them.**
- **Portfolio positions are recomputed from transactions, not edited directly.**
- **The React app assumes the nginx proxy pattern (`/api`).**
- **Daily valuation job** — logs P&L at 23:00 Athens time (after the evening NAV sync completes) but does not persist results to a dedicated table. Results are stdout-only (visible via `docker compose -f compose.dev.yml logs -f worker`).
- **Version bump commits carry `[skip ci]`** — this prevents CI Gate from dispatching a redundant Docker build for the bump commit. Only the tag-triggered builds (dispatched explicitly by `release.yml`) produce versioned images.

---

## 14. Local Dev / Deployment Modes

### `compose.dev.yml`
Use this for development:
- builds images from local source
- faster iteration when editing backend/frontend/worker code

### `compose.yml`
Use this for deployment:
- pulls pre-built images from GHCR
- designed to work with CI-published images
- pin to a specific `vX.Y.Z` tag for reproducible deployments

Both depend on `.env` for ports, DB credentials, project naming, and registry namespace.

---

## 15. Repo Structure Guide

| Path | Purpose |
|---|---|
| `backend/` | NestJS API source |
| `frontend/` | React SPA source |
| `worker/` | Python worker source |
| `worker/VERSION` | Worker version file (bumped by `release.yml`) |
| `db/init.sql` | Schema + seed creation |
| `compose.dev.yml` | Local build compose file |
| `compose.yml` | GHCR-based deploy compose file |
| `.github/workflows/` | CI/CD workflows |
| `.github/ISSUE_TEMPLATE/` | GitHub issue templates |
| `.github/PULL_REQUEST_TEMPLATE.md` | GitHub PR template |
| `CHANGELOG.md` | Release history (Keep a Changelog format) |
| `CODE_OF_CONDUCT.md` | Community standards |
| `CONTRIBUTING.md` | Developer guidelines and workflow |
| `SECURITY.md` | Security policy and disclosure process |
| `README.md` | Primary operator-facing docs |
| `HANDOVER.md` | This handover document |

### 15.1 Files Worth Reading First

If taking over the codebase, read these first:
1. `README.md`
2. `db/init.sql`
3. `worker/worker.py`
4. `backend/src/app.module.ts`
5. `frontend/src/App.tsx`

---

## 16. Known Limitations

### Product / Architecture

- No authentication or multi-user support
- No migrations system; schema changes require editing `db/init.sql`
- No persistent valuation snapshot table
- No broker import integration
- No background job queue beyond APScheduler
- No retry queue / dead-letter mechanism for failed syncs
- No automated backup strategy bundled with the stack

### Data / Sync

- Yahoo Finance availability for mutual funds can be inconsistent
- Some instruments may never resolve cleanly via Yahoo ticker search
- Startup sync and large all-instrument syncs are vulnerable to 429 rate-limit behaviour
- NAV coverage is only as good as Yahoo's data source

### UX

- No user preferences / settings page
- No dashboard trend charts beyond current allocation views
- No notifications for failed syncs

---

## 17. Recommended Next Improvements

### High value

| Priority | Improvement | Why |
|---|---|---|
| 🟢 High | Persist valuation snapshots | Makes historical trend charts and performance analytics much easier |
| 🟢 High | Add structured migrations | Safer schema evolution than editing one init script |
| 🟢 High | Add retry / backoff metrics to sync job UI | Better visibility into Yahoo failures |
| 🟢 High | Add auth if exposed beyond localhost/private LAN | Current setup assumes trusted environment |

### Medium value

| Priority | Improvement | Why |
|---|---|---|
| 🟡 Medium | Persist daily valuation results | Write the worker's daily valuation log to a `valuation_snapshots` table for trend analysis |
| 🟡 Medium | Add notifications / alerts for failed syncs | Easier operational awareness |
| 🟡 Medium | Add richer charts | Portfolio value over time, asset-class history, drawdown views |
| 🟡 Medium | Add import validation reporting in UI | Better bulk import troubleshooting |

### Lower value / optional

| Priority | Improvement | Why |
|---|---|---|
| 🔵 Low | Add CSV scheduling config via env vars | Easier operator control without code changes |
| 🔵 Low | Add DB admin tools in dev compose | Useful for development convenience |
| 🔵 Low | Add richer seed scenarios | Better demo data |

---

## 18. Operational Caveats

- **The worker's daily valuation job logs to stdout only** — visible via `docker compose -f compose.dev.yml logs -f worker`. It does not write to a DB table.
- **`SYNC_ON_STARTUP=true` (the default) can trigger Yahoo rate limits.** Firing sequential ticker resolutions immediately on boot may cause 429 errors. The retry/backoff logic handles this automatically, but startup will take several minutes. Set `SYNC_ON_STARTUP=false` if you want a faster restart and are willing to rely on the scheduled syncs.
- **Deleting or recreating the Postgres volume reruns `db/init.sql`** and reseeds the app from scratch.
- **TypeORM `synchronize` is disabled intentionally** — do not casually enable it unless the schema ownership model changes.
- **Version bump commits carry `[skip ci]`** — this is intentional. The release workflow dispatches the Docker builds explicitly at the tag ref, so the bump commit must not trigger a second set of builds.

---

## 19. Short Takeover Checklist

If you are the next maintainer, do this first:

1. Run `docker compose -f compose.dev.yml up --build`
2. Verify frontend loads at `http://localhost:3000`
3. Open Sync Jobs and confirm scheduled/manual jobs appear
4. Read `worker/worker.py` to understand scheduler timing and trigger sources
5. Read `db/init.sql` before making any schema change
6. Decide whether future schema changes should keep using init.sql or move to migrations
7. Review the [Releases page](https://github.com/Konstantinos-Mavridis/NavTrack/releases) and `CHANGELOG.md` to understand the current version history

---

## 20. File-by-File Reference

| File | Why it matters |
|---|---|
| `worker/worker.py` | All scheduled jobs: afternoon NAV sync (Mon–Fri 16:05) + evening NAV sync (Mon–Fri 22:05) + daily valuation (23:05) |
| `worker/VERSION` | Single-line version file; bumped by `release.yml` |
| `db/init.sql` | Entire schema and seed logic |
| `backend/src/sync/*` | Manual sync endpoints and DB audit logging |
| `backend/src/valuation/*` | On-demand portfolio valuation calculation |
| `backend/src/transactions/*` | Ledger operations and recalculation triggers |
| `frontend/src/pages/*` | User-facing screens |
| `compose.yml` | Production deployment wiring |
| `compose.dev.yml` | Local development wiring |
| `.github/workflows/release.yml` | Release automation: version bump, tag, GitHub Release, Docker dispatch |
| `CHANGELOG.md` | Human-maintained release history |

---

## 21. Final Summary

NavTrack is already a coherent, working single-user portfolio tracker with:
- strong CRUD coverage
- scheduled + manual NAV sync
- import/export support
- allocation templates
- automatic ledger-driven positions
- simple Docker-based deployment
- SemVer versioning with automated release workflow

The biggest long-term technical risks are:
- schema evolution without migrations
- external Yahoo data reliability
- lack of persisted valuation history
- absence of auth if deployed outside a private environment

Those are the main axes to keep in mind for future work.
