-- ============================================================
-- NavTrack – Database Schema & Seed Data
-- ============================================================

-- ─────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────

CREATE TYPE nav_source AS ENUM ('MANUAL', 'FT', 'EUROBANK', 'YAHOO', 'OTHER');
CREATE TYPE transaction_type AS ENUM ('BUY', 'SELL', 'SWITCH', 'DIVIDEND_REINVEST', 'FEE_CONSOLIDATION');
CREATE TYPE sync_status AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');
CREATE TYPE asset_class AS ENUM (
  'EQUITY',
  'BOND',
  'HIGH_YIELD',
  'FUND_OF_FUNDS',
  'ABSOLUTE_RETURN',
  'CRYPTO'
);

-- ─────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────

CREATE TABLE instruments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  isin           CHAR(12),
  ticker         TEXT,
  currency       CHAR(3)     NOT NULL DEFAULT 'EUR',
  asset_class    asset_class NOT NULL,
  risk_level     SMALLINT    NOT NULL CHECK (risk_level BETWEEN 1 AND 7),
  data_sources   TEXT[]      NOT NULL DEFAULT '{}',
  external_ids   JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT instruments_isin_unique UNIQUE (isin),
  CONSTRAINT instruments_ticker_unique UNIQUE (ticker),
  CONSTRAINT instruments_isin_or_ticker_required
    CHECK (isin IS NOT NULL OR ticker IS NOT NULL)
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
CREATE INDEX idx_instruments_ticker        ON instruments(ticker);
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

