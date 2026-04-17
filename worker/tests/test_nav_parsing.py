"""
Unit tests for NAV fetch / parse helpers in worker.py.

All external calls (yfinance, psycopg2) are patched so the suite runs
without a live database or network connection.

PATCHING STRATEGY
-----------------
* pytest.ini uses --import-mode=importlib, which means the `worker` module is
  NOT a Python package on sys.path as "worker".  Dotted-string setattr paths
  like "worker.psycopg2.extras.execute_values" therefore fail with
  "No module named 'worker.psycopg2'".

  Fix: patch by mutating sys.modules entries or worker's own module
  attributes directly — never via a dotted-string that traverses 'worker'
  as if it were a package.

* Python's `with` statement resolves __enter__/__exit__ on the *type*, not
  the instance, so types.SimpleNamespace cannot be used as a context manager
  even if those attributes are set on the instance.  Use a real class instead.
"""
import math
import types
import sys
import pytest

# ---------------------------------------------------------------------------
# Stubs for heavy dependencies — must be in sys.modules BEFORE worker imports
# ---------------------------------------------------------------------------

def _ensure_stub(name: str) -> types.ModuleType:
    """Create and register a blank stub module if not already present."""
    if name not in sys.modules:
        mod = types.ModuleType(name)
        sys.modules[name] = mod
    return sys.modules[name]


# psycopg2 — stub parent and submodule, then wire .extras onto parent
psycopg2_stub = _ensure_stub("psycopg2")
psycopg2_stub.connect = lambda *a, **kw: None
psycopg2_stub.OperationalError = Exception

extras_stub = _ensure_stub("psycopg2.extras")
extras_stub.RealDictCursor = object
extras_stub.execute_values = lambda *a, **kw: None
# Wire submodule onto parent so `psycopg2.extras` attribute access works
psycopg2_stub.extras = extras_stub

# apscheduler
_ensure_stub("apscheduler")
_ensure_stub("apscheduler.schedulers")
schedulers_blocking = _ensure_stub("apscheduler.schedulers.blocking")
schedulers_blocking.BlockingScheduler = type("BlockingScheduler", (), {
    "add_job": lambda *a, **kw: None,
    "start":   lambda *a, **kw: None,
})

# yfinance — blank stub; tests set attributes on it via monkeypatch
yf_stub = _ensure_stub("yfinance")

# dotenv
dotenv_stub = _ensure_stub("dotenv")
dotenv_stub.load_dotenv = lambda *a, **kw: None

# Import the worker module now that all heavy deps are stubbed out
import importlib
worker = importlib.import_module("worker")


# ---------------------------------------------------------------------------
# Fake cursor — must be a real class so `with conn.cursor() as cur:` works.
# ---------------------------------------------------------------------------

class FakeCursor:
    """Minimal psycopg2-cursor stand-in that supports the context manager protocol."""
    def __init__(self):
        self._executed = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params=None):
        self._executed.append((sql, params))

    def fetchone(self):
        return None

    def fetchall(self):
        return []


class FakeConn:
    """Minimal psycopg2-connection stand-in."""
    def __init__(self):
        self.committed = False

    def cursor(self, **kw):
        return FakeCursor()

    def commit(self):
        self.committed = True


# ---------------------------------------------------------------------------
# Fake pandas-like history DataFrame
#
# worker.py (yfinance >= 1.2.x) accesses price data via:
#
#   if "Close" not in hist.columns: ...
#   for ts, close in hist["Close"].items(): ...
#
# FakeHistory therefore needs:
#   .empty      — bool
#   .columns    — list[str]  (so `"Close" in hist.columns` works)
#   .__getitem__("Close") — returns a FakeSeries with .items()
# ---------------------------------------------------------------------------

class FakeSeries:
    """Minimal Series stub supporting .items() iteration."""

    def __init__(self, rows: list[tuple[str, float]]):
        self._rows = rows

    def items(self):
        for date_str, close in self._rows:
            ts = type("TS", (), {"strftime": lambda self, fmt, d=date_str: d})()
            yield ts, close


class FakeHistory:
    """Minimal DataFrame stub compatible with the yfinance 1.2.x column-access pattern."""

    def __init__(self, rows: list[tuple[str, float]]):
        self._rows = rows
        # Expose .columns so `"Close" in hist.columns` works
        self.columns = ["Close"] if rows else []

    @property
    def empty(self) -> bool:
        return len(self._rows) == 0

    def __getitem__(self, key: str) -> FakeSeries:
        if key == "Close":
            return FakeSeries(self._rows)
        raise KeyError(key)


