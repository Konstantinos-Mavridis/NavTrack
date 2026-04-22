# NavTrack

A self-hosted mutual fund portfolio tracker built around **Eurobank's fund range**.
Record transactions, monitor NAV prices, and get instant P&L valuations — all in a single Docker Compose stack.

**Stack:** NestJS 11 · React 19 · PostgreSQL 18 · Python 3.14 worker · Docker Compose

> **New to this repo?** Read [Quick Start](#quick-start) to be up and running in 5 minutes, then skim [Architecture](#architecture) and [Frontend Pages](#frontend-pages) to understand what you're looking at. For a full handover brief, see [HANDOVER.md](./HANDOVER.md).

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Services](#services)
- [Environment Variables](#environment-variables)
- [Frontend Pages](#frontend-pages)
- [NAV Sync](#nav-sync)
- [API Reference](#api-reference)
- [Example curl Calls](#example-curl-calls)
- [Database Schema](#database-schema)
- [Seed Data](#seed-data)
- [Import & Export](#import--export)
- [Allocation Templates](#allocation-templates)
- [CI/CD Workflows](#cicd-workflows)
- [Versioning & Releases](#versioning--releases)
- [Extending the App](#extending-the-app)
- [Production Notes](#production-notes)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [Security](#security)

---

## Quick Start

There are two compose files:

| File | Purpose |
|---|---|
| `compose.dev.yml` | **Local development** — builds images from source |
| `compose.yml` | **Production / deploy** — pulls pre-built images from GHCR |

### Dev (build from source)

```bash
# 1. Clone and enter the repo
git clone <repo-url> navtrack
cd navtrack

# 2. Create your .env from the example
cp .env.example .env

# 3. Build and start all services
docker compose -f compose.dev.yml up --build

# 4. Open the app
open http://localhost:3000
```

### Production (pull pre-built images)

```bash
cp .env.example .env
# Edit .env if needed (passwords, ports, registry namespace)
docker compose pull            # pulls from GHCR
docker compose up -d
```

First boot takes **2–3 minutes** (npm/pip installs inside containers on dev build).
Subsequent starts without `--build` take ~15 seconds.

### Default Access

| Service | URL / Value |
|---|---|
| Frontend (UI) | http://localhost:3000 |
| Backend API (via frontend proxy) | http://localhost:3000/api |
| PostgreSQL (internal Docker network) | `db:5432` — db: `navtrack_db`, user: `navtrack_user` |

> **Note:** PostgreSQL is not exposed to the host by default. The `db` service is only reachable inside the Docker network. If you need direct access (e.g. for a DB client), add `ports: ["5432:5432"]` under the `db` service in `compose.dev.yml` for local development only — remove it before any networked deployment.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Host machine                                               │
│                                                             │
│  Browser ──► :3000 ──────────────────────────────────────┐  │
│                                                          │  │
│  ┌─────────────── app-network ────────────────────────┐  │  │
│  │                                                    │  │  │
│  │  ┌──────────────────┐    ┌───────────────────┐     │  │  │
│  │  │   frontend       │    │   backend (API)   │     │  │  │
│  │  │   nginx :8080    │──▶ │   NestJS :8080    │     │  │  │
│  │  │   React SPA      │    │   TypeORM         │     │  │  │
│  │  └──────────────────┘    └─────────┬─────────┘     │  │  │
│  │                                    │               │  │  │
│  │  ┌──────────────────┐              │               │  │  │
│  │  │   worker         │              │               │  │  │
│  │  │   Python 3.14    │──────────────┤               │  │  │
│  │  │   APScheduler    │              │               │  │  │
│  │  └──────────────────┘              ▼               │  │  │
│  │                          ┌─────────────────┐       │  │  │
│  │                          │   db            │       │  │  │
│  │                          │   PostgreSQL 18 │       │  │  │
│  │                          │   (db-data vol) │       │  │  │
│  │                          └─────────────────┘       │  │  │
│  └────────────────────────────────────────────────────┘  │  │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

1. Browser → `nginx :8080` → serves `index.html` + React SPA assets
2. React → `nginx /api/*` → proxied to `backend :8080/api/*`
3. NestJS queries PostgreSQL via TypeORM
4. Response returns through the same chain

The nginx reverse-proxy means the browser always talks to a single origin (`:3000`), eliminating CORS issues in both development and production.

---

## Services

### `db` — PostgreSQL 18 (Alpine)

- Mounts `./db/init.sql` as an init script: runs **once** on a fresh volume to create the full schema, seed instruments, portfolios, positions, and ~30 days of synthetic NAV data.
- Data persists in the named Docker volume `${POSTGRES_DB}_data` (defaults to `navtrack_db_data`).
- The service is internal-only — it is not exposed to the host by default.

### `backend` — NestJS 11 / TypeScript

| Module | Responsibility |
|---|---|
| `InstrumentsModule` | CRUD for funds/instruments; NAV price bulk-upsert; import/export |
| `PortfoliosModule` | CRUD for portfolios; positions recalculation from ledger; import/export |
| `TransactionsModule` | Record & manage BUY / SELL / SWITCH / DIVIDEND_REINVEST |
| `TemplatesModule` | Allocation templates for bulk BUY transactions; import/export |
| `NavPricesModule` | Time-series NAV storage |
| `ValuationModule` | On-demand P&L valuation at any historical date |
| `SyncModule` | Yahoo Finance NAV sync — powers the **Force Refresh NAV** and **Sync All NAV** UI buttons; writes per-instrument results to `sync_jobs` |

TypeORM is configured with `synchronize: false` — the schema is owned by `db/init.sql`, not the ORM.

### `frontend` — React 19 / Vite / Tailwind CSS

Multi-stage Docker build: Vite compiles to static files, nginx serves them. `VITE_API_BASE_URL` defaults to `/api` so nginx's proxy handles routing transparently.

### `worker` — Python 3.14 / APScheduler

The worker connects directly to PostgreSQL (not through the backend API) for its valuation job, but calls `yfinance` for NAV sync and writes results to the `sync_jobs` table.

**On startup:**
1. Waits for Postgres and verifies the schema is initialised (polls for the `portfolios` table).
2. Validates seed data counts.
3. Runs an immediate full-portfolio valuation pass (logs to stdout).
4. If `SYNC_ON_STARTUP=true`, runs a full incremental NAV sync before starting the scheduler.

**Scheduled jobs:**

| Job | Schedule | What it does |
|---|---|---|
| Afternoon NAV sync | Mon–Fri at **16:05 Europe/Athens** | Early incremental Yahoo Finance sync for funds that publish NAVs by mid-afternoon |
| Evening NAV sync | Mon–Fri at **22:05 Europe/Athens** | Late safety-net sync; catches funds whose Yahoo candle isn't available until end-of-day UTC |
| Daily valuation | Every day at **23:05 Europe/Athens** | Computes and logs P&L for all portfolios (runs after both NAV syncs) |

---

## Environment Variables

Copy `.env.example` → `.env` and adjust as needed.

| Variable | Default | Description |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | `navtrack` | Names Docker volumes (`${POSTGRES_DB}_data`) and networks (`${COMPOSE_PROJECT_NAME}_net`). Change when forking or renaming the project. |
| `CONTAINER_REGISTRY_NAMESPACE` | `konstantinos-mavridis` | GitHub Container Registry namespace used in `compose.yml` image URIs (`ghcr.io/${CONTAINER_REGISTRY_NAMESPACE}/${COMPOSE_PROJECT_NAME}-*:latest`). Override when pulling from a fork. |
| `POSTGRES_DB` | `navtrack_db` | Database name |
| `POSTGRES_USER` | `navtrack_user` | Database user |
| `POSTGRES_PASSWORD` | `navtrack_pass` | Database password — **change before any deployment** |
| `BACKEND_PORT` | `8080` | Backend listen port inside the Docker network (`backend:8080`) |
| `FRONTEND_PORT` | `3000` | Host port for the nginx frontend |
| `SYNC_ON_STARTUP` | `true` | Set to `false` to skip the incremental NAV sync on worker container start. The default `true` keeps the DB up-to-date immediately after a restart; set to `false` if you want to avoid hitting Yahoo Finance rate limits on every boot. |

> `VITE_API_BASE_URL` is a Docker build-time argument baked into the frontend image at build time, not a runtime env var. The default `/api` works correctly with the nginx proxy and should only be changed if you are deploying the frontend to a path where the backend is on a different host or sub-path.

---

## Frontend Pages

### Portfolio List (`/`)
- Cards for each portfolio showing total value, unrealised P&L, return %, and a mini weighted allocation bar by asset class.
- Valuations load in parallel after the initial portfolio list fetch.
- Create new portfolios from the header.

### Portfolio Detail (`/portfolios/:id`)
- **Summary stat cards** — total value, total cost, unrealised P&L, return %.
- **Date picker** — recompute the entire valuation at any historical date.
- **Allocation charts** — two pie charts: by asset class and by instrument.
- **Positions tab** — table sorted by value; shows asset-class chip, units, NAV, value, cost, P&L, and portfolio weight per position. A "View →" link on hover navigates to the instrument detail page.
- **Transactions tab** — full ledger with type badges (BUY / SELL / SWITCH / DIVIDEND_REINVEST); inline edit and delete per row; "+ Add Transaction", "+ Buy Template", and "Clear All" actions in the tab header.
- **Import / Export** — button at the bottom of the Transactions tab to import or export the full portfolio (transactions + positions) as JSON or CSV.
- Positions **recalculate automatically** after every transaction mutation — no manual step needed.

### Instrument List (`/instruments`)
- Searchable table by name, ISIN, or asset class.
- Risk level badges (1–7) and coloured asset-class chips.
- Buttons to add instruments manually, import in bulk, or force-refresh all NAVs.

### Templates (`/instruments`)
- Create reusable allocation templates (e.g. "Balanced 60/40").
- Each template stores target % weights across selected instruments.
- Apply from a portfolio to generate many BUY transactions in one click.
- Export / import templates as JSON or CSV.

### Instrument Detail (`/instruments/:id`)
- Editable instrument form (name, ISIN, asset class, ticker, risk level).
- **NAV History** section showing a full dated table of prices.
- Add a NAV manually or bulk import JSON/CSV.
- "Force Refresh NAV" button triggers Yahoo sync for that single instrument.

### Sync Jobs (API only)
- Audit log of every NAV sync run (manual, worker schedule, or startup sync).
- Row-level status: `PENDING` / `RUNNING` / `SUCCESS` / `PARTIAL` / `FAILED`.
- Stores trigger source, instrument, counts, and error text if applicable.

> **Note:** Sync jobs are fully accessible via the REST API (see [API Reference](#api-reference)) but do not have dedicated frontend pages.

---

## NAV Sync

The app stores one `yahoo_ticker` per instrument and syncs via [`yfinance`](https://pypi.org/project/yfinance/).

### Trigger Sources

| Trigger | Source |
|---|---|
| `API` | POST `/api/instruments/:id/sync` |
| `API_ALL` | POST `/api/sync/all` |
| `API_ALL_FORCE` | POST `/api/sync/all?overwrite=true` |
| `WORKER_STARTUP` | Worker container boot when `SYNC_ON_STARTUP=true` |
| `SCHEDULER_AFTERNOON` | Worker weekday 16:05 run |
| `SCHEDULER_EVENING` | Worker weekday 22:05 run |

### Sync Algorithm (per instrument)

1. Resolve `yahoo_ticker` if not already cached.
2. Query the DB for `MAX(nav_prices.date)` for that instrument.
3. Set `from_date = max_date + 1 day` (or bootstrap from a historical window if empty).
4. Call Yahoo Finance for history since `from_date`.
5. Upsert each daily close into `nav_prices`.
6. Insert one row into `sync_jobs` capturing status / counts / errors.
7. Sleep ~3 seconds before the next instrument to reduce the chance of 429 rate-limit errors.

The sync is **idempotent** — rerunning it does not create duplicate NAV rows because the DB enforces `UNIQUE (instrument_id, date)` and the backend / worker both use upsert semantics.

### Why multiple schedules?

Greek mutual-fund NAVs often appear late and Yahoo's batch ingest can lag even further. The worker therefore runs:
- **16:05 Mon–Fri** — catches funds published by mid-afternoon Athens time.
- **22:05 Mon–Fri** — a late safety-net after Yahoo's end-of-day UTC batch.

---

## API Reference

All backend routes are under `/api`.

### Portfolios

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/portfolios` | List portfolios |
| `POST` | `/api/portfolios` | Create portfolio |
| `GET` | `/api/portfolios/:id` | Portfolio detail |
| `PUT` | `/api/portfolios/:id` | Update portfolio |
| `DELETE` | `/api/portfolios/:id` | Delete portfolio |
| `GET` | `/api/portfolios/:id/valuation?date=YYYY-MM-DD` | On-demand valuation as of date |
| `GET` | `/api/portfolios/aggregate/valuation-series` | Aggregate valuation time series across portfolios |
| `GET` | `/api/portfolios/export/json` | Export all portfolios as JSON |
| `GET` | `/api/portfolios/export/csv` | Export all portfolios as CSV |
| `POST` | `/api/portfolios/import/json` | Import portfolios from JSON |
| `POST` | `/api/portfolios/import/csv` | Import portfolios from CSV |

### Positions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/portfolios/:id/positions` | List positions for a portfolio |
| `POST` | `/api/portfolios/:id/positions` | Upsert a position |
| `DELETE` | `/api/portfolios/:id/positions/:positionId` | Delete a single position |
| `DELETE` | `/api/portfolios/:id/positions` | Clear all positions |
| `POST` | `/api/portfolios/:id/positions/recalculate` | Force ledger → positions rebuild |

### Transactions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/portfolios/:id/transactions` | List portfolio transactions |
| `POST` | `/api/portfolios/:id/transactions` | Add transaction |
| `PUT` | `/api/portfolios/:id/transactions/:txnId` | Update transaction |
| `DELETE` | `/api/portfolios/:id/transactions/:txnId` | Delete transaction |
| `DELETE` | `/api/portfolios/:id/transactions` | Clear all transactions in a portfolio |
| `POST` | `/api/portfolios/:id/transactions/apply-template` | Generate BUY transactions from a template |

### Instruments

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/instruments` | List / search instruments |
| `POST` | `/api/instruments` | Create instrument |
| `GET` | `/api/instruments/:id` | Instrument detail |
| `PUT` | `/api/instruments/:id` | Update instrument |
| `DELETE` | `/api/instruments/:id` | Delete instrument |
| `GET` | `/api/instruments/export/json` | Export all instruments as JSON |
| `GET` | `/api/instruments/export/csv` | Export all instruments as CSV |
| `POST` | `/api/instruments/import/json` | Import instruments from JSON |
| `POST` | `/api/instruments/import/csv` | Import instruments from CSV |

### NAV Prices

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/instruments/:id/nav` | List NAV history for one instrument |
| `POST` | `/api/instruments/:id/nav` | Bulk upsert NAV entries |
| `GET` | `/api/instruments/:id/nav/on-date?date=YYYY-MM-DD` | Latest NAV on or before a specific date |

### Templates

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/templates` | List templates |
| `POST` | `/api/templates` | Create template |
| `GET` | `/api/templates/:id` | Template detail |
| `PUT` | `/api/templates/:id` | Update template |
| `DELETE` | `/api/templates/:id` | Delete template |
| `GET` | `/api/templates/:id/nav-preview` | NAV preview for template instruments |
| `GET` | `/api/templates/:id/nav-series?days=N` | NAV time series for template instruments |
| `GET` | `/api/templates/:id/nav-series/available-range` | Date range with NAV data for all template instruments |
| `GET` | `/api/templates/export/json` | Export all templates as JSON |
| `GET` | `/api/templates/export/csv` | Export all templates as CSV |
| `POST` | `/api/templates/import/json` | Import templates from JSON |
| `POST` | `/api/templates/import/csv` | Import templates from CSV |

### Sync

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/instruments/:id/sync` | Yahoo sync for one instrument |
| `POST` | `/api/sync/all` | Yahoo sync for all instruments |
| `GET` | `/api/sync/jobs` | List sync job audit rows |
| `GET` | `/api/sync/jobs/:jobId` | Get a specific sync job |
| `GET` | `/api/instruments/:id/sync/jobs` | List sync jobs for one instrument |

---

## Example curl Calls

### Create portfolio

```bash
curl -X POST http://localhost:3000/api/portfolios \
  -H 'Content-Type: application/json' \
  -d '{"name":"Retirement","description":"Long-term core holdings"}'
```

### Add BUY transaction

```bash
curl -X POST http://localhost:3000/api/portfolios/<portfolio-uuid>/transactions \
  -H 'Content-Type: application/json' \
  -d '{
    "instrumentId": "<instrument-uuid>",
    "type": "BUY",
    "tradeDate": "2026-04-15",
    "units": 10,
    "pricePerUnit": 12.34,
    "fees": 0
  }'
```

### Run full sync manually

```bash
curl -X POST http://localhost:3000/api/sync/all
```

### Export instruments as CSV

```bash
curl -L "http://localhost:3000/api/instruments/export/csv" -o instruments.csv
```

---

## Database Schema

Created by `db/init.sql` on first boot.

### Core tables

| Table | Purpose |
|---|---|
| `instruments` | Fund master data |
| `nav_prices` | Daily NAV time series per instrument |
| `portfolios` | User portfolio containers |
| `transactions` | Immutable ledger of BUY / SELL / SWITCH / DIVIDEND_REINVEST |
| `portfolio_positions` | Current holdings derived from transactions |
| `allocation_templates` | Template header |
| `allocation_template_items` | Template line items / target weights |
| `sync_jobs` | Audit rows for NAV sync runs |

### Important constraints

- `nav_prices`: `UNIQUE (instrument_id, date)`
- `allocation_template_items`: `UNIQUE (template_id, instrument_id)`
- `transactions.type`: constrained to the four supported transaction types
- `positions.units`: non-negative numeric
- `risk_level`: 1–7

---

## Seed Data

The init script seeds:
- Eurobank-oriented sample mutual funds
- Demo portfolios and positions
- Transactions ledger data
- Allocation templates
- Roughly 30 days of synthetic NAV history

This makes the app usable immediately after first boot, with no manual setup required.

---

## Import & Export

Supported formats:
- **JSON**
- **CSV**

Import/export is available for:
- Instruments
- Portfolios
- Templates
- NAV history (per instrument)

Duplicate imports are **skipped**, not overwritten. Existing rows remain untouched.

---

## Allocation Templates

Templates define target portfolio weights across instruments.

Typical flow:
1. Create template (e.g. "Balanced 60/40")
2. Add instrument weights summing to 100
3. Open a portfolio
4. Apply template with a total cash amount
5. Backend expands the template into many BUY transactions
6. Portfolio positions recalculate automatically

---

## CI/CD Workflows

GitHub Actions in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|---|---|---|
| `sonarqube.yml` | Push / PR to `main` | Static analysis via SonarQube |
| `codeql.yml` | Push / PR to `main`, weekly | Security analysis via CodeQL |
| `ci-gate.yml` | After SonarQube + CodeQL complete | Waits for both analyses to pass, then dispatches Docker builds for changed services |
| `docker-backend.yml` | `workflow_dispatch` / `workflow_call` | Builds and pushes `navtrack-backend` image to GHCR |
| `docker-frontend.yml` | `workflow_dispatch` / `workflow_call` | Builds and pushes `navtrack-frontend` image to GHCR |
| `docker-worker.yml` | `workflow_dispatch` / `workflow_call` | Builds and pushes `navtrack-worker` image to GHCR |
| `docker-all.yml` | `workflow_dispatch` | Manually rebuilds all three images at the latest release tag |
| `release.yml` | `workflow_dispatch` | Cuts a new release (see [Versioning & Releases](#versioning--releases)) |

### Docker image tags

Every image published to GHCR receives the following tags automatically via `docker/metadata-action`:

| Tag | Example | When present |
|---|---|---|
| Full SemVer | `1.2.3` | On a `vX.Y.Z` Git tag |
| Minor | `1.2` | On a `vX.Y.Z` Git tag |
| Major | `1` | On a `vX.Y.Z` Git tag |
| Short SHA | `sha-a1b2c3d` | Every build |
| Branch name | `main` | Every push to `main` |
| `latest` | `latest` | Every push to the default branch |

---

## Versioning & Releases

NavTrack uses a single **Semantic Versioning** (`vX.Y.Z`) tag shared across all three services (backend, frontend, worker). All Docker images are released together under the same tag.

### Version bump rules

| Change type | Version bump |
|---|---|
| Bug fixes, dependency updates, minor infrastructure changes | `PATCH` — e.g. `1.0.0` → `1.0.1` |
| New features, non-breaking API additions | `MINOR` — e.g. `1.0.0` → `1.1.0` |
| Breaking API changes, major DB migrations, architectural changes | `MAJOR` — e.g. `1.0.0` → `2.0.0` |

### Cutting a release

1. Go to **Actions → Release → Run workflow**.
2. Enter the new version (e.g. `1.1.0` — no leading `v`).
3. Optionally add release notes (Markdown supported).
4. Optionally tick **Mark as pre-release** for `rc` / `beta` builds.
5. Click **Run workflow**.

The workflow will:
- Validate the version is valid SemVer.
- Fail immediately if the tag already exists.
- Bump `version` in `backend/package.json`, `frontend/package.json`, `backend/package-lock.json`, `frontend/package-lock.json`, and `worker/VERSION`.
- Promote the `CHANGELOG.md` `[Unreleased]` section into a dated `## [X.Y.Z]` release section and reset `[Unreleased]`.
- Commit the bump to `main` with `[skip ci]` to avoid a redundant Docker build.
- Create and push an annotated Git tag `vX.Y.Z`.
- Create a **GitHub Release** visible on the [Releases page](https://github.com/Konstantinos-Mavridis/NavTrack/releases).
- Dispatch Docker builds for all three services at the new tag, producing images tagged `X.Y.Z`, `X.Y`, `X`, `sha-*`, and `latest`.

### Version files

| File | Service |
|---|---|
| `backend/package.json` → `version` | Backend |
| `backend/package-lock.json` → `version` | Backend |
| `frontend/package.json` → `version` | Frontend |
| `frontend/package-lock.json` → `version` | Frontend |
| `worker/VERSION` | Worker |

### Changelog

All notable changes are recorded in [`CHANGELOG.md`](./CHANGELOG.md) following the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Update the `[Unreleased]` section as you work; the release workflow now promotes `[Unreleased]` into the new version section when cutting a release.

---

## Extending the App

### Add a new scheduled worker job

Add new scheduled jobs in `worker/worker.py` using APScheduler's `scheduler.add_job()`. The `run_nav_sync()` and `run_valuation()` functions are good models. Always add a `max_instances=1, coalesce=True` guard to prevent job pile-up.

### Add a new transaction type

1. Extend the DB enum/check constraint in `db/init.sql`
2. Update backend DTO validation
3. Update the positions recalculation logic
4. Add frontend badge / forms / filtering support

### Add a new import format

JSON and CSV parsing currently live in the backend services/controllers. Follow the existing serializer pattern used by instruments/templates/portfolios imports.

---

## Production Notes

- Change all default DB passwords before any real deployment.
- Consider mounting persistent backups for the PostgreSQL volume.
- If you fork the repo and publish your own images, set `CONTAINER_REGISTRY_NAMESPACE` accordingly.
- Leaving `SYNC_ON_STARTUP=true` means every worker restart may trigger a Yahoo sync burst; set it to `false` if you prefer strictly scheduled/manual sync only.
- The frontend is served behind nginx, so TLS termination is best handled by a reverse proxy in front of the stack.
- Pin image versions in `compose.yml` to a specific `vX.Y.Z` tag (instead of `latest`) for reproducible production deployments.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) to learn about the development workflow, branch conventions, commit style, and how to open a pull request.

---

## Code of Conduct

This project follows the [Contributor Covenant v2.1](./CODE_OF_CONDUCT.md). By participating, you agree to uphold its standards. Incidents can be reported by contacting the [author via GitHub](https://github.com/Konstantinos-Mavridis).

---

## Security

If you discover a security vulnerability, please **do not open a public issue**. Review the [Security Policy](./SECURITY.md) for responsible disclosure instructions and contact details.



