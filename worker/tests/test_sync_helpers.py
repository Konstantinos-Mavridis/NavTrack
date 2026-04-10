"""
Unit tests for sync helper functions in worker.py:
  - _record_sync_job
  - _resolve_ticker  (cache hit / cache miss paths)
  - wait_for_db      (success, schema-not-ready, connection-error paths)

All external calls (psycopg2, yfinance) are patched so the suite runs
without a live database or network connection.

PATCHING STRATEGY
-----------------
Same as test_nav_parsing.py — see that file's module docstring for details.
The key rules:
  1. Always wire psycopg2.extras as an attribute on the psycopg2 stub.
  2. Patch worker.yf directly (monkeypatch.setattr(worker, "yf", ...)) rather
     than going through the yfinance module in sys.modules.
  3. Use _ensure_stub() so both test files share the same stub objects
     regardless of collection order.
"""
import types
import sys
import importlib
from unittest.mock import MagicMock
import pytest


# ---------------------------------------------------------------------------
# Stubs — shared with test_nav_parsing via sys.modules
# ---------------------------------------------------------------------------

def _ensure_stub(name: str) -> types.ModuleType:
    if name not in sys.modules:
        mod = types.ModuleType(name)
        sys.modules[name] = mod
    return sys.modules[name]


psycopg2_stub = _ensure_stub("psycopg2")
psycopg2_stub.connect = lambda *a, **kw: None
psycopg2_stub.OperationalError = Exception

extras_stub = _ensure_stub("psycopg2.extras")
extras_stub.RealDictCursor = object
extras_stub.execute_values = lambda *a, **kw: None
# Always wire .extras onto the parent stub — safe to repeat
psycopg2_stub.extras = extras_stub

_ensure_stub("apscheduler")
_ensure_stub("apscheduler.schedulers")
bsched = _ensure_stub("apscheduler.schedulers.blocking")
bsched.BlockingScheduler = type("BS", (), {
    "add_job": lambda *a, **kw: None,
    "start":   lambda *a, **kw: None,
})

_ensure_stub("yfinance")

dotenv_stub = _ensure_stub("dotenv")
dotenv_stub.load_dotenv = lambda *a, **kw: None

worker = importlib.import_module("worker")


# ---------------------------------------------------------------------------
# Cursor / connection factory helpers
# ---------------------------------------------------------------------------

def _make_cursor(fetchone_return=None, fetchall_return=None):
    cur = MagicMock()
    cur.__enter__ = lambda s: s
    cur.__exit__ = MagicMock(return_value=False)
    cur.fetchone.return_value = fetchone_return
    cur.fetchall.return_value = fetchall_return or []
    return cur


def _make_conn(cursor):
    conn = MagicMock()
    conn.cursor.return_value = cursor
    conn.commit = MagicMock()
    return conn


# ---------------------------------------------------------------------------
# Tests: _record_sync_job
# ---------------------------------------------------------------------------

class TestRecordSyncJob:
    """_record_sync_job should INSERT one row and commit."""

    def test_executes_insert_and_commits(self):
        cur  = _make_cursor()
        conn = _make_conn(cur)

        worker._record_sync_job(
            conn,
            instrument_id="inst-1",
            status="SUCCESS",
            fetched=10,
            upserted=10,
            error=None,
            triggered_by="SCHEDULER",
        )

        assert cur.execute.called
        conn.commit.assert_called_once()

    def test_passes_correct_status(self):
        cur  = _make_cursor()
        conn = _make_conn(cur)

        worker._record_sync_job(
            conn, "inst-1", "FAILED", 0, 0, "network timeout", "SCHEDULER"
        )

        params = cur.execute.call_args[0][1]
        assert "FAILED" in params
        assert "network timeout" in params

    def test_records_fetched_and_upserted_counts(self):
        cur  = _make_cursor()
        conn = _make_conn(cur)

        worker._record_sync_job(
            conn, "inst-1", "SUCCESS", fetched=42, upserted=42,
            error=None, triggered_by="MANUAL"
        )

        params = cur.execute.call_args[0][1]
        assert 42 in params

    def test_triggered_by_is_recorded(self):
        cur  = _make_cursor()
        conn = _make_conn(cur)

        worker._record_sync_job(
            conn, "inst-1", "SUCCESS", 5, 5, None, "WORKER_STARTUP"
        )

        params = cur.execute.call_args[0][1]
        assert "WORKER_STARTUP" in params


# ---------------------------------------------------------------------------
# Tests: _resolve_ticker  (cache layer)
# ---------------------------------------------------------------------------