# ---------------------------------------------------------------------------
# Tests: _fetch_and_upsert filtering logic
# ---------------------------------------------------------------------------

class TestFetchAndUpsert:
    """_fetch_and_upsert should filter out invalid rows and upsert the rest."""

    def _run(self, rows, monkeypatch):
        upserted_points = []

        def fake_execute_values(cur, sql, data):
            upserted_points.extend(data)

        # Patch on the stub module object directly — avoids dotted-string lookup
        # through 'worker' as a package (breaks under --import-mode=importlib).
        monkeypatch.setattr(extras_stub, "execute_values", fake_execute_values)

        class FakeTicker:
            def history(self, **kw):
                return FakeHistory(rows)

        # Patch worker's own reference to yf directly
        monkeypatch.setattr(worker, "yf", types.SimpleNamespace(
            Ticker=lambda ticker: FakeTicker(),
        ))

        fetched, upserted = worker._fetch_and_upsert(
            "TICKER.L", "inst-uuid", "2024-01-01", FakeConn()
        )
        return fetched, upserted, upserted_points

    def test_valid_rows_are_upserted(self, monkeypatch):
        rows = [("2024-01-01", 100.0), ("2024-01-02", 101.5)]
        fetched, upserted, points = self._run(rows, monkeypatch)
        assert fetched == 2
        assert upserted == 2

    def test_nan_close_is_skipped(self, monkeypatch):
        rows = [("2024-01-01", math.nan), ("2024-01-02", 50.0)]
        fetched, upserted, points = self._run(rows, monkeypatch)
        assert fetched == 1
        assert upserted == 1

    def test_zero_close_is_skipped(self, monkeypatch):
        rows = [("2024-01-01", 0.0), ("2024-01-02", 99.9)]
        fetched, upserted, points = self._run(rows, monkeypatch)
        assert fetched == 1

    def test_negative_close_is_skipped(self, monkeypatch):
        rows = [("2024-01-01", -5.0), ("2024-01-02", 10.0)]
        fetched, upserted, points = self._run(rows, monkeypatch)
        assert fetched == 1

    def test_empty_history_returns_zeros(self, monkeypatch):
        fetched, upserted, points = self._run([], monkeypatch)
        assert fetched == 0
        assert upserted == 0

    def test_already_up_to_date_returns_zeros(self, monkeypatch):
        """When from_date is in the future, _fetch_and_upsert returns early."""
        monkeypatch.setattr(worker, "yf", types.SimpleNamespace(
            Ticker=lambda t: (_ for _ in ()).throw(AssertionError("Ticker should not be called")),
        ))

        from datetime import date
        future = date.today().replace(year=date.today().year + 1).isoformat()

        fetched, upserted = worker._fetch_and_upsert("T", "id", future, FakeConn())
        assert fetched == 0
        assert upserted == 0

    def test_missing_close_column_returns_zeros(self, monkeypatch):
        """If yfinance returns a DataFrame without a Close column, return early gracefully."""
        monkeypatch.setattr(extras_stub, "execute_values", lambda *a, **kw: None)

        class NoCloseTicker:
            def history(self, **kw):
                hist = FakeHistory([("2024-01-01", 100.0)])
                hist.columns = []  # simulate missing Close column
                return hist

        monkeypatch.setattr(worker, "yf", types.SimpleNamespace(
            Ticker=lambda ticker: NoCloseTicker(),
        ))

        fetched, upserted = worker._fetch_and_upsert(
            "TICKER.L", "inst-uuid", "2024-01-01", FakeConn()
        )
        assert fetched == 0
        assert upserted == 0


# ---------------------------------------------------------------------------
# Tests: _resolve_ticker_with_retry — retry / backoff logic
# ---------------------------------------------------------------------------

