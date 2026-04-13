"""
Unit tests for NAV fetch / parse helpers in worker.py.

All external calls (yfinance, psycopg2) are patched so the suite runs
without a live database or network connection.
"""
import math
import types
import sys
import pytest

# ---------------------------------------------------------------------------
# Minimal stubs for heavy dependencies so importing worker.py is fast in CI
# ---------------------------------------------------------------------------

def _stub_module(name: str) -> types.ModuleType:
    mod = types.ModuleType(name)
    sys.modules[name] = mod
    return mod

# psycopg2 stub
psycopg2_stub = _stub_module("psycopg2")
psycopg2_stub.connect = lambda *a, **kw: None
psycopg2_stub.OperationalError = Exception
extras_stub = _stub_module("psycopg2.extras")
extras_stub.RealDictCursor = object
extras_stub.execute_values = lambda *a, **kw: None

# apscheduler stub
aps_stub = _stub_module("apscheduler")
_stub_module("apscheduler.schedulers")
schedulers_blocking = _stub_module("apscheduler.schedulers.blocking")
schedulers_blocking.BlockingScheduler = type("BlockingScheduler", (), {
    "add_job": lambda *a, **kw: None,
    "start":   lambda *a, **kw: None,
})

# yfinance stub — replaced per-test
yf_stub = _stub_module("yfinance")

# dotenv stub
dotenv_stub = _stub_module("dotenv")
dotenv_stub.load_dotenv = lambda *a, **kw: None

# Now import the worker module
import importlib
worker = importlib.import_module("worker")


# ---------------------------------------------------------------------------
# Helper to build a fake pandas-like history DataFrame
# ---------------------------------------------------------------------------

class FakeRow:
    def __init__(self, close: float):
        self._close = close

    def get(self, key, default=None):
        if key in ("Close", "close"):
            return self._close
        return default


class FakeHistory:
    def __init__(self, rows: list[tuple[str, float]]):
        self._rows = rows

    @property
    def empty(self) -> bool:
        return len(self._rows) == 0

    def iterrows(self):
        for date_str, close in self._rows:
            # Simulate a pandas Timestamp with strftime
            ts = type("TS", (), {"strftime": lambda self, fmt, d=date_str: d})()
            yield ts, FakeRow(close)


# ---------------------------------------------------------------------------
# Tests: _fetch_and_upsert filtering logic
# ---------------------------------------------------------------------------

