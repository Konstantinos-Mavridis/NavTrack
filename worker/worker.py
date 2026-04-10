"""
NavTrack – Background Worker
======================================
Environment variables
  SYNC_ON_STARTUP   – "true" to run a full NAV sync at container start (default: false)
                      Leave false in production; use the scheduler or the UI instead.
  POSTGRES_HOST/PORT/DB/USER/PASSWORD – standard DB config
"""

import logging
import math
import os
import time
import uuid
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

import psycopg2
import psycopg2.extras
import yfinance as yf
from apscheduler.schedulers.blocking import BlockingScheduler
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

SYNC_ON_STARTUP = os.getenv("SYNC_ON_STARTUP", "false").lower() == "true"


# ─────────────────────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────────────────────

def dsn() -> str:
    return (
        f"host={os.getenv('POSTGRES_HOST', 'db')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'portfolio_db')} "
        f"user={os.getenv('POSTGRES_USER', 'portfolio_user')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'portfolio_pass')}"
    )


def get_conn():
    return psycopg2.connect(dsn())


def wait_for_db(retries: int = 30, delay: float = 3.0) -> None:
    """
    Wait until Postgres is up AND the schema has been applied.

    pg_isready (and a bare TCP connect) returns True as soon as the server
    accepts connections — which happens *before* docker-entrypoint-initdb.d
    scripts finish running.  We therefore poll for the 'portfolios' table
    specifically, not just for a successful connection.
    """
    for attempt in range(1, retries + 1):
        try:
            conn = get_conn()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT 1
                    FROM   information_schema.tables
                    WHERE  table_schema = 'public'
                      AND  table_name   = 'portfolios'
                    """
                )
                if cur.fetchone():
                    conn.close()
                    log.info("Database is ready ✓")
                    return
            conn.close()
            log.info(
                "DB reachable but schema not ready yet (attempt %d/%d) – waiting %.0fs …",
                attempt, retries, delay,
            )
        except psycopg2.OperationalError as exc:
            log.warning("DB not reachable (attempt %d/%d): %s", attempt, retries, exc)
        time.sleep(delay)
    raise SystemExit("Database/schema not ready after %d attempts." % retries)


# ─────────────────────────────────────────────────────────────────────────────
# Seed check
# ─────────────────────────────────────────────────────────────────────────────

def check_seed() -> None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM portfolios")
        n_p = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM instruments")
        n_i = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM nav_prices")
        n_n = cur.fetchone()[0]
    if n_p == 0:
        log.warning("No portfolios found – ensure init.sql ran on first boot.")
    else:
        log.info("Seed OK: %d portfolio(s), %d instrument(s), %d NAV price(s)", n_p, n_i, n_n)


# ─────────────────────────────────────────────────────────────────────────────
# Valuation job
# ─────────────────────────────────────────────────────────────────────────────

def run_valuation() -> None:
    target = date.today().isoformat()
    log.info("=== Valuation job  date=%s ===", target)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, name FROM portfolios ORDER BY name")
            portfolios = cur.fetchall()

        for portfolio in portfolios:
            pid   = str(portfolio["id"])
            pname = portfolio["name"]
            total_value = Decimal("0")
            total_cost  = Decimal("0")
            priced      = 0

            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT pp.instrument_id, pp.units, pp.cost_basis_per_unit
                    FROM   portfolio_positions pp
                    WHERE  pp.portfolio_id = %s
                    """,
                    (pid,),
                )
                positions = cur.fetchall()

            for pos in positions:
                iid   = str(pos["instrument_id"])
                units = Decimal(str(pos["units"]))

                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT nav FROM nav_prices
                        WHERE  instrument_id = %s AND date <= %s
                        ORDER  BY date DESC LIMIT 1
                        """,
                        (iid, target),
                    )
                    row = cur.fetchone()

                if row is None:
                    continue

                nav   = Decimal(str(row[0]))
                value = (units * nav).quantize(Decimal("0.01"), ROUND_HALF_UP)
                total_value += value
                priced += 1

                if pos["cost_basis_per_unit"] is not None:
                    cost = (units * Decimal(str(pos["cost_basis_per_unit"]))).quantize(
                        Decimal("0.01"), ROUND_HALF_UP
                    )
                    total_cost += cost

            pnl     = total_value - total_cost
            pnl_pct = (
                (pnl / total_cost * 100).quantize(Decimal("0.01"), ROUND_HALF_UP)
                if total_cost > 0
                else Decimal("0")
            )
            log.info(
                "  [%s]  priced=%d  value=€%s  cost=€%s  P&L=€%s (%s%%)",
                pname, priced, total_value, total_cost, pnl, pnl_pct,
            )

    log.info("=== Valuation job complete ===")


# ─────────────────────────────────────────────────────────────────────────────
# Yahoo Finance – ticker resolution with retry/backoff
# ─────────────────────────────────────────────────────────────────────────────

# How long to wait between resolution attempts when rate-limited.
# Yahoo typically lifts the limit after 30–60 s.
_RATE_LIMIT_BACKOFFS = [15, 30, 60]   # seconds


def _resolve_ticker_with_retry(isin: str) -> str | None:
    """
    Call yf.Search for this ISIN.  On a rate-limit error, wait and retry up to
    len(_RATE_LIMIT_BACKOFFS) times before giving up.
    Returns the ticker symbol, or None if the ISIN is not found.
    Raises the last exception if all retries are exhausted.
    """
    last_exc = None

    for attempt, backoff in enumerate([0] + _RATE_LIMIT_BACKOFFS, start=1):
        if backoff:
            log.warning(
                "  Rate-limited by Yahoo Finance – waiting %ds before retry %d/%d …",
                backoff, attempt, 1 + len(_RATE_LIMIT_BACKOFFS),
            )
            time.sleep(backoff)

        try:
            search  = yf.Search(isin, max_results=5, enable_fuzzy_query=False)
            quotes  = search.quotes or []

            if not quotes:
                log.warning("  No Yahoo Finance result for ISIN %s", isin)
                return None

            # Prefer mutual fund / ETF; fall back to first result
            preferred = next(
                (q for q in quotes if q.get("quoteType") in ("MUTUALFUND", "ETF")),
                quotes[0],
            )
            return preferred["symbol"]

        except Exception as exc:
            msg = str(exc)
            if "Too Many Requests" in msg or "Rate limit" in msg or "429" in msg:
                last_exc = exc
                # Continue to next retry iteration
                continue
            # Non-rate-limit error — fail immediately
            raise

    # All retries exhausted
    log.error("  All retries exhausted for ISIN %s: %s", isin, last_exc)
    raise last_exc


def _resolve_ticker(isin: str, instrument_id: str, conn) -> str | None:
    """Return cached Yahoo ticker or resolve + cache it."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT external_ids FROM instruments WHERE id = %s",
            (instrument_id,),
        )
        row = cur.fetchone()

    external_ids  = (row["external_ids"] or {}) if row else {}
    cached_ticker = external_ids.get("yahoo_ticker")
    if cached_ticker:
        log.info("  Using cached ticker %s for ISIN %s", cached_ticker, isin)
        return cached_ticker

    log.info("  Resolving Yahoo ticker for ISIN %s …", isin)
    try:
        ticker = _resolve_ticker_with_retry(isin)
    except Exception as exc:
        log.warning("  Ticker resolution failed for %s: %s", isin, exc)
        return None

    if ticker is None:
        return None

    log.info("  Resolved %s → %s", isin, ticker)

    # Persist so we skip resolution next time
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE instruments
            SET    external_ids = external_ids
                               || jsonb_build_object('yahoo_ticker', %s::text)
            WHERE  id = %s
            """,
            (ticker, instrument_id),
        )
    conn.commit()
    return ticker


# ─────────────────────────────────────────────────────────────────────────────
# NAV fetch + upsert
# ─────────────────────────────────────────────────────────────────────────────

def _smart_from_date(instrument_id: str, conn) -> str:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT MAX(date) FROM nav_prices WHERE instrument_id = %s",
            (instrument_id,),
        )
        row = cur.fetchone()
    if row and row[0]:
        return (row[0] + timedelta(days=1)).isoformat()
    five_years_ago = date.today().replace(year=date.today().year - 5)
    return five_years_ago.isoformat()


def _fetch_and_upsert(ticker: str, instrument_id: str, from_date: str, conn) -> tuple[int, int]:
    today_str = date.today().isoformat()
    if from_date > today_str:
        log.info("  Already up-to-date")
        return 0, 0

    ticker_obj = yf.Ticker(ticker)
    hist = ticker_obj.history(start=from_date, end=today_str, interval="1d", auto_adjust=False)

    if hist.empty:
        log.warning("  No data returned from Yahoo Finance for %s", ticker)
        return 0, 0

    points = []
    for ts, row_data in hist.iterrows():
        close = row_data.get("Close") or row_data.get("close")
        if close is None or math.isnan(close) or close <= 0:
            continue
        points.append({"date": ts.strftime("%Y-%m-%d"), "nav": round(float(close), 6)})

    if not points:
        return 0, 0

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO nav_prices (id, instrument_id, date, nav, source)
            VALUES %s
            ON CONFLICT (instrument_id, date)
            DO UPDATE SET nav = EXCLUDED.nav, source = EXCLUDED.source
            """,
            [(str(uuid.uuid4()), instrument_id, p["date"], p["nav"], "YAHOO") for p in points],
        )
    conn.commit()
    return len(points), len(points)


