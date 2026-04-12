import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type {
  Portfolio, ValuationResult, AggregatePortfolioValuePoint, PerformanceRange,
} from '../types';
import { Spinner, ErrorBanner } from '../components/ui';
import PortfolioFormModal from '../components/PortfolioFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import PortfolioAggregateChart from '../components/PortfolioAggregateChart';
import PortfolioImportExport from '../components/PortfolioImportExport';
import { fmtEur, fmtPct, today } from '../utils/format';

interface PortfolioRow extends Portfolio {
  valuation?: ValuationResult;
  valLoading: boolean;
  valError?: string;
}

type Modal = { type: 'create' } | { type: 'edit'; portfolio: Portfolio } | { type: 'delete'; portfolio: Portfolio };

const RANGE_DAYS: Record<PerformanceRange, number | undefined> = {
  '1M':  30,
  '3M':  90,
  '6M':  180,
  '1Y':  365,
  'ALL': undefined,
};

export default function PortfolioList() {
  const navigate = useNavigate();
  const [rows,    setRows]    = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [modal,   setModal]   = useState<Modal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [aggregateSeries, setAggregateSeries] = useState<AggregatePortfolioValuePoint[]>([]);
  const [aggregateLoading, setAggregateLoading] = useState(true);
  const [aggregateError, setAggregateError] = useState('');
  const [selectedRange, setSelectedRange] = useState<PerformanceRange>('1M');
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  async function loadAggregateSeries(
    range: PerformanceRange,
    currentRows: PortfolioRow[],
    excluded: Set<string>,
  ) {
    const ids =
      excluded.size === 0
        ? undefined
        : currentRows.map((r) => r.id).filter((id) => !excluded.has(id));

    if (ids !== undefined && ids.length === 0) {
      setAggregateSeries([]);
      setAggregateLoading(false);
      setAggregateError('');
      return;
    }

    setAggregateLoading(true);
    setAggregateError('');
    try {
      const series = await api.portfolios.aggregateSeries(RANGE_DAYS[range], today(), ids);
      setAggregateSeries(series);
    } catch (e: any) {
      setAggregateError(e.message);
    } finally {
      setAggregateLoading(false);
    }
  }

  async function loadPortfolios() {
    try {
      const portfolios = await api.portfolios.list();
      const initialRows = portfolios.map((p) => ({ ...p, valLoading: true }));
      setRows(initialRows);
      setLoading(false);
      if (portfolios.length === 0) {
        setAggregateSeries([]);
        setAggregateLoading(false);
        setAggregateError('');
      }
      portfolios.forEach(async (p) => {
        try {
          const v = await api.valuation.get(p.id, today());
          setRows((prev) => prev.map((r) => r.id === p.id ? { ...r, valuation: v, valLoading: false } : r));
        } catch (e: any) {
          setRows((prev) => prev.map((r) => r.id === p.id ? { ...r, valLoading: false, valError: e.message } : r));
        }
      });
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  useEffect(() => { loadPortfolios(); }, []);

  useEffect(() => {
    if (rows.length > 0) void loadAggregateSeries(selectedRange, rows, excludedIds);
  }, [rows.length, selectedRange, excludedIds]);

  function handleSaved(p: Portfolio) {
    setModal(null);
    if (modal?.type === 'create') {
      navigate(`/portfolios/${p.id}`);
    } else {
      setRows((prev) => prev.map((r) => r.id === p.id ? { ...r, ...p } : r));
    }
  }

  async function handleDelete() {
    if (modal?.type !== 'delete') return;
    setDeleting(true);
    try {
      await api.portfolios.delete(modal.portfolio.id);
      const remaining = rows.filter((r) => r.id !== modal.portfolio.id);
      setRows(remaining);
      setExcludedIds((prev) => {
        const next = new Set(prev);
        next.delete(modal.portfolio.id);
        return next;
      });
      if (remaining.length === 0) {
        setAggregateSeries([]);
        setAggregateLoading(false);
        setAggregateError('');
      }
      setModal(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  function toggleExcluded(id: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (loading) return <Spinner />;
  if (error)   return <div className="p-6"><ErrorBanner message={error} /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Portfolios</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of all tracked model portfolios</p>
        </div>
        <div className="flex items-center gap-2">
          <PortfolioImportExport onImported={loadPortfolios} />
          <button onClick={() => setModal({ type: 'create' })} className="btn-primary flex items-center gap-2">
            <span className="text-lg leading-none">+</span> New Portfolio
          </button>
        </div>
      </div>

      {/* Aggregate history chart */}
      {rows.length > 0 && (
        <div className="mb-8">
          <PortfolioAggregateChart
            data={aggregateSeries}
            loading={aggregateLoading}
            error={aggregateError}
            selectedRange={selectedRange}
            onRangeChange={setSelectedRange}
          />
        </div>
      )}

      {/* Portfolio cards */}
      {rows.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          <p className="text-5xl mb-4">📂</p>
          <p className="text-lg font-medium mb-2 text-gray-600 dark:text-gray-400">No portfolios yet</p>
          <p className="text-sm mb-6">Create your first portfolio to get started.</p>
          <button onClick={() => setModal({ type: 'create' })} className="btn-primary">
            Create Portfolio
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {rows.map((row) => {
            const v = row.valuation;
            const pnlPositive = (v?.unrealisedPnl ?? 0) >= 0;
            const isIncluded = !excludedIds.has(row.id);
            return (
              <div
                key={row.id}
                className={`card p-6 hover:shadow-md transition-all group relative ${
                  isIncluded
                    ? 'hover:border-blue-200 dark:hover:border-blue-800'
                    : 'opacity-60'
                }`}
              >
                {/*
                  Top-right column: edit/delete (hover-only) on the first row,
                  then INCLUDE label + slider directly below.
                */}
                <div className="absolute top-4 right-4 flex flex-col items-center gap-1.5">
                  {/* Edit / delete row */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.preventDefault(); setModal({ type: 'edit', portfolio: row }); }}
                      className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors"
                      title="Edit portfolio"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); setModal({ type: 'delete', portfolio: row }); }}
                      className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
                      title="Delete portfolio"
                    >
                      ✕
                    </button>
                  </div>

                  {/* INCLUDE label + toggle */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide leading-none">
                      Include
                    </span>
                    <button
                      onClick={(e) => { e.preventDefault(); toggleExcluded(row.id); }}
                      title={isIncluded ? 'Exclude from Total Portfolio' : 'Include in Total Portfolio'}
                      aria-label={isIncluded ? 'Exclude from Total Portfolio' : 'Include in Total Portfolio'}
                      aria-pressed={isIncluded}
                    >
                      <span
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                          isIncluded
                            ? 'bg-blue-500 dark:bg-blue-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                            isIncluded ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                </div>

                <Link to={`/portfolios/${row.id}`} className="block">
                  {/* pr-16 keeps title clear of the right-side controls */}
                  <div className="mb-4 pr-16">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {row.name}
                    </h2>
                    {row.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2">{row.description}</p>
                    )}
                  </div>

                  {row.valLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                      <div className="h-3 w-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                      Loading valuation…
                    </div>
                  ) : row.valError ? (
                    <p className="text-xs text-red-400 dark:text-red-500">{row.valError}</p>
                  ) : v ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Total Value</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">€{fmtEur(v.totalValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Unrealised P&L</p>
                        <p className={`text-xl font-bold mt-0.5 ${pnlPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {pnlPositive ? '+' : ''}€{fmtEur(v.unrealisedPnl)}
                        </p>
                        <p className={`text-xs mt-0.5 ${pnlPositive ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-400 dark:text-red-500'}`}>
                          {fmtPct(v.unrealisedPnlPct)}
                        </p>
                      </div>
                      <div className="col-span-2 mt-1">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                          {v.positions.length} position{v.positions.length !== 1 ? 's' : ''}
                        </p>
                        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex">
                          {v.positions
                            .filter((p) => p.weightPct && p.weightPct > 0)
                            .sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0))
                            .map((p) => (
                              <div
                                key={p.positionId}
                                style={{ width: `${p.weightPct}%`, backgroundColor: acColor(p.assetClass) }}
                                title={`${p.instrumentName}: ${p.weightPct}%`}
                              />
                            ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500">No positions yet — add transactions to get started.</p>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'create' && (
        <PortfolioFormModal onSaved={handleSaved} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <PortfolioFormModal portfolio={modal.portfolio} onSaved={handleSaved} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Delete Portfolio"
          message={`Are you sure you want to delete "${modal.portfolio.name}"? This will also delete all positions and transactions.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete Portfolio'}
          onConfirm={handleDelete}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

function acColor(ac: string): string {
  const m: Record<string, string> = {
    GREEK_EQUITY: '#3b82f6', GLOBAL_EQUITY: '#6366f1',
    GREEK_GOV_BOND: '#10b981', GREEK_CORP_BOND: '#34d399',
    GLOBAL_BOND: '#f59e0b', HIGH_YIELD: '#ef4444',
    FUND_OF_FUNDS: '#8b5cf6', ABSOLUTE_RETURN: '#ec4899',
    RESERVE_MONEY_MARKET: '#94a3b8',
  };
  return m[ac] ?? '#cbd5e1';
}
