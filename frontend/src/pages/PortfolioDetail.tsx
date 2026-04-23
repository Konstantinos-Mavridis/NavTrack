import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ApplyTemplateBuyResult, Portfolio, ValuationResult, Transaction } from '../types';
import {
  Spinner, ErrorBanner, StatCard, PnlCell, AssetClassChip, EmptyState, txBadgeColor,
} from '../components/ui';
import AllocationChart from '../components/AllocationChart';
import TransactionFormModal from '../components/TransactionFormModal';
import TemplateBuyModal from '../components/TemplateBuyModal';
import PortfolioFormModal from '../components/PortfolioFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { fmtEur, fmtUnits, today } from '../utils/format';

type Tab = 'positions' | 'transactions';
type ModalState =
  | { type: 'addTxn' }
  | { type: 'buyTemplate' }
  | { type: 'editTxn'; transaction: Transaction }
  | { type: 'deleteTxn'; transaction: Transaction }
  | { type: 'deleteAllTxn' }
  | { type: 'editPortfolio' }
  | { type: 'deletePortfolio' };

// Table-only display label — keeps the full name everywhere else in the UI
const TX_TABLE_LABEL: Partial<Record<string, string>> = {
  FEE_CONSOLIDATION: 'FEE',
};

function txTableLabel(type: string): string {
  return TX_TABLE_LABEL[type] ?? type.replace(/_/g, ' ');
}

// Show explicit +/- prefix on units only for FEE_CONSOLIDATION rows
function fmtTxUnits(units: number | string, type: string): string {
  const n = Number(units);
  if (type === 'FEE_CONSOLIDATION') {
    return (n >= 0 ? '+' : '') + fmtUnits(n);
  }
  return fmtUnits(n);
}