def _record_sync_job(conn, instrument_id: str, status: str,
                     fetched: int, upserted: int, error: str | None,
                     triggered_by: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sync_jobs
              (id, instrument_id, status, source,
               records_fetched, records_upserted, error_message,
               started_at, completed_at, triggered_by)
            VALUES (%s, %s, %s, 'YAHOO', %s, %s, %s, NOW(), NOW(), %s)
            """,
            (str(uuid.uuid4()), instrument_id, status,
             fetched, upserted, error, triggered_by),
        )
    conn.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Full NAV sync job
# ─────────────────────────────────────────────────────────────────────────────

def run_nav_sync(triggered_by: str = "SCHEDULER", from_date: str | None = None) -> None:
    log.info("=== NAV sync started (triggered_by=%s) ===", triggered_by)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, isin, name FROM instruments ORDER BY name")
            instruments = cur.fetchall()

        total_fetched = total_upserted = errors = 0

        for idx, inst in enumerate(instruments):
            isin          = inst["isin"].strip()
            instrument_id = str(inst["id"])
            name          = inst["name"]

            log.info("[%d/%d] %s (%s)", idx + 1, len(instruments), name, isin)

            job_status = "SUCCESS"
            fetched = upserted = 0
            error_msg = None

            try:
                ticker = _resolve_ticker(isin, instrument_id, conn)
                if not ticker:
                    raise ValueError("Could not resolve Yahoo Finance ticker")

                start = from_date or _smart_from_date(instrument_id, conn)
                log.info("  Fetching %s → today via %s", start, ticker)

                fetched, upserted = _fetch_and_upsert(ticker, instrument_id, start, conn)
                log.info("  fetched=%d  upserted=%d", fetched, upserted)

            except Exception as exc:
                log.error("  FAILED: %s", exc)
                job_status = "FAILED"
                error_msg  = str(exc)
                errors += 1

            total_fetched  += fetched
            total_upserted += upserted

            _record_sync_job(
                conn, instrument_id, job_status,
                fetched, upserted, error_msg, triggered_by,
            )

            # Polite inter-instrument delay.
            # Longer when we had to resolve the ticker (more API calls).
            # This is the key mitigation against rate limiting for sequential syncs.
            if idx < len(instruments) - 1:
                time.sleep(3.0)   # 3 s between instruments during scheduled/startup sync

    log.info(
        "=== NAV sync complete  fetched=%d  upserted=%d  errors=%d ===",
        total_fetched, total_upserted, errors,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    wait_for_db()
    check_seed()

    # Always run valuation on startup (cheap — pure DB)
    run_valuation()

    # Startup NAV sync is opt-in.
    # Firing 11 sequential Yahoo searches immediately on boot is the exact
    # pattern that triggers rate limiting.  Use SYNC_ON_STARTUP=true only
    # if you know the DB is cold and you're willing to wait.
    if SYNC_ON_STARTUP:
        log.info("SYNC_ON_STARTUP=true – running incremental NAV sync …")
        log.info("(This may take several minutes due to Yahoo Finance rate limits.)")
        run_nav_sync(triggered_by="WORKER_STARTUP")
    else:
        log.info(
            "SYNC_ON_STARTUP=false (default) – skipping startup sync.\n"
            "  Use the 'Sync' button in the app, or POST /api/sync/all,\n"
            "  or set SYNC_ON_STARTUP=true to sync automatically on boot."
        )

    # Scheduled jobs
    scheduler = BlockingScheduler(timezone="Europe/Athens")

    scheduler.add_job(
        run_valuation,
        trigger="cron",
        hour=18, minute=30,
        id="daily_valuation",
        max_instances=1,
        coalesce=True,
    )

    scheduler.add_job(
        lambda: run_nav_sync(triggered_by="SCHEDULER"),
        trigger="cron",
        day_of_week="mon",
        hour=7, minute=0,
        id="weekly_nav_sync",
        max_instances=1,
        coalesce=True,
    )

    log.info(
        "Scheduler running:\n"
        "  – Daily valuation  18:30 Europe/Athens\n"
        "  – Weekly NAV sync  Monday 07:00 Europe/Athens"
    )

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("Worker shutting down.")


if __name__ == "__main__":
    main()