INSERT INTO instruments (name, isin, ticker, asset_class, risk_level, data_sources) VALUES
  (
    'Eurobank (LF) Equity – Greek Equities Fund',
    'LU0273962166',
    NULL,
    'EQUITY',
    4,
    ARRAY[
	  'https://www.eurobank.gr/el/retail/proionta-upiresies/proionta/ependuseis/amoibaia-kefalaia/amoibaia-kefalaia-lf-kai-lf-fof/eurobank-fund-management-company-luxembourg/equity-greek-equities',
	  'https://www.eurobankam.gr/en/pillarfunds/searchfund/lf-equity-greek-equities',
	  'https://www.eurobank.gr/-/media/eurobank/retail/proionta-kai-upiresies/proionta/ependuseis/amoibaia-kefalaia/pdf/eksoterikou/facts-sheets/190-lf-equity-greekequities-fs-gr.pdf',
	  'https://global.morningstar.com/en-eu/investments/funds/0P000094DP',
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0273962166:EUR'
    ]
  ),
  (
    'Eurobank (LF) Greek Corporate Bond Fund',
    'LU0939092168',
    NULL,
    'BOND',
    3,
    ARRAY[
	  'https://www.eurobank.gr/el/retail/proionta-upiresies/proionta/ependuseis/amoibaia-kefalaia/amoibaia-kefalaia-lf-kai-lf-fof/eurobank-fund-management-company-luxembourg/greek-corporate-bond-fund',
	  'https://www.eurobankam.gr/en/pillarfunds/searchfund/lf-greek-corporate-bond-fund',
	  'https://www.eurobank.gr/-/media/eurobank/retail/proionta-kai-upiresies/proionta/ependuseis/amoibaia-kefalaia/pdf/eksoterikou/facts-sheets/680-lf-grcorporatebond-fs-gr.pdf',
	  'https://global.morningstar.com/en-eu/investments/funds/0P0000Z5PK',
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0939092168:EUR'
    ]
  ),
  (
    'Eurobank (LF) Greek Government Bond Fund',
    'LU0420076928',
    NULL,
    'BOND',
    3,
    ARRAY[
	  'https://www.eurobank.gr/el/retail/proionta-upiresies/proionta/ependuseis/amoibaia-kefalaia/amoibaia-kefalaia-lf-kai-lf-fof/eurobank-fund-management-company-luxembourg/greek-government-bond-fund',
	  'https://www.eurobankam.gr/en/pillarfunds/searchfund/lf-greek-government-bond-fund',
	  'https://www.eurobank.gr/-/media/eurobank/retail/proionta-kai-upiresies/proionta/ependuseis/amoibaia-kefalaia/pdf/eksoterikou/facts-sheets/490-lf-grgovernmentbond-fs-gr.pdf',
	  'https://global.morningstar.com/en-eu/investments/funds/0P0000JRQU',
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0420076928:EUR'
    ]
  ),
  (
    'Eurobank (LF) Reserve Fund',
    'LU0670223279',
    NULL,
    'BOND',
    2,
    ARRAY[
	  'https://www.eurobank.gr/el/retail/proionta-upiresies/proionta/ependuseis/amoibaia-kefalaia/amoibaia-kefalaia-lf-kai-lf-fof/eurobank-fund-management-company-luxembourg/reserve-fund',
	  'https://www.eurobankam.gr/en/pillarfunds/searchfund/lf-reserve-fund',
	  'https://www.eurobank.gr/-/media/eurobank/retail/proionta-kai-upiresies/proionta/ependuseis/amoibaia-kefalaia/pdf/eksoterikou/facts-sheets/600-lf-reservefund-fs-gr.pdf',
	  'https://global.morningstar.com/en-eu/investments/funds/0P0000UI62',
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0670223279:EUR'
    ]
  ),
  (
    '(LF) High Yield A List Fund Eurobank Cap',
    'LU2047494005',
    NULL,
    'BOND',
    2,
    ARRAY[
	  'https://www.eurobank.gr/el/retail/proionta-upiresies/proionta/ependuseis/amoibaia-kefalaia/amoibaia-kefalaia-lf-kai-lf-fof/eurobank-fund-management-company-luxembourg/high-yield-a-list-fund',
	  'https://www.eurobankam.gr/en/pillarfunds/searchfund/lf-high-yield-a-list-fund',
	  'https://www.eurobank.gr/-/media/eurobank/retail/proionta-kai-upiresies/proionta/ependuseis/amoibaia-kefalaia/pdf/eksoterikou/facts-sheets/650-lf-highyield-fs-gr.pdf',
	  'https://global.morningstar.com/en-eu/investments/funds/0P0001JC7T',
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU2047494005:EUR'
    ]
  ),
  (
    'Eurobank (LF) Absolute Return Fund',
    'LU0285432364',
    NULL,
    'ABSOLUTE_RETURN',
    3,
    ARRAY[
	  'https://www.eurobank.gr/el/retail/proionta-upiresies/proionta/ependuseis/amoibaia-kefalaia/amoibaia-kefalaia-lf-kai-lf-fof/eurobank-fund-management-company-luxembourg/absolute-return-fund',
	  'https://www.eurobankam.gr/en/pillarfunds/searchfund/lf-absolute-return-fund',
	  'https://www.eurobank.gr/-/media/eurobank/retail/proionta-kai-upiresies/proionta/ependuseis/amoibaia-kefalaia/pdf/eksoterikou/facts-sheets/560-lf-absolutereturn-fs-gr.pdf',
	  'https://global.morningstar.com/en-eu/investments/funds/0P0000MPVB',
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0285432364:EUR'
    ]
  ),
  (
    'Eurobank (LF) Fund of Funds – Balanced Blend Fund',
    'LU0352743748',
    NULL,
    'FUND_OF_FUNDS',
    3,
    ARRAY[
	  'https://www.eurobank.gr/el/retail/proionta-upiresies/proionta/ependuseis/amoibaia-kefalaia/amoibaia-kefalaia-lf-kai-lf-fof/eurobank-fund-management-company-luxembourg/fund-of-funds-balanced-blend-fund',
	  'https://www.eurobankam.gr/en/pillarfunds/searchfund/lf-fund-of-funds-balanced-blend-fund',
	  'https://www.eurobank.gr/-/media/eurobank/retail/proionta-kai-upiresies/proionta/ependuseis/amoibaia-kefalaia/pdf/eksoterikou/facts-sheets/760-lf-fof-balancedblend-fs-gr.pdf',
	  'https://global.morningstar.com/en-eu/investments/funds/0P0000S8TS',
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0352743748:EUR'
    ]
  ),
  (
    'Eurobank (LF) Fund of Funds – Growth Blend Fund',
    'LU0352744472',
    NULL,
    'FUND_OF_FUNDS',
    4,
    ARRAY[
	  'https://www.eurobank.gr/el/retail/proionta-upiresies/proionta/ependuseis/amoibaia-kefalaia/amoibaia-kefalaia-lf-kai-lf-fof/eurobank-fund-management-company-luxembourg/fund-of-funds-growth-blend-fund',
	  'https://www.eurobankam.gr/en/pillarfunds/searchfund/lf-fund-of-funds-growth-blend-fund',
	  'https://www.eurobank.gr/-/media/eurobank/retail/proionta-kai-upiresies/proionta/ependuseis/amoibaia-kefalaia/pdf/eksoterikou/facts-sheets/770-lf-fof-growthblend-fs-gr.pdf',
	  'https://global.morningstar.com/en-eu/investments/funds/0P0000S8TT',
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0352744472:EUR'
    ]
  ),
  (
    'Eurobank (LF) Fund of Funds – Income Blend Fund',
    'LU0352743318',
    NULL,
    'FUND_OF_FUNDS',
    2,
    ARRAY[
	  'https://www.eurobank.gr/el/retail/proionta-upiresies/proionta/ependuseis/amoibaia-kefalaia/amoibaia-kefalaia-lf-kai-lf-fof/eurobank-fund-management-company-luxembourg/fund-of-funds-income-blend-fund',
	  'https://www.eurobankam.gr/en/pillarfunds/searchfund/lf-fund-of-funds-income-blend-fund',
	  'https://www.eurobank.gr/-/media/eurobank/retail/proionta-kai-upiresies/proionta/ependuseis/amoibaia-kefalaia/pdf/eksoterikou/facts-sheets/750-lf-fof-incomeblend-fs-gr.pdf',
	  'https://global.morningstar.com/en-eu/investments/funds/0P0000S8TR',
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0352743318:EUR'
    ]
  ),
  (
    'Eurobank (LF) Special Purpose – Better Yield Fund',
    'LU0567884454',
    NULL,
    'HIGH_YIELD',
    2,
    ARRAY[
	  'https://www.eurobank.gr/el/retail/proionta-upiresies/proionta/ependuseis/amoibaia-kefalaia/amoibaia-kefalaia-lf-kai-lf-fof/eurobank-fund-management-company-luxembourg/better-yield-fund',
	  'https://www.eurobankam.gr/en/pillarfunds/searchfund/lf-special-purpose-better-yield-fund',
	  'https://www.eurobank.gr/-/media/eurobank/retail/proionta-kai-upiresies/proionta/ependuseis/amoibaia-kefalaia/pdf/eksoterikou/facts-sheets/660-lf-betteryield-fs-gr.pdf',
	  'https://global.morningstar.com/en-eu/investments/funds/0P0000YZHL',
      'https://markets.ft.com/data/funds/tearsheet/summary?s=LU0567884454:EUR'
    ]
  );

