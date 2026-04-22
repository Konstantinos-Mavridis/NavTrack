"""
High-impact unit tests for worker orchestration flows:
  - get_conn / check_seed
  - run_valuation
  - run_nav_sync
  - main scheduler/bootstrap behavior

These tests avoid real DB/network calls by patching worker-level functions
and providing lightweight fake cursor/connection objects.
"""
from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

import worker


def _ctx_cursor(*, fetchone: Any = None, fetchall: Any = None, execute_side_effect: Exception | None = None):
    cur = MagicMock()
    cur.__enter__.return_value = cur
    cur.__exit__.return_value = False
    if execute_side_effect is not None:
        cur.execute.side_effect = execute_side_effect
    if fetchone is not None:
        cur.fetchone.return_value = fetchone
    if fetchall is not None:
        cur.fetchall.return_value = fetchall
    return cur


class _RoutingCursor:
    def __init__(self, state: dict[str, Any]):
        self._state = state
        self._sql = ""
        self._params = None

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, sql: str, params: Any = None):
        self._sql = sql
        self._params = params

    def fetchall(self):
        if "FROM portfolios" in self._sql:
            return self._state["portfolios"]
        if "FROM   portfolio_positions" in self._sql or "FROM portfolio_positions" in self._sql:
            pid = self._params[0]
            return self._state["positions"].get(pid, [])
        return []

    def fetchone(self):
        if "FROM nav_prices" in self._sql:
            iid = self._params[0]
            return self._state["nav_rows"].get(iid)
        return None


class _RoutingConn:
    def __init__(self, state: dict[str, Any]):
        self._state = state
        self.close = MagicMock()

    def cursor(self, **_kwargs):
        return _RoutingCursor(self._state)


class TestConnectionAndSeed:
    def test_get_conn_uses_psycopg2_connect_with_dsn(self, monkeypatch):
        connect = MagicMock(return_value="CONN")
        monkeypatch.setattr(worker.psycopg2, "connect", connect)
        monkeypatch.setattr(worker, "dsn", lambda: "host=test")

        result = worker.get_conn()

        assert result == "CONN"
        connect.assert_called_once_with("host=test")

    def test_check_seed_logs_warning_when_no_portfolios(self, monkeypatch):
        cur = _ctx_cursor()
        cur.fetchone.side_effect = [(0,), (11,), (0,)]
        conn = MagicMock()
        conn.cursor.return_value = cur
        conn.close = MagicMock()

        log_warning = MagicMock()
        monkeypatch.setattr(worker, "get_conn", lambda: conn)
        monkeypatch.setattr(worker.log, "warning", log_warning)
        monkeypatch.setattr(worker.log, "info", MagicMock())

        worker.check_seed()

        log_warning.assert_called_once()
        conn.close.assert_called_once()

    def test_check_seed_logs_info_when_seed_present(self, monkeypatch):
        cur = _ctx_cursor()
        cur.fetchone.side_effect = [(2,), (11,), (9,)]
        conn = MagicMock()
        conn.cursor.return_value = cur
        conn.close = MagicMock()

        log_info = MagicMock()
        monkeypatch.setattr(worker, "get_conn", lambda: conn)
        monkeypatch.setattr(worker.log, "info", log_info)
        monkeypatch.setattr(worker.log, "warning", MagicMock())

        worker.check_seed()

        assert any("Seed OK" in call.args[0] for call in log_info.call_args_list)
        conn.close.assert_called_once()


class TestValuationJob:
    def test_run_valuation_aggregates_positions_and_logs_summary(self, monkeypatch):
        state = {
            "portfolios": [
                {"id": "p1", "name": "Core"},
                {"id": "p2", "name": "Satellite"},
            ],
            "positions": {
                "p1": [
                    {"instrument_id": "i1", "units": "10", "cost_basis_per_unit": "2.50"},
                    {"instrument_id": "i2", "units": "5", "cost_basis_per_unit": None},
                    {"instrument_id": "i3", "units": "4", "cost_basis_per_unit": "1.00"},
                ],
                "p2": [],
            },
            "nav_rows": {
                "i1": (3.0,),
                "i2": (1.0,),
                "i3": None,  # no NAV, should be skipped
            },
        }
        conn = _RoutingConn(state)
        log_info = MagicMock()

        monkeypatch.setattr(worker, "get_conn", lambda: conn)
        monkeypatch.setattr(worker.log, "info", log_info)

        worker.run_valuation()

        # One portfolio with 2 priced positions, value=35, cost=25, pnl=10, pnl%=40
        portfolio_line = next(
            c for c in log_info.call_args_list
            if c.args and c.args[0].startswith("  [%s]  priced=%d")
        )
        assert portfolio_line.args[1] == "Core"
        assert portfolio_line.args[2] == 2
        assert str(portfolio_line.args[3]) == "35.00"
        assert str(portfolio_line.args[4]) == "25.00"
        assert str(portfolio_line.args[5]) == "10.00"
        assert str(portfolio_line.args[6]) == "40.00"
        assert any("Valuation job complete" in c.args[0] for c in log_info.call_args_list)
        conn.close.assert_called_once()


