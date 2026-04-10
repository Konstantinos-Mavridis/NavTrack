-- ============================================================
-- NavTrack – Database Schema & Seed Data
-- ============================================================

-- ─────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────

CREATE TYPE nav_source AS ENUM ('MANUAL', 'FT', 'EUROBANK', 'YAHOO', 'OTHER');
CREATE TYPE transaction_type AS ENUM ('BUY', 'SELL', 'SWITCH', 'DIVIDEND_REINVEST');
CREATE TYPE sync_status AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');
CREATE TYPE asset_class AS ENUM (
  'GREEK_EQUITY',
  'GLOBAL_EQUITY',
  'GREEK_GOV_BOND',
  'GREEK_CORP_BOND',
  'GLOBAL_BOND',
  'HIGH_YIELD',
  'FUND_OF_FUNDS',
  'ABSOLUTE_RETURN',
  'RESERVE_MONEY_MARKET'
);

-- ─────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────

CREATE TABLE instruments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  isin           CHAR(12)    NOT NULL,
  currency       CHAR(3)     NOT NULL DEFAULT 'EUR',
  asset_class    asset_class NOT NULL,
  risk_level     SMALLINT    NOT NULL CHECK (risk_level BETWEEN 1 AND 7),
  data_sources   TEXT[]      NOT NULL DEFAULT '{}',
  external_ids   JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT instruments_isin_unique UNIQUE (isin)
);