class TestResolveTickerWithRetry:

    def _yf_with_search(self, search_cls):
        return types.SimpleNamespace(Search=search_cls)

    def test_returns_ticker_on_first_success(self, monkeypatch):
        class FakeSearch:
            def __init__(self, isin, **kw):
                self.quotes = [{"symbol": "UCIT.L", "quoteType": "ETF"}]

        monkeypatch.setattr(worker, "yf", self._yf_with_search(FakeSearch))
        monkeypatch.setattr("time.sleep", lambda *a: None)

        assert worker._resolve_ticker_with_retry("IE0001234567") == "UCIT.L"

    def test_returns_none_when_no_quotes(self, monkeypatch):
        class FakeSearch:
            def __init__(self, isin, **kw):
                self.quotes = []

        monkeypatch.setattr(worker, "yf", self._yf_with_search(FakeSearch))
        monkeypatch.setattr("time.sleep", lambda *a: None)

        assert worker._resolve_ticker_with_retry("IE0000000000") is None

    def test_prefers_mutualfund_over_equity(self, monkeypatch):
        class FakeSearch:
            def __init__(self, isin, **kw):
                self.quotes = [
                    {"symbol": "EQUITY.L", "quoteType": "EQUITY"},
                    {"symbol": "FUND.L",   "quoteType": "MUTUALFUND"},
                ]

        monkeypatch.setattr(worker, "yf", self._yf_with_search(FakeSearch))
        monkeypatch.setattr("time.sleep", lambda *a: None)

        assert worker._resolve_ticker_with_retry("IE0001234567") == "FUND.L"

    def test_retries_on_rate_limit_then_succeeds(self, monkeypatch):
        call_count = {"n": 0}

        class FakeSearch:
            def __init__(self, isin, **kw):
                call_count["n"] += 1
                if call_count["n"] < 2:
                    raise Exception("Too Many Requests – 429")
                self.quotes = [{"symbol": "RETRY.L", "quoteType": "ETF"}]

        monkeypatch.setattr(worker, "yf", self._yf_with_search(FakeSearch))
        monkeypatch.setattr("time.sleep", lambda *a: None)

        result = worker._resolve_ticker_with_retry("IE0001234567")
        assert result == "RETRY.L"
        assert call_count["n"] == 2

    def test_raises_after_all_retries_exhausted(self, monkeypatch):
        class FakeSearch:
            def __init__(self, isin, **kw):
                raise Exception("Too Many Requests – 429")

        monkeypatch.setattr(worker, "yf", self._yf_with_search(FakeSearch))
        monkeypatch.setattr("time.sleep", lambda *a: None)

        with pytest.raises(Exception, match="Too Many Requests"):
            worker._resolve_ticker_with_retry("IE0001234567")

    def test_non_rate_limit_error_is_not_retried(self, monkeypatch):
        call_count = {"n": 0}

        class FakeSearch:
            def __init__(self, isin, **kw):
                call_count["n"] += 1
                raise ValueError("unexpected error")

        monkeypatch.setattr(worker, "yf", self._yf_with_search(FakeSearch))
        monkeypatch.setattr("time.sleep", lambda *a: None)

        with pytest.raises(ValueError):
            worker._resolve_ticker_with_retry("IE0001234567")

        assert call_count["n"] == 1


# ---------------------------------------------------------------------------
# Tests: dsn() helper
# ---------------------------------------------------------------------------

class TestDsn:
    def test_uses_env_variables(self, monkeypatch):
        monkeypatch.setenv("POSTGRES_HOST",     "myhost")
        monkeypatch.setenv("POSTGRES_PORT",     "5433")
        monkeypatch.setenv("POSTGRES_DB",       "mydb")
        monkeypatch.setenv("POSTGRES_USER",     "myuser")
        monkeypatch.setenv("POSTGRES_PASSWORD", "s3cr3t")

        result = worker.dsn()
        assert "myhost" in result
        assert "5433"   in result
        assert "mydb"   in result
        assert "myuser" in result
        assert "s3cr3t" in result

    def test_defaults(self, monkeypatch):
        # host and port have defaults; db, user, password are required
        monkeypatch.delenv("POSTGRES_HOST", raising=False)
        monkeypatch.delenv("POSTGRES_PORT", raising=False)
        monkeypatch.setenv("POSTGRES_DB", "req_db")
        monkeypatch.setenv("POSTGRES_USER", "req_user")
        monkeypatch.setenv("POSTGRES_PASSWORD", "req_pass")

        result = worker.dsn()
        assert "host=db"             in result
        assert "port=5432"           in result
        assert "dbname=req_db"       in result

    def test_missing_required_credentials_raises_error(self, monkeypatch):
        monkeypatch.delenv("POSTGRES_DB", raising=False)
        with pytest.raises(KeyError):
            worker.dsn()