class TestNavSync:
    def test_run_nav_sync_mixed_success_and_failure_records_statuses(self, monkeypatch):
        instruments = [
            {"id": "inst-1", "isin": " ISIN-1 ", "name": "Fund A"},
            {"id": "inst-2", "isin": "ISIN-2", "name": "Fund B"},
        ]
        cur = _ctx_cursor(fetchall=instruments)
        conn = MagicMock()
        conn.cursor.return_value = cur
        conn.close = MagicMock()

        statuses = []
        fetch_calls = []

        monkeypatch.setattr(worker, "get_conn", lambda: conn)
        monkeypatch.setattr(worker.time, "sleep", lambda *_: None)
        monkeypatch.setattr(
            worker, "_resolve_ticker",
            lambda isin, _iid, _conn: "AAA.AT" if isin == "ISIN-1" else None,
        )
        monkeypatch.setattr(worker, "_smart_from_date", lambda *_: "2026-04-01")
        monkeypatch.setattr(
            worker, "_fetch_and_upsert",
            lambda t, iid, start, _conn: (fetch_calls.append((t, iid, start)) or (3, 2)),
        )
        monkeypatch.setattr(
            worker, "_record_sync_job",
            lambda _conn, iid, status, fetched, upserted, err, trig: statuses.append(
                (iid, status, fetched, upserted, err, trig)
            ),
        )

        worker.run_nav_sync(triggered_by="MANUAL")

        assert fetch_calls == [("AAA.AT", "inst-1", "2026-04-01")]
        assert statuses[0] == ("inst-1", "SUCCESS", 3, 2, None, "MANUAL")
        assert statuses[1][0] == "inst-2"
        assert statuses[1][1] == "FAILED"
        assert "Could not resolve Yahoo Finance ticker" in statuses[1][4]
        conn.close.assert_called_once()

    def test_run_nav_sync_uses_explicit_from_date(self, monkeypatch):
        instruments = [{"id": "inst-1", "isin": "ISIN-1", "name": "Fund A"}]
        cur = _ctx_cursor(fetchall=instruments)
        conn = MagicMock()
        conn.cursor.return_value = cur
        conn.close = MagicMock()

        fetch_args = []

        monkeypatch.setattr(worker, "get_conn", lambda: conn)
        monkeypatch.setattr(worker.time, "sleep", lambda *_: None)
        monkeypatch.setattr(worker, "_resolve_ticker", lambda *_: "AAA.AT")
        monkeypatch.setattr(
            worker, "_smart_from_date",
            lambda *_: (_ for _ in ()).throw(AssertionError("_smart_from_date should not be used")),
        )
        monkeypatch.setattr(
            worker, "_fetch_and_upsert",
            lambda t, iid, start, _conn: (fetch_args.append((t, iid, start)) or (0, 0)),
        )
        monkeypatch.setattr(worker, "_record_sync_job", lambda *_: None)

        worker.run_nav_sync(triggered_by="API", from_date="2026-02-01")

        assert fetch_args == [("AAA.AT", "inst-1", "2026-02-01")]
        conn.close.assert_called_once()


