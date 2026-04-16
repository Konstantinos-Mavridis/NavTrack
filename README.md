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
- [Extending the App](#extending-the-app)
- [Production Notes](#production-notes)

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
│  Browser ──► :3000 ─────────────────────────────────────┐  │
│                                                          │  │
│  ┌─────────────── app-network ────────────────────────┐  │  │
│  │                                                    │  │  │
│  │  ┌──────────────────┐    ┌───────────────────┐    │  │  │
│  │  │   frontend       │    │   backend (API)   │    │  │  │
│  │  │   nginx :80      │───▶│   NestJS :8080    │    │  │  │
│  │  │   React SPA      │    │   TypeORM         │    │  │  │
│  │  └──────────────────┘    └─────────┬─────────┘    │  │  │
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

1. Browser → `nginx :80` → serves `index.html` + React SPA assets
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
| Afternoon NAV sync | Mon–Fri at **16:00 Europe/Athens** | Early incremental Yahoo Finance sync for funds that publish NAVs by mid-afternoon |
| Evening NAV sync | Mon–Fri at **22:00 Europe/Athens** | Late safety-net sync; catches funds whose Yahoo candle isn't available until end-of-day UTC |
| Daily valuation | Every day at **23:00 Europe/Athens** | Computes and logs P&L for all portfolios (runs after both NAV syncs) |
| Weekly NAV sync | Every **Monday at 07:00 Europe/Athens** | Incremental Yahoo Finance sync for all instruments |

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

### Instrument Detail (`/instruments/:id`)
- Editable instrument form (name, ISIN, asset class, ticker, risk level).
- **NAV History** section showing a full dated table of prices.
- Add a NAV manually or bulk import JSON/CSV.
- "Force Refresh NAV" button triggers Yahoo sync for that single instrument.

### Templates (`/templates`)
- Create reusable allocation templates (e.g. "Balanced 60/40").
- Each template stores target % weights across selected instruments.
- Apply from a portfolio to generate many BUY transactions in one click.
- Export / import templates as JSON or CSV.

### Sync Jobs (`/sync-jobs`)
- Audit log of every NAV sync run (manual, worker schedule, or startup sync).
- Row-level status: queued / success / error.
- Stores trigger source, instrument, counts, and error text if applicable.

---

## NAV Sync

The app stores one `yahoo_ticker` per instrument and syncs via [`yfinance`](https://pypi.org/project/yfinance/).

### Trigger Sources

| Trigger | Source |
|---|---|
| `MANUAL_SINGLE` | UI button on Instrument Detail |
| `MANUAL_ALL` | UI button on Instruments page |
| `WORKER_STARTUP` | Worker container boot when `SYNC_ON_STARTUP=true` |
| `SCHEDULER_AFTERNOON` | Worker weekday 16:00 run |
| `SCHEDULER_EVENING` | Worker weekday 22:00 run |
| `SCHEDULER_WEEKLY` | Worker Monday 07:00 run |

### Sync Algorithm (per instrument)

1. Resolve `yahoo_ticker` if not already cached.
2. Query the DB for `MAX(nav_prices.date)` for that instrument.
3. Set `from_date = max_date + 1 day` (or 30-day bootstrap if empty).
4. Call Yahoo Finance for history since `from_date`.
5. Upsert each daily close into `nav_prices`.
6. Insert one row into `sync_jobs` capturing status / counts / errors.
7. Sleep ~3 seconds before the next instrument to reduce the chance of 429 rate-limit errors.

The sync is **idempotent** — rerunning it does not create duplicate NAV rows because the DB enforces `UNIQUE (instrument_id, date)` and the backend / worker both use upsert semantics.

### Why multiple schedules?

Greek mutual-fund NAVs often appear late and Yahoo's batch ingest can lag even further. The worker therefore runs:
- **16:00 Mon–Fri** — catches funds published by mid-afternoon Athens time.
- **22:00 Mon–Fri** — a late safety-net after Yahoo's end-of-day UTC batch.
- **07:00 Monday** — a broad weekly backstop in case anything was missed.

---

## API Reference

All backend routes are under `/api`.

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |

### Portfolios

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/portfolios` | List portfolios |
| `POST` | `/api/portfolios` | Create portfolio |
| `GET` | `/api/portfolios/:id` | Portfolio detail |
| `PATCH` | `/api/portfolios/:id` | Edit portfolio |
| `DELETE` | `/api/portfolios/:id` | Delete portfolio |
| `GET` | `/api/portfolios/:id/valuation?date=YYYY-MM-DD` | On-demand valuation as of date |
| `GET` | `/api/portfolios/:id/export?format=json|csv` | Export one portfolio |
| `POST` | `/api/portfolios/import?format=json|csv` | Import one or many portfolios |
| `POST` | `/api/portfolios/:id/recalculate` | Force ledger → positions rebuild |

### Transactions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/transactions?portfolioId=:id` | List portfolio transactions |
| `POST` | `/api/transactions` | Add transaction |
| `PATCH` | `/api/transactions/:id` | Edit transaction |
| `DELETE` | `/api/transactions/:id` | Delete transaction |
| `DELETE` | `/api/transactions/by-portfolio/:portfolioId` | Clear all transactions in a portfolio |
| `POST` | `/api/transactions/buy-template` | Generate BUY transactions from a template |

### Instruments

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/instruments` | List / search instruments |
| `POST` | `/api/instruments` | Create instrument |
| `GET` | `/api/instruments/:id` | Instrument detail |
| `PATCH` | `/api/instruments/:id` | Edit instrument |
| `DELETE` | `/api/instruments/:id` | Delete instrument |
| `POST` | `/api/instruments/import?format=json|csv` | Bulk import instruments |
| `GET` | `/api/instruments/export?format=json|csv` | Export all instruments |

### NAV Prices

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/instruments/:id/nav-prices` | List NAV history for one instrument |
| `POST` | `/api/instruments/:id/nav-prices` | Upsert one NAV point |
| `POST` | `/api/instruments/:id/nav-prices/import?format=json|csv` | Bulk import NAV history |

### Templates

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/templates` | List templates |
| `POST` | `/api/templates` | Create template |
| `GET` | `/api/templates/:id` | Template detail |
| `PATCH` | `/api/templates/:id` | Edit template |
| `DELETE` | `/api/templates/:id` | Delete template |
| `POST` | `/api/templates/import?format=json|csv` | Import templates |
| `GET` | `/api/templates/export?format=json|csv` | Export templates |

### Sync

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sync/instrument/:id` | Yahoo sync for one instrument |
| `POST` | `/api/sync/all` | Yahoo sync for all instruments |
| `GET` | `/api/sync/jobs` | List sync job audit rows |

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
curl -X POST http://localhost:3000/api/transactions \
  -H 'Content-Type: application/json' \
  -d '{
    "portfolioId":1,
    "instrumentId":2,
    "type":"BUY",
    "date":"2026-04-15",
    "units":10,
    "pricePerUnit":12.34,
    "fees":0
  }'
```

### Run full sync manually

```bash
curl -X POST http://localhost:3000/api/sync/all
```

### Export instruments as CSV

```bash
curl -L "http://localhost:3000/api/instruments/export?format=csv" -o instruments.csv
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
| `positions` | Current holdings derived from transactions |
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

| Workflow | Purpose |
|---|---|
| `backend-ci.yml` | Lint/test backend |
| `frontend-ci.yml` | Lint/test frontend |
| `worker-ci.yml` | Lint/test worker |
| `docker-publish.yml` | Build and publish multi-service images to GHCR |

The production `compose.yml` consumes those published images.

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
