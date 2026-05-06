-- ============================================================
-- Migration 001 – Crypto instrument support
-- ============================================================
-- Run this script on any existing NavTrack database that was
-- initialised before this migration was added to init.sql.
--
-- Safe to run multiple times (all statements are idempotent).
-- ============================================================

-- 1. Add CRYPTO to the asset_class enum
ALTER TYPE asset_class ADD VALUE IF NOT EXISTS 'CRYPTO';

-- 2. Allow instruments without an ISIN (crypto instruments use
--    the ticker column instead)
ALTER TABLE instruments
  ALTER COLUMN isin DROP NOT NULL;

-- 3. Add the ticker column (direct Yahoo Finance symbol, e.g. BTC-USD)
ALTER TABLE instruments
  ADD COLUMN IF NOT EXISTS ticker TEXT;

-- 4. Unique constraint on ticker (equivalent to the ISIN constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'instruments_ticker_unique'
  ) THEN
    ALTER TABLE instruments
      ADD CONSTRAINT instruments_ticker_unique UNIQUE (ticker);
  END IF;
END$$;

-- 5. Enforce: every instrument must have at least one of isin / ticker
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'instruments_isin_or_ticker_required'
  ) THEN
    ALTER TABLE instruments
      ADD CONSTRAINT instruments_isin_or_ticker_required
      CHECK (isin IS NOT NULL OR ticker IS NOT NULL);
  END IF;
END$$;

-- 6. Index on the new ticker column
CREATE INDEX IF NOT EXISTS idx_instruments_ticker ON instruments(ticker);