-- Crypto seed: Bitcoin
INSERT INTO instruments (name, isin, ticker, currency, asset_class, risk_level, data_sources) VALUES
  (
    'Bitcoin',
    NULL,
    'BTC-USD',
    'USD',
    'CRYPTO',
    7,
    ARRAY['https://finance.yahoo.com/quote/BTC-USD']
  );

-- ─────────────────────────────────────────────
-- SEED: PORTFOLIOS
-- ─────────────────────────────────────────────

INSERT INTO portfolios (name, description) VALUES
  ('Main Portfolio', 'Primary investment portfolio'),
  ('Retirement Portfolio', 'Long-term retirement savings');

-- ─────────────────────────────────────────────
-- SEED: ALLOCATION TEMPLATES
-- ─────────────────────────────────────────────

INSERT INTO allocation_templates (code, description) VALUES
  ('CONSERVATIVE', 'Low-risk, income-focused allocation'),
  ('BALANCED',     'Moderate risk, balanced growth and income'),
  ('GROWTH',       'Higher risk, long-term capital appreciation'),
  ('AGGRESSIVE',   'Maximum risk, maximum growth potential');

-- ─────────────────────────────────────────────
-- SEED: ALLOCATION TEMPLATE ITEMS
-- ─────────────────────────────────────────────

INSERT INTO allocation_template_items (template_id, instrument_id, weight)
SELECT
  t.id,
  i.id,
  v.weight
FROM (
  VALUES
    ('CONSERVATIVE', 'LU0670223279', 40.0000),
    ('CONSERVATIVE', 'LU0939092168', 25.0000),
    ('CONSERVATIVE', 'LU0420076928', 20.0000),
    ('CONSERVATIVE', 'LU2047494005', 10.0000),
    ('CONSERVATIVE', 'LU0285432364',  5.0000),

    ('BALANCED',     'LU0352743748', 35.0000),
    ('BALANCED',     'LU0939092168', 20.0000),
    ('BALANCED',     'LU0420076928', 15.0000),
    ('BALANCED',     'LU0273962166', 15.0000),
    ('BALANCED',     'LU0285432364', 10.0000),
    ('BALANCED',     'LU2047494005',  5.0000),

    ('GROWTH',       'LU0352744472', 40.0000),
    ('GROWTH',       'LU0273962166', 25.0000),
    ('GROWTH',       'LU0939092168', 15.0000),
    ('GROWTH',       'LU0285432364', 10.0000),
    ('GROWTH',       'LU2047494005', 10.0000),

    ('AGGRESSIVE',   'LU0273962166', 50.0000),
    ('AGGRESSIVE',   'LU0352744472', 25.0000),
    ('AGGRESSIVE',   'LU0567884454', 15.0000),
    ('AGGRESSIVE',   'LU0285432364', 10.0000)
) AS v(code, isin, weight)
JOIN allocation_templates t ON t.code = v.code
JOIN instruments          i ON i.isin = v.isin;
