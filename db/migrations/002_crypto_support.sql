-- ============================================================
-- Migration 002 – Crypto instrument support
-- Run this against existing NavTrack deployments that were
-- initialised before crypto support was added.
-- New deployments are covered by the updated init.sql.
-- ============================================================

-- 1. Add CRYPTO to the asset_class enum (IF NOT EXISTS guard is
--    not available for ALTER TYPE ADD VALUE in older Postgres, but
--    the DO block below makes it idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE  enumtypid = 'asset_class'::regtype
      AND  enumlabel = 'CRYPTO'
  ) THEN
    ALTER TYPE asset_class ADD VALUE 'CRYPTO';
  END IF;
END;
$$;

-- 2. Make isin nullable (crypto instruments have no ISIN).
ALTER TABLE instruments
  ALTER COLUMN isin DROP NOT NULL;

-- 3. Add a direct ticker column (e.g. "BTC-USD", "ETH-USD").
ALTER TABLE instruments
  ADD COLUMN IF NOT EXISTS ticker TEXT;

-- 4. Unique index on ticker (NULLs are excluded from unique indexes
--    in Postgres, so NULL ticker on ISIN-based instruments is fine).
CREATE UNIQUE INDEX IF NOT EXISTS idx_instruments_ticker
  ON instruments (ticker)
  WHERE ticker IS NOT NULL;

-- 5. Enforce: every instrument must have at least one identifier.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  constraint_name = 'instruments_isin_or_ticker_required'
      AND  table_name      = 'instruments'
  ) THEN
    ALTER TABLE instruments
      ADD CONSTRAINT instruments_isin_or_ticker_required
      CHECK (isin IS NOT NULL OR ticker IS NOT NULL);
  END IF;
END;
$$;