export default function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [portfolio,    setPortfolio]    = useState<Portfolio | null>(null);
  const [valuation,    setValuation]    = useState<ValuationResult | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [date,         setDate]         = useState('');
  const [tab,          setTab]          = useState<Tab>('positions');
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState('');
  const [modal,        setModal]        = useState<ModalState | null>(null);

  const valuationDateRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function reload(targetDate?: string) {
    if (!id) return;
    const [p, v, t] = await Promise.all([
      api.portfolios.get(id),
      api.valuation.get(id, targetDate),
      api.transactions.list(id),
    ]);
    setPortfolio(p);
    setValuation(v);
    setDate((prev) => prev || v.date);
    setTransactions(t);
  }

  useEffect(() => {
    if (!id) return;
    reload().catch((e) => setError(e.message)).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchValuation = useCallback(async (targetDate: string) => {
    if (!id || !targetDate) return;
    valuationDateRef.current = targetDate;
    const token = targetDate;
    setRefreshing(true);
    try {
      const v = await api.valuation.get(id, targetDate);
      if (valuationDateRef.current === token) setValuation(v);
    } catch (e: any) {
      if (valuationDateRef.current === token) setError(e.message);
    } finally {
      if (valuationDateRef.current === token) setRefreshing(false);
    }
  }, [id]);

  function handleDateChange(newDate: string) {
    setDate(newDate);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchValuation(newDate), 300);
  }

  async function autoRecalculate(portfolioId: string, valuationDate: string) {
    try {
      await api.positions.recalculate(portfolioId);
      const v = await api.valuation.get(portfolioId, valuationDate);
      if (valuationDateRef.current === valuationDate || valuationDateRef.current === '') {
        setValuation(v);
      }
    } catch {}
  }

  function handleTxnSaved(t: Transaction) {
    setModal(null);
    if (modal?.type === 'editTxn') {
      setTransactions((prev) => prev.map((x) => x.id === t.id ? t : x));
    } else {
      setTransactions((prev) => [t, ...prev]);
    }
    if (id) autoRecalculate(id, date);
  }

  function handleTemplateBuySaved(result: ApplyTemplateBuyResult) {
    setModal(null);
    setTransactions((prev) => [...result.transactions, ...prev]);
    if (id) autoRecalculate(id, date);
  }

  async function handleDeleteTxn() {
    if (modal?.type !== 'deleteTxn' || !id) return;
    await api.transactions.delete(id, modal.transaction.id);
    setTransactions((prev) => prev.filter((x) => x.id !== modal.transaction.id));
    setModal(null);
    autoRecalculate(id, date);
  }

  async function handleClearAllTxn() {
    if (!id) return;
    await api.transactions.clearAll(id);
    setTransactions([]);
    setModal(null);
    autoRecalculate(id, date);
  }

  function handlePortfolioSaved(p: Portfolio) {
    setPortfolio(p);
    setModal(null);
  }

  async function handleDeletePortfolio() {
    if (!id) return;
    await api.portfolios.delete(id);
    navigate('/');
  }

  if (loading)  return <Spinner />;
  if (error)    return <div className="p-6"><ErrorBanner message={error} /></div>;
  if (!valuation || !portfolio) return null;

  const pnlAccent    = valuation.unrealisedPnl >= 0 ? 'positive' : 'negative';
  const hasPositions = valuation.positions.length > 0;
  const hasData      = hasPositions || transactions.length > 0;
  const maxDate      = valuation.latestNavDate ?? today();

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-2">
        <Link to="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Portfolios</Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium">{portfolio.name}</span>
      </div>

      <div className="space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{portfolio.name}</h1>
            {portfolio.description && (
              <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">{portfolio.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button onClick={() => setModal({ type: 'editPortfolio' })} className="btn-secondary flex items-center gap-1.5">
              ✎ Edit
            </button>
            <button
              onClick={() => setModal({ type: 'deletePortfolio' })}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Date selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-gray-500 dark:text-gray-400 font-medium">Valuation as of</label>
          <input type="date" value={date} max={maxDate} onChange={(e) => handleDateChange(e.target.value)} className="input w-40" />
          {refreshing && <span className="text-xs text-gray-400 dark:text-gray-500 animate-pulse">Updating…</span>}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Value"    value={`€${fmtEur(valuation.totalValue)}`} sub={`as of ${valuation.date}`} />
          <StatCard label="Total Cost"     value={`€${fmtEur(valuation.totalCost)}`} />
          <StatCard
            label="Unrealised P&L"
            value={`${valuation.unrealisedPnl >= 0 ? '+' : ''}€${fmtEur(valuation.unrealisedPnl)}`}
            accent={pnlAccent}
          />
          <StatCard
            label="Return"
            value={`${valuation.unrealisedPnlPct >= 0 ? '+' : ''}${valuation.unrealisedPnlPct.toFixed(2)}%`}
            accent={pnlAccent}
          />
        </div>

        {/* Onboarding card */}
        {!hasData && (
          <div className="card p-8 text-center border-dashed dark:border-gray-700">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">No positions yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              Add transactions below and positions will be calculated automatically.
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              <button onClick={() => setModal({ type: 'addTxn' })}     className="btn-primary">+ Add First Transaction</button>
              <button onClick={() => setModal({ type: 'buyTemplate' })} className="btn-secondary">+ Template Buy</button>
            </div>
          </div>
        )}

        {/* Allocation charts */}
        {hasPositions && (
          <div className="grid md:grid-cols-2 gap-5">
            <AllocationChart data={valuation.allocationByAssetClass} title="By Asset Class" />
            <AllocationChart
              data={Object.fromEntries(
                valuation.positions.filter((p) => p.weightPct != null).map((p) => [p.instrumentName, p.weightPct!]),
              )}
              labelMap={Object.fromEntries(valuation.positions.map((p) => [p.instrumentName, p.instrumentName]))}
              colorMap={Object.fromEntries(valuation.positions.map((p, i) => [p.instrumentName, PALETTE[i % PALETTE.length]]))}
              title="By Instrument"
            />
          </div>
        )}

        {/* Positions / Transactions tab card */}
        {hasData && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-2">
              <div className="flex">
                {(['positions', 'transactions'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-5 py-3.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                      tab === t
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {t}
                    <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      {t === 'positions' ? valuation.positions.length : transactions.length}
                    </span>
                  </button>
                ))}
              </div>
              {tab === 'transactions' && (
                <div className="flex items-center gap-2 pr-2">
                  <button onClick={() => setModal({ type: 'buyTemplate' })} className="btn-secondary text-sm py-1.5">+ Template Buy</button>
                  <button onClick={() => setModal({ type: 'addTxn' })}      className="btn-primary   text-sm py-1.5">+ Add Transaction</button>
                </div>
              )}
            </div>

            {/* ── Positions tab ── */}
            {tab === 'positions' && (
              valuation.positions.length === 0
                ? <EmptyState message="No positions yet. Add transactions and they will appear here automatically." />
                : (
                  <div className="overflow-x-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800/60">
                        <tr>
                          {['Fund', 'ISIN', 'Asset Class', 'Units', 'NAV (EUR)', 'Value (EUR)', 'Cost (EUR)', 'P&L (EUR)', 'Weight'].map((h) => (
                            <th key={h} className="table-th whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {[...valuation.positions].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map((pos) => (
                          <tr key={pos.positionId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="table-td font-medium max-w-xs">
                              <Link
                                to={`/instruments/${pos.instrumentId}`}
                                className="truncate block text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title={pos.instrumentName}
                              >
                                {pos.instrumentName}
                              </Link>
                            </td>
                            <td className="table-td font-mono text-xs text-gray-400 dark:text-gray-500">{pos.isin}</td>
                            <td className="table-td"><AssetClassChip ac={pos.assetClass} /></td>
                            <td className="table-td tabular-nums">{fmtUnits(pos.units)}</td>
                            <td className="table-td tabular-nums">{pos.nav != null ? fmtEur(pos.nav, 4) : '—'}</td>
                            <td className="table-td tabular-nums font-semibold">{pos.value != null ? `€${fmtEur(pos.value)}` : '—'}</td>
                            <td className="table-td tabular-nums text-gray-500 dark:text-gray-400">{pos.cost != null ? `€${fmtEur(pos.cost)}` : '—'}</td>
                            <td className="table-td"><PnlCell value={pos.pnl} /></td>
                            <td className="table-td text-gray-600 dark:text-gray-400 font-medium">{pos.weightPct != null ? `${pos.weightPct.toFixed(1)}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-gray-800/60 border-t border-gray-100 dark:border-gray-800 font-semibold">
                        <tr>
                          <td colSpan={5} className="table-td text-gray-700 dark:text-gray-300">Total</td>
                          <td className="table-td">€{fmtEur(valuation.totalValue)}</td>
                          <td className="table-td text-gray-500 dark:text-gray-400">€{fmtEur(valuation.totalCost)}</td>
                          <td className="table-td"><PnlCell value={valuation.unrealisedPnl} /></td>
                          <td className="table-td text-gray-600 dark:text-gray-400">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
            )}

            {/* ── Transactions tab ── */}
            {tab === 'transactions' && (
              transactions.length === 0
                ? <EmptyState message="No transactions yet. Use the buttons above to add your first transaction." />
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800/60">
                        <tr>
                          {['Date', 'Fund', 'Type', 'Units', 'Price (EUR)', 'Fees (EUR)', 'Total (EUR)', ''].map((h) => (
                            <th key={h} className="table-th whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {transactions.map((tx) => {
                          const isFee = tx.type === 'FEE_CONSOLIDATION';
                          const total = Number(tx.units) * Number(tx.pricePerUnit) + Number(tx.fees);
                          return (
                            <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                              <td className="table-td font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{tx.tradeDate}</td>
                              <td className="table-td font-medium text-gray-800 dark:text-gray-200 max-w-[14rem]">
                                <div className="truncate" title={tx.instrument?.name}>{tx.instrument?.name ?? '—'}</div>
                              </td>
                              <td className="table-td">
                                <span className={`badge ${txBadgeColor(tx.type)}`}>{txTableLabel(tx.type)}</span>
                              </td>
                              <td className={`table-td tabular-nums ${
                                isFee
                                  ? Number(tx.units) >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                    : 'text-red-500 dark:text-red-400 font-medium'
                                  : ''
                              }`}>
                                {fmtTxUnits(tx.units, tx.type)}
                              </td>
                              <td className="table-td tabular-nums">{isFee ? '—' : fmtEur(tx.pricePerUnit, 6)}</td>
                              <td className="table-td tabular-nums text-gray-500 dark:text-gray-400">{isFee ? '—' : fmtEur(tx.fees)}</td>
                              <td className="table-td tabular-nums font-medium">{isFee ? '—' : `€${fmtEur(total)}`}</td>
                              <td className="table-td">
                                <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => setModal({ type: 'editTxn', transaction: tx })}
                                    className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors text-xs"
                                    title="Edit"
                                  >✎</button>
                                  <button
                                    onClick={() => setModal({ type: 'deleteTxn', transaction: tx })}
                                    className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors text-xs"
                                    title="Delete"
                                  >✕</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
            )}

            {tab === 'transactions' && transactions.length > 0 && (
              <div className="flex items-center justify-end px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setModal({ type: 'deleteAllTxn' })}
                  className="px-3 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Modals ── */}
      {modal?.type === 'addTxn' && id && (
        <TransactionFormModal portfolioId={id} onSaved={handleTxnSaved} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'buyTemplate' && id && (
        <TemplateBuyModal portfolioId={id} valuationDate={date} onSaved={handleTemplateBuySaved} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'editTxn' && id && (
        <TransactionFormModal portfolioId={id} transaction={modal.transaction} onSaved={handleTxnSaved} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'deleteTxn' && (
        <ConfirmDialog
          title="Delete Transaction"
          message={`Delete the ${modal.transaction.type} of ${fmtUnits(modal.transaction.units)} units on ${modal.transaction.tradeDate}?`}
          confirmLabel="Delete"
          onConfirm={handleDeleteTxn}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'deleteAllTxn' && (
        <ConfirmDialog
          title="Clear All Transactions"
          message="This will permanently delete all transactions for this portfolio."
          confirmLabel="Clear All Transactions"
          onConfirm={handleClearAllTxn}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'editPortfolio' && (
        <PortfolioFormModal portfolio={portfolio} onSaved={handlePortfolioSaved} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'deletePortfolio' && (
        <ConfirmDialog
          title="Delete Portfolio"
          message={`Permanently delete \u201c${portfolio.name}\u201d and all its positions and transactions?`}
          confirmLabel="Delete Portfolio"
          onConfirm={handleDeletePortfolio}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

const PALETTE = [
  '#3b82f6','#6366f1','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316',
];