class TestFetchAndUpsert:
    """_fetch_and_upsert should filter out invalid rows and upsert the rest."""

    def _run(self, rows, monkeypatch):
        upserted_points = []

        def fake_execute_values(cur, sql, data):
            upserted_points.extend(data)

        monkeypatch.setattr("worker.psycopg2.extras.execute_values", fake_execute_values)

        import yfinance as _yf

        class FakeTicker:
            def history(self, **kw):
                return FakeHistory(rows)

        monkeypatch.setattr(_yf, "Ticker", lambda ticker: FakeTicker())

        fake_conn = types.SimpleNamespace(
            cursor=lambda: types.SimpleNamespace(
                __enter__=lambda s: s,
                __exit__=lambda s, *a: None,
                execute=lambda *a, **kw: None,
                executemany=lambda *a, **kw: None,
            ),
            commit=lambda: None,
        )

        fetched, upserted = worker._fetch_and_upsert(
            "TICKER.L", "inst-uuid", "2024-01-01", fake_conn
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
        # Only the valid row should be upserted
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
        """When from_date is in the future, no fetch should happen."""
        import yfinance as _yf
        monkeypatch.setattr(_yf, "Ticker", lambda t: None)  # would explode if called

        from datetime import date
        future = (date.today().replace(year=date.today().year + 1)).isoformat()

        fake_conn = types.SimpleNamespace(commit=lambda: None)
        fetched, upserted = worker._fetch_and_upsert("T", "id", future, fake_conn)
        assert fetched == 0
        assert upserted == 0


# ---------------------------------------------------------------------------
# Tests: _resolve_ticker_with_retry — retry logic
# ---------------------------------------------------------------------------

class TestResolveTickerWithRetry:

    def test_returns_ticker_on_first_success(self, monkeypatch):
        import yfinance as _yf

        class FakeSearch:
            def __init__(self, isin, **kw):
                self.quotes = [{"symbol": "UCIT.L", "quoteType": "ETF"}]

        monkeypatch.setattr(_yf, "Search", FakeSearch)
        monkeypatch.setattr("time.sleep", lambda *a: None)

        result = worker._resolve_ticker_with_retry("IE0001234567")
        assert result == "UCIT.L"

    def test_returns_none_when_no_quotes(self, monkeypatch):
        import yfinance as _yf

        class FakeSearch:
            def __init__(self, isin, **kw):
                self.quotes = []

        monkeypatch.setattr(_yf, "Search", FakeSearch)
        monkeypatch.setattr("time.sleep", lambda *a: None)

        result = worker._resolve_ticker_with_retry("IE0000000000")
        assert result is None

    def test_prefers_mutualfund_over_equity(self, monkeypatch):
        import yfinance as _yf

        class FakeSearch:
            def __init__(self, isin, **kw):
                self.quotes = [
                    {"symbol": "EQUITY.L", "quoteType": "EQUITY"},
                    {"symbol": "FUND.L",   "quoteType": "MUTUALFUND"},
                ]

        monkeypatch.setattr(_yf, "Search", FakeSearch)
        monkeypatch.setattr("time.sleep", lambda *a: None)

        result = worker._resolve_ticker_with_retry("IE0001234567")
        assert result == "FUND.L"

    def test_retries_on_rate_limit_then_succeeds(self, monkeypatch):
        import yfinance as _yf
        call_count = {"n": 0}

        class FakeSearch:
            def __init__(self, isin, **kw):
                call_count["n"] += 1
                if call_count["n"] < 2:
                    raise Exception("Too Many Requests – 429")
                self.quotes = [{"symbol": "RETRY.L", "quoteType": "ETF"}]

        monkeypatch.setattr(_yf, "Search", FakeSearch)
        monkeypatch.setattr("time.sleep", lambda *a: None)

        result = worker._resolve_ticker_with_retry("IE0001234567")
        assert result == "RETRY.L"
        assert call_count["n"] == 2

    def test_raises_after_all_retries_exhausted(self, monkeypatch):
        import yfinance as _yf

        class FakeSearch:
            def __init__(self, isin, **kw):
                raise Exception("Too Many Requests – 429")

        monkeypatch.setattr(_yf, "Search", FakeSearch)
        monkeypatch.setattr("time.sleep", lambda *a: None)

        with pytest.raises(Exception, match="Too Many Requests"):
            worker._resolve_ticker_with_retry("IE0001234567")

    def test_non_rate_limit_error_is_not_retried(self, monkeypatch):
        import yfinance as _yf
        call_count = {"n": 0}

        class FakeSearch:
            def __init__(self, isin, **kw):
                call_count["n"] += 1
                raise ValueError("unexpected error")

        monkeypatch.setattr(_yf, "Search", FakeSearch)
        monkeypatch.setattr("time.sleep", lambda *a: None)

        with pytest.raises(ValueError):
            worker._resolve_ticker_with_retry("IE0001234567")

        # Should have bailed immediately — no retries
        assert call_count["n"] == 1


# ---------------------------------------------------------------------------
# Tests: dsn() helper
# ---------------------------------------------------------------------------

class TestDsn:
    def test_uses_env_variables(self, monkeypatch):
        monkeypatch.setenv("POSTGRES_HOST", "myhost")
        monkeypatch.setenv("POSTGRES_PORT", "5433")
        monkeypatch.setenv("POSTGRES_DB",   "mydb")
        monkeypatch.setenv("POSTGRES_USER",  "myuser")
        monkeypatch.setenv("POSTGRES_PASSWORD", "s3cr3t")

        result = worker.dsn()

        assert "myhost" in result
        assert "5433"   in result
        assert "mydb"   in result
        assert "myuser" in result
        assert "s3cr3t" in result

    def test_defaults(self, monkeypatch):
        for var in ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB",
                    "POSTGRES_USER", "POSTGRES_PASSWORD"]:
            monkeypatch.delenv(var, raising=False)

        result = worker.dsn()

        assert "host=db"            in result
        assert "port=5432"          in result
        assert "dbname=portfolio_db" in result