class TestRollbackPaths:
    def test_fetch_and_upsert_rolls_back_and_raises_on_error(self, monkeypatch):
        class BrokenTicker:
            def history(self, **_kwargs):
                raise RuntimeError("history failed")

        conn = MagicMock()
        conn.rollback = MagicMock()
        monkeypatch.setattr(worker, "yf", type("YF", (), {"Ticker": lambda *_: BrokenTicker()})())

        with pytest.raises(RuntimeError, match="history failed"):
            worker._fetch_and_upsert("AAA.AT", "inst-1", "2026-01-01", conn)

        conn.rollback.assert_called_once()

    def test_record_sync_job_rolls_back_and_raises_on_insert_error(self):
        cur = _ctx_cursor(execute_side_effect=RuntimeError("insert failed"))
        conn = MagicMock()
        conn.cursor.return_value = cur
        conn.rollback = MagicMock()

        with pytest.raises(RuntimeError, match="insert failed"):
            worker._record_sync_job(conn, "inst-1", "FAILED", 0, 0, "x", "MANUAL")

        conn.rollback.assert_called_once()

    def test_resolve_ticker_rolls_back_on_db_error(self, monkeypatch):
        read_cur = _ctx_cursor(fetchone={"external_ids": {}})
        write_cur = _ctx_cursor(execute_side_effect=RuntimeError("update failed"))
        conn = MagicMock()
        conn.cursor.side_effect = [read_cur, write_cur]
        conn.rollback = MagicMock()
        conn.commit = MagicMock()
        monkeypatch.setattr(worker, "_resolve_ticker_with_retry", lambda _isin: "AAA.AT")

        with pytest.raises(RuntimeError, match="update failed"):
            worker._resolve_ticker("ISIN-1", "inst-1", conn)

        conn.rollback.assert_called_once()


class TestMain:
    def test_main_with_startup_sync_registers_jobs_and_handles_keyboard_interrupt(self, monkeypatch):
        wait_for_db = MagicMock()
        check_seed = MagicMock()
        run_valuation = MagicMock()
        run_nav_sync = MagicMock()
        log_info = MagicMock()

        scheduler = MagicMock()
        scheduler.add_job = MagicMock()
        scheduler.start = MagicMock(side_effect=KeyboardInterrupt())

        monkeypatch.setattr(worker, "wait_for_db", wait_for_db)
        monkeypatch.setattr(worker, "check_seed", check_seed)
        monkeypatch.setattr(worker, "run_valuation", run_valuation)
        monkeypatch.setattr(worker, "run_nav_sync", run_nav_sync)
        monkeypatch.setattr(worker.log, "info", log_info)
        monkeypatch.setattr(worker, "SYNC_ON_STARTUP", True)
        monkeypatch.setattr(worker, "BlockingScheduler", lambda **_kwargs: scheduler)

        worker.main()

        wait_for_db.assert_called_once()
        check_seed.assert_called_once()
        run_valuation.assert_called_once()
        run_nav_sync.assert_any_call(triggered_by="WORKER_STARTUP")
        assert scheduler.add_job.call_count == 3
        scheduler.start.assert_called_once()
        assert any("Worker shutting down." in c.args[0] for c in log_info.call_args_list)

        afternoon_job = scheduler.add_job.call_args_list[0].args[0]
        evening_job = scheduler.add_job.call_args_list[1].args[0]
        valuation_job = scheduler.add_job.call_args_list[2].args[0]
        afternoon_job()
        evening_job()

        run_nav_sync.assert_any_call(triggered_by="SCHEDULER_AFTERNOON")
        run_nav_sync.assert_any_call(triggered_by="SCHEDULER_EVENING")
        assert valuation_job is run_valuation

    def test_main_without_startup_sync_logs_skip_message(self, monkeypatch):
        monkeypatch.setattr(worker, "wait_for_db", MagicMock())
        monkeypatch.setattr(worker, "check_seed", MagicMock())
        monkeypatch.setattr(worker, "run_valuation", MagicMock())
        run_nav_sync = MagicMock()
        monkeypatch.setattr(worker, "run_nav_sync", run_nav_sync)
        monkeypatch.setattr(worker, "SYNC_ON_STARTUP", False)

        scheduler = MagicMock()
        scheduler.add_job = MagicMock()
        scheduler.start = MagicMock(side_effect=KeyboardInterrupt())
        monkeypatch.setattr(worker, "BlockingScheduler", lambda **_kwargs: scheduler)

        log_info = MagicMock()
        monkeypatch.setattr(worker.log, "info", log_info)

        worker.main()

        run_nav_sync.assert_not_called()
        assert any("SYNC_ON_STARTUP=false" in c.args[0] for c in log_info.call_args_list)
        assert scheduler.add_job.call_count == 3
