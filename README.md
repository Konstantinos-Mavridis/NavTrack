# NavTrack

A full-stack mutual fund portfolio tracker for Eurobank funds (NavTrack), built with
NestJS · React · PostgreSQL · Docker Compose.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Services](#services)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Example curl Calls](#example-curl-calls)
- [Frontend Pages](#frontend-pages)
- [Database Schema](#database-schema)
- [Seed Data](#seed-data)
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

First boot takes ~2-3 minutes (npm/pip install inside containers).
On subsequent starts without `--build`, it takes ~15 seconds.

### Upgrade existing DB volume

If your Postgres volume was created before templates/import-export support,
run the migrations once against the running database:

```bash
docker compose exec -T db psql -U portfolio_user -d portfolio_db < db/migration_templates.sql
docker compose exec -T db psql -U portfolio_user -d portfolio_db < db/migration_precision_6.sql
```

### Default Credentials

| Service    | Value                                      |
|------------|--------------------------------------------|
| Postgres   | db=`portfolio_db` user=`portfolio_user` pass=`portfolio_pass` |
| Frontend   | http://localhost:3000                      |
| Backend    | http://localhost:8080/api                  |
| Postgres   | localhost:5432 (pgAdmin / DBeaver)         |

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

### Request flow for a browser page load

1. Browser → `nginx :80` → serves `index.html` + static assets (React SPA)
2. React SPA → `nginx /api/*` → proxied to `backend :8080/api/*`
3. NestJS queries PostgreSQL via TypeORM
4. JSON response returns through the same chain

The nginx proxy means the browser only ever talks to one origin (`:3000`),
eliminating CORS issues in development and keeping the same pattern in
production.

---

## Services

### `db` – PostgreSQL 16

- Mounts `./db/init.sql` as an init script: runs once on a fresh volume to
  create the schema, seed portfolios, instruments, and 30 days of synthetic
  NAV data.
- Data persists in the named volume `portfolio_tracker_db_data`.

### `backend` – NestJS 10 / TypeScript

| Module | Responsibility |
|---|---|
| `InstrumentsModule` | CRUD for funds/instruments |
| `PortfoliosModule` | CRUD for portfolios + positions |
| `TransactionsModule` | Record BUY/SELL/SWITCH/DIVIDEND_REINVEST |
| `NavPricesModule` | Time-series NAV storage (bulk upsert) |
| `ValuationModule` | On-demand portfolio valuation & analytics |

TypeORM is configured with `synchronize: false` — the database schema is
owned by `init.sql`, not by the ORM, so schema drift is impossible.

### `frontend` – React 18 / Vite / Tailwind

| Page | Route |
|---|---|
| Portfolio list | `/` |
| Portfolio detail | `/portfolios/:id` |
| Instrument list | `/instruments` |
| Instrument detail | `/instruments/:id` |

Multi-stage build: Vite compiles to static files, nginx serves them.
The `VITE_API_BASE_URL` build arg defaults to `/api` so nginx's proxy
handles routing transparently.

### `worker` – Python 3.12 / APScheduler

- Starts, waits for Postgres to be ready (retry loop), validates seed data.
- Runs an immediate full-portfolio valuation pass on startup.
- Schedules a daily valuation log at **18:30 Europe/Athens** (after European
  fund NAV publication cutoff).

---

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed.

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` | `portfolio_db` | Database name |
| `POSTGRES_USER` | `portfolio_user` | Database user |
| `POSTGRES_PASSWORD` | `portfolio_pass` | Database password |
| `POSTGRES_EXPOSE_PORT` | `5432` | Host port for direct DB access |
| `BACKEND_PORT` | `8080` | Host port for the NestJS API |
| `FRONTEND_PORT` | `3000` | Host port for the nginx frontend |

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
| `GET` | `/instruments/:id/nav` | NAV price history (ASC) |
| `POST` | `/instruments/:id/nav` | Bulk upsert NAV prices |

**POST /instruments body:**
```json
{
  "name": "Eurobank (LF) Equity – Greek Equities Fund",
  "isin": "LU0273962166",
  "assetClass": "GREEK_EQUITY",
  "riskLevel": 6,
  "dataSources": ["https://markets.ft.com/data/funds/tearsheet/summary?s=LU0273962166:EUR"]
}
```

Valid `assetClass` values: `GREEK_EQUITY`, `GLOBAL_EQUITY`, `GREEK_GOV_BOND`,
`GREEK_CORP_BOND`, `GLOBAL_BOND`, `HIGH_YIELD`, `FUND_OF_FUNDS`,
`ABSOLUTE_RETURN`, `RESERVE_MONEY_MARKET`

**POST /instruments/:id/nav body:**
```json
{
  "entries": [
    { "date": "2026-04-07", "nav": 9.1234 },
    { "date": "2026-04-08", "nav": 9.2011 }
  ]
}
```

Upsert semantics: re-posting an existing `(instrument_id, date)` pair updates
the NAV value rather than creating a duplicate.

---

### Portfolios

| Method | Path | Description |
|---|---|---|
| `GET` | `/portfolios` | List all portfolios |
| `GET` | `/portfolios/:id` | Get one portfolio |
| `POST` | `/portfolios` | Create portfolio |
| `PUT` | `/portfolios/:id` | Update portfolio |
| `DELETE` | `/portfolios/:id` | Delete portfolio |

---

### Positions

| Method | Path | Description |
|---|---|---|
| `GET` | `/portfolios/:id/positions` | List positions |
| `POST` | `/portfolios/:id/positions` | Add or update a position |
| `DELETE` | `/portfolios/:id/positions/:posId` | Remove a position |

**POST /portfolios/:id/positions body:**
```json
{
  "instrumentId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "units": 1250.5,
  "costBasisPerUnit": 8.20,
  "notes": "Initial purchase batch"
}
```

Upsert semantics: posting for an existing `(portfolio, instrument)` pair
updates `units`, `costBasisPerUnit`, and `notes` in place.

---

### Transactions

| Method | Path | Description |
|---|---|---|
| `GET` | `/portfolios/:id/transactions` | List transactions (newest first) |
| `POST` | `/portfolios/:id/transactions` | Record a transaction |

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
    "GREEK_GOV_BOND": 23.87,
    "GREEK_CORP_BOND": 18.11,
    "RESERVE_MONEY_MARKET": 18.70
  },
  "allocationByInstrument": {
    "instrument-uuid-1": 39.32,
    "instrument-uuid-2": 23.87
  }
}
```

The valuation endpoint uses the most recent NAV **on or before** the requested
date, so querying for a weekend or holiday returns the last business day's
prices automatically.

---

## Example curl Calls

```bash
# ── List portfolios ───────────────────────────────────────
curl http://localhost:8080/api/portfolios | jq .

# ── Get portfolio IDs ─────────────────────────────────────
PORTFOLIO_ID=$(curl -s http://localhost:8080/api/portfolios | jq -r '.[0].id')

# ── Get today's valuation ─────────────────────────────────
curl "http://localhost:8080/api/portfolios/$PORTFOLIO_ID/valuation" | jq .

# ── Get historical valuation ──────────────────────────────
curl "http://localhost:8080/api/portfolios/$PORTFOLIO_ID/valuation?date=2026-03-15" | jq .

# ── List all instruments ──────────────────────────────────
curl http://localhost:8080/api/instruments | jq '.[].isin'

# ── Get instrument ID by ISIN ─────────────────────────────
INST_ID=$(curl -s http://localhost:8080/api/instruments | jq -r '.[] | select(.isin=="LU0273962166") | .id')

# ── Add a single NAV point ────────────────────────────────
curl -X POST "http://localhost:8080/api/instruments/$INST_ID/nav" \
  -H "Content-Type: application/json" \
  -d '{"entries": [{"date": "2026-04-08", "nav": 9.1234}]}'

# ── Bulk-load NAV history ─────────────────────────────────
curl -X POST "http://localhost:8080/api/instruments/$INST_ID/nav" \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {"date": "2026-04-01", "nav": 8.9800},
      {"date": "2026-04-02", "nav": 9.0100},
      {"date": "2026-04-03", "nav": 9.0550},
      {"date": "2026-04-07", "nav": 9.1000},
      {"date": "2026-04-08", "nav": 9.1234}
    ]
  }'

# ── Record a BUY transaction ──────────────────────────────
curl -X POST "http://localhost:8080/api/portfolios/$PORTFOLIO_ID/transactions" \
  -H "Content-Type: application/json" \
  -d "{
    \"instrumentId\": \"$INST_ID\",
    \"type\": \"BUY\",
    \"tradeDate\": \"2026-04-08\",
    \"units\": 150,
    \"pricePerUnit\": 9.10,
    \"fees\": 5.00
  }"

# ── Update a position ────────────────────────────────────
curl -X POST "http://localhost:8080/api/portfolios/$PORTFOLIO_ID/positions" \
  -H "Content-Type: application/json" \
  -d "{
    \"instrumentId\": \"$INST_ID\",
    \"units\": 1400,
    \"costBasisPerUnit\": 8.32
  }"

# ── Create a new portfolio ────────────────────────────────
curl -X POST http://localhost:8080/api/portfolios \
  -H "Content-Type: application/json" \
  -d '{"name": "Aggressive Growth", "description": "High-equity exposure"}'
```

---

## Frontend Pages

### Portfolio List (`/`)
- Cards for each portfolio with total value, unrealised P&L, P&L %, and a
  mini weighted allocation bar.
- Valuations load in parallel after the portfolio list.

### Portfolio Detail (`/portfolios/:id`)
- Summary stat cards (value, cost, P&L, return %).
- Two allocation pie charts: by asset class and by instrument.
- Positions table sorted by value, with asset-class chips, NAV, P&L per
  position, and portfolio weight.
- Transactions tab with type badges (BUY/SELL/etc.).
- Date picker to recompute the entire valuation at any historical date.

### Instrument List (`/instruments`)
- Searchable table (name, ISIN, asset class) with risk badges and asset-class
  colour chips.

### Instrument Detail (`/instruments/:id`)
- Info cards (currency, class, risk, latest NAV).
- 30-day NAV line chart.
- Form to add a new NAV data point.
- Table of recent NAV prices with day-over-day change.
- Links to external data sources (FT, Eurobank AM).

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
  created_at / updated_at

portfolios
  id             UUID PK
  name           TEXT
  description    TEXT
  created_at / updated_at

portfolio_positions
  id                   UUID PK
  portfolio_id         UUID FK → portfolios
  instrument_id        UUID FK → instruments
  units                NUMERIC(18,6)
  cost_basis_per_unit  NUMERIC(18,6)
  notes                TEXT
  UNIQUE (portfolio_id, instrument_id)

transactions
  id               UUID PK
  portfolio_id     UUID FK → portfolios
  instrument_id    UUID FK → instruments
  type             ENUM (BUY|SELL|SWITCH|DIVIDEND_REINVEST)
  trade_date       DATE
  settlement_date  DATE
  units            NUMERIC(18,6)
  price_per_unit   NUMERIC(18,6)
  fees             NUMERIC(18,6)

nav_prices
  id             UUID PK
  instrument_id  UUID FK → instruments
  date           DATE
  nav            NUMERIC(18,6)
  source         ENUM (MANUAL|FT|EUROBANK|OTHER)
  UNIQUE (instrument_id, date)
```

All monetary columns use `NUMERIC(18,6)` to avoid floating-point rounding
errors. `ON DELETE CASCADE` ensures that deleting a portfolio cleans up
positions and transactions automatically.

---

## Seed Data

`db/init.sql` seeds on first boot (fresh volume):

- **11 Eurobank instruments** with ISINs, asset classes, and FT data-source URLs
- **2 portfolios**: *Flexible Greek* (4 positions) and *Moderate* (9 positions)
- **~30 business days** of synthetic NAV data per instrument (random walk,
  ±1.5% per day, seeded with realistic base NAVs)

To re-seed a clean DB:
```bash
docker-compose down -v          # removes the db-data volume
docker-compose up --build db    # recreates volume, runs init.sql
docker-compose up               # starts remaining services
```

---

## Extending the App

### Automated NAV fetching

Each instrument stores `data_sources` (array of URLs). The FT tearsheet URLs
are already populated for all seeded instruments. A future scraper would:

1. Add a scheduled job in `worker/worker.py` (e.g., weekdays at 19:00)
2. For each instrument, fetch the FT JSON endpoint derived from the ISIN
3. Parse the `nav` field from the response
4. POST to `/api/instruments/:id/nav` with `{ entries: [{ date, nav }] }`

The upsert semantics mean the job is safe to run multiple times.

### Adding authentication

The backend is stateless and easy to secure. Suggested approach:
1. Add `@nestjs/passport` + `passport-jwt`
2. Guard all write endpoints with `@UseGuards(JwtAuthGuard)`
3. Add a `POST /api/auth/login` endpoint returning a signed JWT
4. Pass the token in `Authorization: Bearer <token>` from the frontend

### Adding a reverse proxy (Traefik / external nginx)

The current setup serves the frontend on `:3000` and the backend on `:8080`.
To serve both under a single domain:
1. Add a `proxy` service in `docker-compose.yml` (nginx or Traefik)
2. Route `example.com/` → `frontend:80`
3. Route `example.com/api/` → `backend:8080/api/`
4. Remove the per-service `ports:` entries and keep only `expose:`

---

## Production Notes

| Concern | Recommendation |
|---|---|
| Secrets | Use Docker secrets or a vault — never commit `.env` |
| TLS | Terminate SSL at a load balancer or Traefik in front of nginx |
| DB backups | Mount a backup sidecar or use `pg_dump` on a cron |
| Scaling | Backend is stateless — run multiple replicas behind a load balancer |
| Schema migrations | Replace `init.sql` with Flyway or Liquibase for versioned migrations |
| Observability | Add Prometheus metrics endpoint (`@willsoto/nestjs-prometheus`) and ship logs to Loki |
