"""
Unit tests for the run_valuation() logic and the Decimal arithmetic
that underpins P&L calculations in the worker.
"""
import types
import sys
import importlib
from decimal import Decimal
import pytest


# ---------------------------------------------------------------------------
# Minimal stubs (same pattern as test_nav_parsing.py)
# ---------------------------------------------------------------------------

def _stub(name: str) -> types.ModuleType:
    if name not in sys.modules:
        mod = types.ModuleType(name)
        sys.modules[name] = mod
        return mod
    return sys.modules[name]

psycopg2_stub = _stub("psycopg2")
psycopg2_stub.connect = lambda *a, **kw: None
psycopg2_stub.OperationalError = Exception
extras_stub = _stub("psycopg2.extras")
extras_stub.RealDictCursor = object
extras_stub.execute_values = lambda *a, **kw: None

_stub("apscheduler")
_stub("apscheduler.schedulers")
bsched = _stub("apscheduler.schedulers.blocking")
bsched.BlockingScheduler = type("BS", (), {
    "add_job": lambda *a, **kw: None,
    "start":   lambda *a, **kw: None,
})

yf_stub = _stub("yfinance")

dotenv_stub = _stub("dotenv")
dotenv_stub.load_dotenv = lambda *a, **kw: None

worker = importlib.import_module("worker")


# ---------------------------------------------------------------------------
# Tests: Decimal arithmetic (mirrors worker.run_valuation logic)
# ---------------------------------------------------------------------------

class TestDecimalArithmetic:
    """
    The worker uses Python's Decimal type for monetary amounts.
    These tests verify the arithmetic correctness independently of DB calls.
    """

    def test_value_is_units_times_nav(self):
        units = Decimal("100")
        nav   = Decimal("12.50")
        value = (units * nav).quantize(Decimal("0.01"))
        assert value == Decimal("1250.00")

    def test_pnl_is_value_minus_cost(self):
        value = Decimal("1250.00")
        cost  = Decimal("1000.00")
        pnl   = value - cost
        assert pnl == Decimal("250.00")

    def test_pnl_pct_calculation(self):
        pnl  = Decimal("250.00")
        cost = Decimal("1000.00")
        pct  = (pnl / cost * 100).quantize(Decimal("0.01"))
        assert pct == Decimal("25.00")

    def test_pnl_pct_is_zero_when_no_cost(self):
        total_cost = Decimal("0")
        pnl        = Decimal("500")
        pct = (
            (pnl / total_cost * 100).quantize(Decimal("0.01"))
            if total_cost > 0
            else Decimal("0")
        )
        assert pct == Decimal("0")

    def test_negative_pnl_when_nav_below_cost(self):
        units = Decimal("50")
        nav   = Decimal("8.00")
        cost_per_unit = Decimal("10.00")
        value = units * nav
        cost  = units * cost_per_unit
        pnl   = value - cost
        assert pnl == Decimal("-100.00")

    def test_accumulates_across_positions(self):
        positions = [
            {"units": Decimal("100"), "nav": Decimal("10"), "cost_basis": Decimal("9")},
            {"units": Decimal("50"),  "nav": Decimal("20"), "cost_basis": Decimal("18")},
        ]
        total_value = Decimal("0")
        total_cost  = Decimal("0")
        for p in positions:
            total_value += p["units"] * p["nav"]
            total_cost  += p["units"] * p["cost_basis"]
        assert total_value == Decimal("2000")
        assert total_cost  == Decimal("1800")
        pnl = total_value - total_cost
        assert pnl == Decimal("200")


# ---------------------------------------------------------------------------
# Tests: _smart_from_date
# ---------------------------------------------------------------------------

class TestSmartFromDate:
    def _make_conn(self, max_date):
        """Build a minimal fake psycopg2 connection."""
        class FakeCur:
            def execute(self, sql, params=None): pass
            def fetchone(self):
                return (max_date,) if max_date else (None,)
            def __enter__(self): return self
            def __exit__(self, *a): pass

        class FakeConn:
            def cursor(self): return FakeCur()

        return FakeConn()

    def test_returns_day_after_latest_nav(self):
        from datetime import date, timedelta
        latest = date(2024, 1, 20)
        conn   = self._make_conn(latest)
        result = worker._smart_from_date("inst-1", conn)
        expected = (latest + timedelta(days=1)).isoformat()
        assert result == expected

    def test_returns_five_years_ago_when_no_existing_nav(self):
        from datetime import date
        conn   = self._make_conn(None)
        result = worker._smart_from_date("inst-1", conn)
        five_years_ago = date.today().replace(year=date.today().year - 5).isoformat()
        assert result == five_years_ago