CREATE TABLE portfolios (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT  NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE allocation_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE allocation_template_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES allocation_templates(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  weight        NUMERIC(9,4) NOT NULL CHECK (weight > 0),
  CONSTRAINT allocation_template_items_unique UNIQUE (template_id, instrument_id)
);

CREATE TABLE portfolio_positions (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id        UUID    NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  instrument_id       UUID    NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  units               NUMERIC(18,6) NOT NULL DEFAULT 0,
  cost_basis_per_unit NUMERIC(18,6),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portfolio_positions_unique UNIQUE (portfolio_id, instrument_id)
);

CREATE TABLE transactions (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id     UUID             NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  instrument_id    UUID             NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  type             transaction_type NOT NULL,
  trade_date       DATE             NOT NULL,
  settlement_date  DATE,
  units            NUMERIC(18,6)    NOT NULL,
  price_per_unit   NUMERIC(18,6)    NOT NULL,
  fees             NUMERIC(18,6)    NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE TABLE nav_prices (
  id            UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID       NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  date          DATE       NOT NULL,
  nav           NUMERIC(18,6) NOT NULL,
  source        nav_source NOT NULL DEFAULT 'MANUAL',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nav_prices_instrument_date_unique UNIQUE (instrument_id, date)
);

CREATE TABLE sync_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id    UUID        REFERENCES instruments(id) ON DELETE CASCADE,
  status           sync_status NOT NULL DEFAULT 'PENDING',
  source           TEXT        NOT NULL DEFAULT 'YAHOO',
  from_date        DATE,
  to_date          DATE,
  records_fetched  INT         NOT NULL DEFAULT 0,
  records_upserted INT         NOT NULL DEFAULT 0,
  error_message    TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  triggered_by     TEXT        NOT NULL DEFAULT 'API'
);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────

CREATE INDEX idx_instruments_isin          ON instruments(isin);
CREATE INDEX idx_allocation_templates_code ON allocation_templates(code);
CREATE INDEX idx_template_items_template   ON allocation_template_items(template_id);
CREATE INDEX idx_template_items_instrument ON allocation_template_items(instrument_id);
CREATE INDEX idx_nav_prices_instrument     ON nav_prices(instrument_id, date DESC);
CREATE INDEX idx_portfolio_positions_pid   ON portfolio_positions(portfolio_id);
CREATE INDEX idx_transactions_pid          ON transactions(portfolio_id, trade_date DESC);
CREATE INDEX idx_transactions_iid          ON transactions(instrument_id);
CREATE INDEX idx_sync_jobs_instrument      ON sync_jobs(instrument_id, started_at DESC);
CREATE INDEX idx_sync_jobs_started_at      ON sync_jobs(started_at DESC);

-- ─────────────────────────────────────────────
-- updated_at TRIGGER
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_instruments_updated_at
  BEFORE UPDATE ON instruments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_allocation_templates_updated_at
  BEFORE UPDATE ON allocation_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_positions_updated_at
  BEFORE UPDATE ON portfolio_positions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- SEED: INSTRUMENTS
-- ─────────────────────────────────────────────

INSERT INTO instruments (name, isin, asset_class, risk_level, data_sources) VALUES
  (
    'Eurobank (LF) Equity – Greek Equities Fund',
    'LU0273962166',
    'GREEK_EQUITY',
    6,
    ARRAY[
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0273962166:EUR',
      'https://www.eurobankam.lu/funds/greek-equities'
    ]
  ),
  (
    'Eurobank (LF) Greek Corporate Bond Fund',
    'LU0939092168',
    'GREEK_CORP_BOND',
    4,
    ARRAY[
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0939092168:EUR'
    ]
  ),
  (
    'Eurobank (LF) Greek Government Bond Fund',
    'LU0420076928',
    'GREEK_GOV_BOND',
    4,
    ARRAY[
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0420076928:EUR'
    ]
  ),
  (
    'Eurobank (LF) Reserve Fund',
    'LU0670223279',
    'RESERVE_MONEY_MARKET',
    1,
    ARRAY[
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0670223279:EUR'
    ]
  ),
  (
    '(LF) High Yield A List Fund Eurobank Cap',
    'LU2047494005',
    'HIGH_YIELD',
    4,
    ARRAY[
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU2047494005:EUR'
    ]
  ),
  (
    'Eurobank (LF) Absolute Return Fund EUR',
    'LU0273968015',
    'ABSOLUTE_RETURN',
    3,
    ARRAY[
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0273968015:EUR'
    ]
  ),
  (
    'Eurobank (LF) Equity – Global Equities Fund',
    'LU0273960111',
    'GLOBAL_EQUITY',
    6,
    ARRAY[
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0273960111:EUR'
    ]
  ),
  (
    'Eurobank (LF) Fund of Funds – Equity Blend',
    'LU0272937516',
    'FUND_OF_FUNDS',
    5,
    ARRAY[
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0272937516:EUR'
    ]
  ),
  (
    'Eurobank (LF) Fund of Funds – Global Emerging Markets',
    'LU0316846335',
    'FUND_OF_FUNDS',
    6,
    ARRAY[
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0316846335:EUR'
    ]
  ),
  (
    'Eurobank (LF) Fund of Funds – Next Gen Focus',
    'LU0517847660',
    'FUND_OF_FUNDS',
    5,
    ARRAY[
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0517847660:EUR'
    ]
  ),
  (
    'Eurobank (LF) Global Bond',
    'LU0730413092',
    'GLOBAL_BOND',
    3,
    ARRAY[
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0730413092:EUR'
    ]
  );

-- ─────────────────────────────────────────────
-- SEED: PORTFOLIOS
-- ─────────────────────────────────────────────

INSERT INTO portfolios (id, name, description) VALUES
  (
    gen_random_uuid(),
    'Flexible Greek',
    'A flexible portfolio focused on Greek equity and bond markets, with a liquidity sleeve via the Reserve Fund.'
  ),
  (
    gen_random_uuid(),
    'Moderate',
    'A diversified moderate-risk portfolio blending Greek and global equities, bonds, high yield, absolute return, and fund-of-funds strategies.'
  );

-- ─────────────────────────────────────────────
-- SEED: POSITIONS (via DO block so we can use ISINs)
-- ─────────────────────────────────────────────

DO $$
DECLARE
  pid_fg UUID;
  pid_md UUID;
BEGIN
  SELECT id INTO pid_fg FROM portfolios WHERE name = 'Flexible Greek';
  SELECT id INTO pid_md FROM portfolios WHERE name = 'Moderate';

  -- Flexible Greek positions
  INSERT INTO portfolio_positions (portfolio_id, instrument_id, units, cost_basis_per_unit)
  SELECT pid_fg, id, units, cost
  FROM (VALUES
    ('LU0273962166', 1250.00,  8.20),
    ('LU0939092168',  800.00, 10.50),
    ('LU0420076928',  600.00, 11.00),
    ('LU0670223279', 2000.00,  5.05)
  ) AS t(isin, units, cost)
  JOIN instruments i ON i.isin = t.isin;

  -- Moderate positions
  INSERT INTO portfolio_positions (portfolio_id, instrument_id, units, cost_basis_per_unit)
  SELECT pid_md, id, units, cost
  FROM (VALUES
    ('LU2047494005',  500.00,  9.80),
    ('LU0273968015',  750.00, 12.30),
    ('LU0273960111',  400.00, 15.60),
    ('LU0273962166',  300.00,  8.20),
    ('LU0272937516',  600.00,  7.90),
    ('LU0316846335',  450.00,  6.50),
    ('LU0517847660',  350.00,  8.10),
    ('LU0730413092', 1000.00, 10.20),
    ('LU0670223279',  800.00,  5.05)
  ) AS t(isin, units, cost)
  JOIN instruments i ON i.isin = t.isin;
END;
$$;
