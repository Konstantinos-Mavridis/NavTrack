# NavTrack

A full-stack mutual fund portfolio tracker built for Eurobank funds.
Track holdings, record transactions, monitor NAV prices, and get instant
P&L valuations — all in a self-hosted Docker Compose stack.

**Stack:** NestJS · React 18 · PostgreSQL 16 · Python worker · Docker Compose

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Services](#services)
- [Environment Variables](#environment-variables)
- [Frontend Pages](#frontend-pages)
- [API Reference](#api-reference)
- [Example curl Calls](#example-curl-calls)
- [Database Schema](#database-schema)
- [Seed Data](#seed-data)
- [Import & Export](#import--export)
- [Allocation Templates](#allocation-templates)
- [Extending the App](#extending-the-app)
- [Production Notes](#production-notes)

---

## Quick Start

```bash
# 1. Clone and enter the repo
git clone <repo-url> navtrack
cd navtrack

# 2. Create your .env from the example
cp .env.example .env

# 3. Build and start all services
docker-compose up --build

# 4. Open the app
open http://localhost:3000
```

First boot takes **2–3 minutes** (npm/pip installs inside containers).
Subsequent starts without `--build` take ~15 seconds.

### Default Access

| Service | URL / Value |
|---|---|
| Frontend (UI) | http://localhost:3000 |
| Backend API | http://localhost:8080/api |
| PostgreSQL | localhost:5432 — db: `portfolio_db`, user: `portfolio_user`, pass: `portfolio_pass` |

### Upgrading an Existing Database Volume

If your volume pre-dates the templates / import-export / precision migrations,
run these once against the live database:

```bash
docker compose exec -T db psql -U portfolio_user -d portfolio_db < db/migration_templates.sql
docker compose exec -T db psql -U portfolio_user -d portfolio_db < db/migration_precision_6.sql
```

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
│  │  │   Python 3.12    │──────────────┤               │  │  │
│  │  │   APScheduler    │              │               │  │  │
│  │  └──────────────────┘              ▼               │  │  │
│  │                          ┌─────────────────┐       │  │  │
│  │                          │   db            │       │  │  │
│  │                          │   PostgreSQL 16 │       │  │  │
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

The nginx reverse-proxy means the browser always talks to a single origin
(`:3000`), eliminating CORS issues in both development and production.

---

## Services

### `db` — PostgreSQL 16

- Mounts `./db/init.sql` as an init script: runs **once** on a fresh volume
  to create the full schema, seed instruments, portfolios, positions, and
  ~30 days of synthetic NAV data.
- Data persists in the named Docker volume `portfolio_tracker_db_data`.

### `backend` — NestJS 10 / TypeScript

| Module | Responsibility |
|---|---|
| `InstrumentsModule` | CRUD for funds/instruments; NAV price bulk-upsert |
| `PortfoliosModule` | CRUD for portfolios; positions recalculation from ledger |
| `TransactionsModule` | Record & manage BUY / SELL / SWITCH / DIVIDEND_REINVEST |
| `TemplatesModule` | Allocation templates for bulk BUY transactions |
| `NavPricesModule` | Time-series NAV storage |
| `ValuationModule` | On-demand P&L valuation at any historical date |
| `SyncModule` | NAV sync trigger (used by the UI "Sync All" button) |

TypeORM is configured with `synchronize: false` — the schema is owned by
`init.sql` and migration files, not by the ORM.

### `frontend` — React 18 / Vite / Tailwind CSS

Multi-stage Docker build: Vite compiles to static files, nginx serves them.
`VITE_API_BASE_URL` defaults to `/api` so nginx's proxy handles routing
transparently.

### `worker` — Python 3.12 / APScheduler

- On startup: waits for Postgres, validates seed data, runs an immediate
  full-portfolio valuation pass.
- Schedules a daily valuation log at **18:30 Europe/Athens** (after European
  fund NAV publication cutoff).

---

## Environment Variables

Copy `.env.example` → `.env` and adjust as needed.

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` | `portfolio_db` | Database name |
| `POSTGRES_USER` | `portfolio_user` | Database user |
| `POSTGRES_PASSWORD` | `portfolio_pass` | Database password |
| `POSTGRES_EXPOSE_PORT` | `5432` | Host port for direct DB access |
| `BACKEND_PORT` | `8080` | Host port for the NestJS API |
| `FRONTEND_PORT` | `3000` | Host port for the nginx frontend |

---

## Frontend Pages

### Portfolio List (`/`)
- Cards for each portfolio showing total value, unrealised P&L, return %,
  and a mini weighted allocation bar by asset class.
- Valuations load in parallel after the initial portfolio list fetch.
- Create new portfolios from the header.

### Portfolio Detail (`/portfolios/:id`)
- **Summary stat cards** — total value, total cost, unrealised P&L, return %.
- **Date picker** — recompute the entire valuation at any historical date.
- **Allocation charts** — two pie charts: by asset class and by instrument.
- **Positions tab** — table sorted by value; shows asset-class chip, units,
  NAV, value, cost, P&L, and portfolio weight per position. A "View →" link
  on hover navigates to the instrument detail page.
- **Transactions tab** — full ledger with type badges (BUY / SELL / SWITCH /
  DIVIDEND_REINVEST); inline edit and delete per row; "+ Add Transaction",
  "+ Buy Template", and "Clear All" actions in the tab header.
- **Import / Export** — button at the bottom of the Transactions tab to
  import or export the full portfolio (transactions + positions) as JSON or CSV.
- Positions **recalculate automatically** after every transaction mutation
  (add, edit, delete, import, buy template, clear all) — no manual step needed.

### Instrument List (`/instruments`)
- Searchable table by name, ISIN, or asset class.
- Risk level badges (1–7) and coloured asset-class chips.
- **Import / Export** button at the bottom of the Instruments table for
  bulk JSON or CSV import/export.
- **Allocation Templates** section below the instruments table:
  - Create, edit, and delete named templates (e.g. "BALANCED_60_40").
  - Each template defines a set of ISINs with percentage weights.
  - Used from the Portfolio Detail page via "+ Buy Template" to execute
    a proportional bulk BUY across all funds in the template.
  - Import / Export button at the bottom of the Templates section.

### Instrument Detail (`/instruments/:id`)
- Info cards: currency, asset class, risk level, latest NAV.
- 30-day NAV line chart.
- Form to add a new NAV data point manually.
- Table of recent NAV prices with day-over-day change %.
- Links to external data sources (Financial Times, Eurobank AM).

---

## API Reference

All endpoints are prefixed with `/api`.

### Instruments

| Method | Path | Description |
|---|---|---|
| `GET` | `/instruments` | List all instruments |
| `GET` | `/instruments/:id` | Get one instrument |
| `POST` | `/instruments` | Create instrument |
| `PUT` | `/instruments/:id` | Update instrument |
| `DELETE` | `/instruments/:id` | Delete instrument |
| `POST` | `/instruments/sync-all` | Trigger NAV sync for all instruments |
| `GET` | `/instruments/:id/nav` | NAV price history (ASC) |
| `POST` | `/instruments/:id/nav` | Bulk upsert NAV prices |
| `GET` | `/instruments/export/json` | Export all instruments as JSON |
| `GET` | `/instruments/export/csv` | Export all instruments as CSV |
| `POST` | `/instruments/import/json` | Import instruments from JSON |
| `POST` | `/instruments/import/csv` | Import instruments from CSV |

**POST /instruments body:**
```json
{
  "name": "Eurobank (LF) Equity – Greek Equities Fund",
  "isin": "LU0273962166",
  "currency": "EUR",
  "assetClass": "GREEK_EQUITY",
  "riskLevel": 6,
  "dataSources": ["https://markets.ft.com/data/funds/tearsheet/summary?s=LU0273962166:EUR"]
}
```

Valid `assetClass` values:
`GREEK_EQUITY`, `GLOBAL_EQUITY`, `GREEK_GOV_BOND`, `GREEK_CORP_BOND`,
`GLOBAL_BOND`, `HIGH_YIELD`, `FUND_OF_FUNDS`, `ABSOLUTE_RETURN`,
`RESERVE_MONEY_MARKET`

**POST /instruments/:id/nav body:**
```json
{
  "entries": [
    { "date": "2026-04-07", "nav": 9.1234 },
    { "date": "2026-04-08", "nav": 9.2011 }
  ]
}
```

Upsert semantics: re-posting an existing `(instrument_id, date)` pair
updates the NAV value rather than creating a duplicate.

---

### Portfolios

| Method | Path | Description |
|---|---|---|
| `GET` | `/portfolios` | List all portfolios |
| `GET` | `/portfolios/:id` | Get one portfolio |
| `POST` | `/portfolios` | Create portfolio |
| `PUT` | `/portfolios/:id` | Update portfolio |
| `DELETE` | `/portfolios/:id` | Delete portfolio |
| `GET` | `/portfolios/export/json` | Export all portfolios + transactions as JSON |
| `GET` | `/portfolios/export/csv` | Export all portfolios + transactions as CSV |
| `POST` | `/portfolios/import/json` | Import portfolios + transactions from JSON |
| `POST` | `/portfolios/import/csv` | Import portfolios + transactions from CSV |

---

### Positions

| Method | Path | Description |
|---|---|---|
| `GET` | `/portfolios/:id/positions` | List positions |
| `POST` | `/portfolios/:id/positions` | Add or update a position (upsert) |
| `DELETE` | `/portfolios/:id/positions/:posId` | Remove a position |
| `POST` | `/portfolios/:id/positions/recalculate` | Recalculate positions from transaction ledger |

The **recalculate** endpoint replaces current positions with values derived
from the full transaction ledger (summed units, weighted average cost basis).
The frontend calls this automatically after every transaction mutation.

---

### Transactions

| Method | Path | Description |
|---|---|---|
| `GET` | `/portfolios/:id/transactions` | List transactions (newest first) |
| `POST` | `/portfolios/:id/transactions` | Record a transaction |
| `PUT` | `/portfolios/:id/transactions/:txId` | Update a transaction |
| `DELETE` | `/portfolios/:id/transactions/:txId` | Delete a transaction |
| `DELETE` | `/portfolios/:id/transactions` | Clear all transactions |

**POST /portfolios/:id/transactions body:**
```json
{
  "instrumentId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "type": "BUY",
  "tradeDate": "2026-04-07",
  "settlementDate": "2026-04-09",
  "units": 100,
  "pricePerUnit": 9.10,
  "fees": 5.00,
  "notes": "Monthly top-up"
}
```

Valid `type` values: `BUY`, `SELL`, `SWITCH`, `DIVIDEND_REINVEST`

---

### Allocation Templates

| Method | Path | Description |
|---|---|---|
| `GET` | `/templates` | List all templates |
| `POST` | `/templates` | Create a template |
| `PUT` | `/templates/:id` | Update a template |
| `DELETE` | `/templates/:id` | Delete a template |
| `POST` | `/templates/:id/apply` | Execute a bulk BUY from a template |
| `GET` | `/templates/export/json` | Export all templates as JSON |
| `GET` | `/templates/export/csv` | Export all templates as CSV |
| `POST` | `/templates/import/json` | Import templates from JSON |
| `POST` | `/templates/import/csv` | Import templates from CSV |

**POST /templates body:**
```json
{
  "code": "BALANCED_60_40",
  "description": "60% equity, 40% bonds",
  "items": [
    { "isin": "LU0273962166", "weight": 60.0 },
    { "isin": "GRF0000083591", "weight": 40.0 }
  ]
}
```

**POST /templates/:id/apply body:**
```json
{
  "portfolioId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "totalAmount": 10000.00,
  "tradeDate": "2026-04-08",
  "valuationDate": "2026-04-08"
}
```

The apply endpoint distributes `totalAmount` across each template item
proportionally by weight, looks up the latest NAV on or before `valuationDate`
for each instrument, computes units, and records a BUY transaction for each.

---

### Valuation

| Method | Path | Description |
|---|---|---|
| `GET` | `/portfolios/:id/valuation` | Compute valuation (today) |
| `GET` | `/portfolios/:id/valuation?date=YYYY-MM-DD` | Compute historical valuation |

**Response shape:**
```json
{
  "portfolioId": "...",
  "date": "2026-04-08",
  "totalValue": 28450.00,
  "totalCost": 26200.00,
  "unrealisedPnl": 2250.00,
  "unrealisedPnlPct": 8.59,
  "positions": [
    {
      "positionId": "...",
      "instrumentId": "...",
      "instrumentName": "Eurobank (LF) Equity – Greek Equities Fund",
      "isin": "LU0273962166",
      "assetClass": "GREEK_EQUITY",
      "units": 1250,
      "nav": 8.95,
      "value": 11187.50,
      "cost": 10250.00,
      "pnl": 937.50,
      "weightPct": 39.32
    }
  ],
  "allocationByAssetClass": {
    "GREEK_EQUITY": 39.32,
    "GREEK_GOV_BOND": 23.87
  }
}
```

The valuation endpoint uses the most recent NAV **on or before** the requested
date, so querying for a weekend or public holiday returns the last business
day's prices automatically.

---

## Example curl Calls

```bash
# List portfolios
curl http://localhost:8080/api/portfolios | jq .

# Get a portfolio ID
PORTFOLIO_ID=$(curl -s http://localhost:8080/api/portfolios | jq -r '.[0].id')

# Today's valuation
curl "http://localhost:8080/api/portfolios/$PORTFOLIO_ID/valuation" | jq .

# Historical valuation
curl "http://localhost:8080/api/portfolios/$PORTFOLIO_ID/valuation?date=2026-03-15" | jq .

# Get instrument ID by ISIN
INST_ID=$(curl -s http://localhost:8080/api/instruments \
  | jq -r '.[] | select(.isin=="LU0273962166") | .id')

# Bulk-load NAV history
curl -X POST "http://localhost:8080/api/instruments/$INST_ID/nav" \
  -H "Content-Type: application/json" \
  -d '{"entries":[{"date":"2026-04-07","nav":9.1000},{"date":"2026-04-08","nav":9.1234}]}'

# Record a BUY transaction
curl -X POST "http://localhost:8080/api/portfolios/$PORTFOLIO_ID/transactions" \
  -H "Content-Type: application/json" \
  -d "{\"instrumentId\":\"$INST_ID\",\"type\":\"BUY\",\"tradeDate\":\"2026-04-08\",\"units\":150,\"pricePerUnit\":9.10,\"fees\":5.00}"

# Recalculate positions from ledger
curl -X POST "http://localhost:8080/api/portfolios/$PORTFOLIO_ID/positions/recalculate"

# Create a new portfolio
curl -X POST http://localhost:8080/api/portfolios \
  -H "Content-Type: application/json" \
  -d '{"name":"Aggressive Growth","description":"High-equity exposure"}'
```

---

## Database Schema

```
instruments
  id             UUID PK
  name           TEXT
  isin           CHAR(12) UNIQUE
  currency       CHAR(3)
  asset_class    ENUM
  risk_level     SMALLINT (1–7)
  data_sources   TEXT[]
  external_ids   JSONB
  created_at / updated_at

portfolios
  id             UUID PK
  name           TEXT
  description    TEXT
  created_at / updated_at

portfolio_positions
  id                   UUID PK
  portfolio_id         UUID FK → portfolios  (CASCADE DELETE)
  instrument_id        UUID FK → instruments
  units                NUMERIC(18,6)
  cost_basis_per_unit  NUMERIC(18,6)
  notes                TEXT
  UNIQUE (portfolio_id, instrument_id)

transactions
  id               UUID PK
  portfolio_id     UUID FK → portfolios  (CASCADE DELETE)
  instrument_id    UUID FK → instruments
  type             ENUM (BUY|SELL|SWITCH|DIVIDEND_REINVEST)
  trade_date       DATE
  settlement_date  DATE
  units            NUMERIC(18,6)
  price_per_unit   NUMERIC(18,6)
  fees             NUMERIC(18,6)
  notes            TEXT

nav_prices
  id             UUID PK
  instrument_id  UUID FK → instruments  (CASCADE DELETE)
  date           DATE
  nav            NUMERIC(18,6)
  source         ENUM (MANUAL|FT|EUROBANK|OTHER)
  UNIQUE (instrument_id, date)

allocation_templates
  id          UUID PK
  code        TEXT UNIQUE
  description TEXT
  created_at / updated_at

allocation_template_items
  id          UUID PK
  template_id UUID FK → allocation_templates  (CASCADE DELETE)
  instrument_id UUID FK → instruments
  weight      NUMERIC(10,4)   -- percentage, e.g. 60.0000
```

All monetary columns use `NUMERIC(18,6)` to avoid floating-point rounding
errors. `ON DELETE CASCADE` ensures that deleting a portfolio automatically
cleans up its positions and transactions.

---

## Seed Data

`db/init.sql` runs once on a fresh Docker volume:

- **11 Eurobank instruments** with ISINs, asset classes, risk levels, and
  Financial Times data-source URLs
- **2 portfolios**: *Flexible Greek* (4 positions) and *Moderate* (9 positions)
- **~30 business days** of synthetic NAV data per instrument (random walk,
  ±1.5%/day, realistic base NAVs)

To start completely fresh:

```bash
docker-compose down -v        # destroys db-data volume
docker-compose up --build     # recreates everything from scratch
```

---

## Import & Export

Every major data type supports JSON and CSV import/export from the UI:

| Section | Location in UI | Formats |
|---|---|---|
| Instruments | Bottom of Instruments table | JSON, CSV |
| Allocation Templates | Bottom of Templates section | JSON, CSV |
| Portfolio transactions | Bottom of Transactions tab (Portfolio Detail) | JSON, CSV |

**Import behaviour:**
- Duplicate detection: instruments matched by ISIN, templates by code,
  transactions by a composite key — existing records are skipped, not
  overwritten.
- Missing ISINs in template imports are reported in the response.

**CSV column reference:**

| Type | Required columns |
|---|---|
| Instruments | `name, isin, currency, assetClass, riskLevel, dataSources, externalIds` |
| Templates | `code, description, isin, weight` (one row per fund per template) |
| Portfolio | `portfolioName, isin, type, tradeDate, units, pricePerUnit, fees` |

---

## Allocation Templates

Templates let you define a named set of funds with target percentage weights
and execute a proportional bulk BUY with a single click.

**Workflow:**
1. Go to **Instruments → Templates** section.
2. Click **+ New Template**, give it a code (e.g. `BALANCED_60_40`) and add
   fund/weight rows.
3. On any Portfolio Detail page, click **+ Buy Template** in the Transactions
   tab, pick the template, set a total EUR amount and trade date.
4. The backend distributes the amount by weight, looks up each fund's NAV,
   computes units, and records one BUY transaction per fund.
5. Positions update automatically — no further action needed.

**Weights do not need to sum to exactly 100** — amounts are distributed
proportionally based on each item's share of the total weight.

---

## Extending the App

### Automated NAV Fetching

All seeded instruments already have Financial Times tearsheet URLs in
`data_sources`. A future scraper would:

1. Add a scheduled job in `worker/worker.py` (e.g. weekdays at 19:00)
2. For each instrument, fetch the FT JSON endpoint derived from the ISIN
3. Parse the NAV field from the response
4. POST to `/api/instruments/:id/nav` with `{ entries: [{ date, nav }] }`

The upsert semantics make the job safe to run multiple times.

### Adding Authentication

The backend is stateless and straightforward to secure:

1. Add `@nestjs/passport` + `passport-jwt`
2. Guard all write endpoints with `@UseGuards(JwtAuthGuard)`
3. Add `POST /api/auth/login` returning a signed JWT
4. Pass the token in `Authorization: Bearer <token>` from the frontend

### Adding a Reverse Proxy

1. Add a `proxy` service in `docker-compose.yml` (nginx or Traefik)
2. Route `yourdomain.com/` → `frontend:80`
3. Route `yourdomain.com/api/` → `backend:8080/api/`
4. Remove per-service `ports:` entries, keep only `expose:`

---

## Production Notes

| Concern | Recommendation |
|---|---|
| Secrets | Use Docker secrets or a vault — never commit `.env` |
| TLS | Terminate SSL at a load balancer or Traefik in front of nginx |
| DB backups | `pg_dump` on a cron, or mount a backup sidecar |
| Scaling | Backend is stateless — run multiple replicas behind a load balancer |
| Schema migrations | Replace ad-hoc SQL files with Flyway or Liquibase |
| Observability | Add `@willsoto/nestjs-prometheus` and ship logs to Loki/Grafana |