class TestResolveTicker:
    """
    _resolve_ticker reads from instruments.external_ids.
    Cache hit  → returns cached value without calling _resolve_ticker_with_retry.
    Cache miss → calls _resolve_ticker_with_retry and persists the result.
    """

    def _conn_with_external_ids(self, external_ids: dict):
        row = {"external_ids": external_ids}
        cur = MagicMock()
        cur.__enter__ = lambda s: s
        cur.__exit__ = MagicMock(return_value=False)
        cur.fetchone.return_value = row
        conn = MagicMock()
        conn.cursor.return_value = cur
        conn.commit = MagicMock()
        return conn, cur

    def test_returns_cached_ticker_without_calling_yfinance(self, monkeypatch):
        conn, _ = self._conn_with_external_ids({"yahoo_ticker": "CACHED.L"})

        def _should_not_be_called(isin):
            raise AssertionError("_resolve_ticker_with_retry should not be called on a cache hit")

        monkeypatch.setattr(worker, "_resolve_ticker_with_retry", _should_not_be_called)

        result = worker._resolve_ticker("IE000", "inst-1", conn)
        assert result == "CACHED.L"

    def test_calls_retry_when_no_cache(self, monkeypatch):
        conn, _ = self._conn_with_external_ids({})
        monkeypatch.setattr(worker, "_resolve_ticker_with_retry", lambda isin: "RESOLVED.L")

        assert worker._resolve_ticker("IE000", "inst-1", conn) == "RESOLVED.L"

    def test_persists_resolved_ticker(self, monkeypatch):
        conn, cur = self._conn_with_external_ids({})
        monkeypatch.setattr(worker, "_resolve_ticker_with_retry", lambda isin: "NEW.L")

        worker._resolve_ticker("IE000", "inst-1", conn)

        assert cur.execute.called
        all_sql = " ".join(str(c) for c in cur.execute.call_args_list).upper()
        assert "UPDATE" in all_sql
        conn.commit.assert_called()

    def test_returns_none_when_retry_returns_none(self, monkeypatch):
        conn, _ = self._conn_with_external_ids({})
        monkeypatch.setattr(worker, "_resolve_ticker_with_retry", lambda isin: None)

        assert worker._resolve_ticker("IE000", "inst-1", conn) is None

    def test_returns_none_when_retry_raises(self, monkeypatch):
        conn, _ = self._conn_with_external_ids({})

        def _raises(isin):
            raise Exception("network error")

        monkeypatch.setattr(worker, "_resolve_ticker_with_retry", _raises)

        assert worker._resolve_ticker("IE000", "inst-1", conn) is None


# ---------------------------------------------------------------------------
# Tests: wait_for_db
# ---------------------------------------------------------------------------

class TestWaitForDb:

    def test_returns_immediately_when_schema_ready(self, monkeypatch):
        cur  = _make_cursor(fetchone_return=(1,))
        conn = MagicMock()
        conn.cursor.return_value = cur
        conn.close = MagicMock()

        monkeypatch.setattr(worker, "get_conn", lambda: conn)
        monkeypatch.setattr("time.sleep", lambda *a: None)

        worker.wait_for_db(retries=3, delay=0)
        conn.close.assert_called_once()

    def test_retries_when_schema_not_ready(self, monkeypatch):
        call_count = {"n": 0}

        def fake_get_conn():
            call_count["n"] += 1
            cur = MagicMock()
            cur.__enter__ = lambda s: s
            cur.__exit__  = MagicMock(return_value=False)
            cur.fetchone.return_value = (1,) if call_count["n"] >= 3 else None
            conn = MagicMock()
            conn.cursor.return_value = cur
            conn.close = MagicMock()
            return conn

        monkeypatch.setattr(worker, "get_conn", fake_get_conn)
        monkeypatch.setattr("time.sleep", lambda *a: None)

        worker.wait_for_db(retries=5, delay=0)
        assert call_count["n"] == 3

    def test_raises_systemexit_after_all_retries(self, monkeypatch):
        def _boom():
            raise Exception("connection refused")

        monkeypatch.setattr(worker, "get_conn", _boom)
        monkeypatch.setattr("time.sleep", lambda *a: None)

        with pytest.raises(SystemExit):
            worker.wait_for_db(retries=3, delay=0)

    def test_raises_systemexit_when_schema_never_appears(self, monkeypatch):
        def fake_get_conn():
            cur = MagicMock()
            cur.__enter__ = lambda s: s
            cur.__exit__  = MagicMock(return_value=False)
            cur.fetchone.return_value = None
            conn = MagicMock()
            conn.cursor.return_value = cur
            conn.close = MagicMock()
            return conn

        monkeypatch.setattr(worker, "get_conn", fake_get_conn)
        monkeypatch.setattr("time.sleep", lambda *a: None)

        with pytest.raises(SystemExit):
            worker.wait_for_db(retries=3, delay=0)
