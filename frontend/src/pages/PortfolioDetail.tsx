import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ApplyTemplateBuyResult, Portfolio, ValuationResult, Transaction } from '../types';
import {
  Spinner, ErrorBanner, StatCard, PnlCell, AssetClassChip, EmptyState,
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
  | { type: 'deletePortfolio' }
  | { type: 'recalculate' };

export default function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [portfolio,     setPortfolio]     = useState<Portfolio | null>(null);
  const [valuation,     setValuation]     = useState<ValuationResult | null>(null);
  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [date,          setDate]          = useState(today());
  const [tab,           setTab]           = useState<Tab>('positions');
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [error,         setError]         = useState('');
  const [modal,         setModal]         = useState<ModalState | null>(null);
  const [actionWorking, setActionWorking] = useState(false);

  async function reload() {
    if (!id) return;
    const [p, v, t] = await Promise.all([
      api.portfolios.get(id),
      api.valuation.get(id, today()),
      api.transactions.list(id),
    ]);
    setPortfolio(p);
    setValuation(v);
    setDate(v.date);
    setTransactions(t);
  }

  useEffect(() => {
    if (!id) return;
    reload().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  const handleDateRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      setValuation(await api.valuation.get(id, date));
    } catch (e: any) { setError(e.message); }
    finally { setRefreshing(false); }
  }, [id, date]);

  // ── Transaction actions ────────────────────────────────────────────────────
  function handleTxnSaved(t: Transaction) {
    setModal(null);
    if (modal?.type === 'editTxn') {
      setTransactions((prev) => prev.map((x) => x.id === t.id ? t : x));
    } else {
      setTransactions((prev) => [t, ...prev]);
    }
    // Refresh valuation since positions may have changed
    if (id) api.valuation.get(id, date).then(setValuation).catch(() => {});
  }

  function handleTemplateBuySaved(result: ApplyTemplateBuyResult) {
    setModal(null);
    setTransactions((prev) => [...result.transactions, ...prev]);
    if (id) api.valuation.get(id, date).then(setValuation).catch(() => {});
  }

  async function handleDeleteTxn() {
    if (modal?.type !== 'deleteTxn' || !id) return;
    setActionWorking(true);
    try {
      await api.transactions.delete(id, modal.transaction.id);
      setTransactions((prev) => prev.filter((x) => x.id !== modal.transaction.id));
      setModal(null);
      api.valuation.get(id, date).then(setValuation).catch(() => {});
    } catch (e: any) { setError(e.message); }
    finally { setActionWorking(false); }
  }

  async function handleClearAllTxn() {
    if (!id) return;
    setActionWorking(true);
    try {
      await api.transactions.clearAll(id);
      setTransactions([]);
      setModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setActionWorking(false); }
  }

  // ── Portfolio actions ──────────────────────────────────────────────────────
  function handlePortfolioSaved(p: Portfolio) {
    setPortfolio(p);
    setModal(null);
  }

  async function handleDeletePortfolio() {
    if (!id) return;
    setActionWorking(true);
    try {
      await api.portfolios.delete(id);
      navigate('/');
    } catch (e: any) { setError(e.message); setActionWorking(false); }
  }

  async function handleRecalculate() {
    if (!id) return;
    setActionWorking(true);
    try {
      await api.positions.recalculate(id);
      const v = await api.valuation.get(id, date);
      setValuation(v);
      setModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setActionWorking(false); }
  }

  if (loading)  return <Spinner />;
  if (error)    return <div className="p-6"><ErrorBanner message={error} /></div>;
  if (!valuation || !portfolio) return null;

  const pnlAccent = valuation.unrealisedPnl >= 0 ? 'positive' : 'negative';
  const hasPositions = valuation.positions.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/" className="hover:text-blue-600 transition-colors">Portfolios</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{portfolio.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{portfolio.name}</h1>
          {portfolio.description && (
            <p className="text-gray-500 mt-1 max-w-2xl">{portfolio.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => setModal({ type: 'editPortfolio' })}
            className="btn-secondary flex items-center gap-1.5"
          >
            ✎ Edit
          </button>
          <button
            onClick={() => setModal({ type: 'deletePortfolio' })}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Date selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-sm text-gray-500 font-medium">Valuation as of</label>
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
          className="input w-40"
        />
        <button onClick={handleDateRefresh} disabled={refreshing} className="btn-primary">
          {refreshing ? 'Loading…' : 'Update'}
        </button>
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

      {/* No data banner */}
      {!hasPositions && (
        <div className="card p-8 text-center border-dashed">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold text-gray-700 mb-1">No positions yet</p>
          <p className="text-sm text-gray-400 mb-4">
            Add transactions below, then click "Recalculate Positions" to derive your holdings.
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            <button
              onClick={() => setModal({ type: 'addTxn' })}
              className="btn-primary"
            >
              + Add First Transaction
            </button>
            <button
              onClick={() => setModal({ type: 'buyTemplate' })}
              className="btn-secondary"
            >
              + Buy Template
            </button>
          </div>
        </div>
      )}

      {/* Allocation charts — only when there is data */}
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

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-2">
          <div className="flex">
            {(['positions', 'transactions'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  tab === t
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
                <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                  {t === 'positions' ? valuation.positions.length : transactions.length}
                </span>
              </button>
            ))}
          </div>

          {/* Tab actions */}
          <div className="flex items-center gap-2 px-3">
            {tab === 'transactions' && (
              <>
                <button onClick={() => setModal({ type: 'addTxn' })} className="btn-primary text-sm py-1.5">
                  + Add Transaction
                </button>
                <button onClick={() => setModal({ type: 'buyTemplate' })} className="btn-secondary text-sm py-1.5">
                  + Buy Template
                </button>
                {transactions.length > 0 && (
                  <button
                    onClick={() => setModal({ type: 'deleteAllTxn' })}
                    className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    title="Clear all transactions (demo data reset)"
                  >
                    Clear All
                  </button>
                )}
              </>
            )}
            {tab === 'positions' && transactions.length > 0 && (
              <button
                onClick={() => setModal({ type: 'recalculate' })}
                className="btn-secondary text-sm py-1.5"
                title="Recalculate positions from transaction ledger"
              >
                ⟳ Recalculate from Transactions
              </button>
            )}
          </div>
        </div>

        {/* ── Positions tab ── */}
        {tab === 'positions' && (
          valuation.positions.length === 0
            ? <EmptyState message="No positions. Add transactions and click 'Recalculate from Transactions'." />
            : (
              <div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Fund', 'ISIN', 'Asset Class', 'Units', 'NAV (EUR)', 'Value (EUR)', 'Cost (EUR)', 'P&L (EUR)', 'Weight', ''].map((h) => (
                        <th key={h} className="table-th whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...valuation.positions].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map((pos) => (
                      <tr key={pos.positionId} className="group hover:bg-gray-50 transition-colors">
                        <td className="table-td font-medium text-gray-900 max-w-xs">
                          <div className="truncate" title={pos.instrumentName}>{pos.instrumentName}</div>
                        </td>
                        <td className="table-td font-mono text-xs text-gray-400">{pos.isin}</td>
                        <td className="table-td"><AssetClassChip ac={pos.assetClass} /></td>
                        <td className="table-td tabular-nums">{fmtUnits(pos.units)}</td>
                        <td className="table-td tabular-nums">{pos.nav != null ? fmtEur(pos.nav, 4) : '—'}</td>
                        <td className="table-td tabular-nums font-semibold">{pos.value != null ? `€${fmtEur(pos.value)}` : '—'}</td>
                        <td className="table-td tabular-nums text-gray-500">{pos.cost != null ? `€${fmtEur(pos.cost)}` : '—'}</td>
                        <td className="table-td"><PnlCell value={pos.pnl} /></td>
                        <td className="table-td text-gray-600 font-medium">{pos.weightPct != null ? `${pos.weightPct.toFixed(1)}%` : '—'}</td>
                        <td className="table-td">
                          <Link
                            to={`/instruments/${pos.instrumentId}`}
                            className="text-blue-500 hover:text-blue-700 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-100 font-semibold">
                    <tr>
                      <td colSpan={5} className="table-td text-gray-700">Total</td>
                      <td className="table-td">€{fmtEur(valuation.totalValue)}</td>
                      <td className="table-td text-gray-500">€{fmtEur(valuation.totalCost)}</td>
                      <td className="table-td"><PnlCell value={valuation.unrealisedPnl} /></td>
                      <td className="table-td text-gray-600">100%</td>
                      <td className="table-td" />
                    </tr>
                  </tfoot>
                </table>
                </div>
              </div>
            )
        )}

        {/* ── Transactions tab ── */}
        {tab === 'transactions' && (
          transactions.length === 0
            ? (
              <div className="py-16 text-center text-gray-400">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-sm mb-4">No transactions yet</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  <button onClick={() => setModal({ type: 'addTxn' })} className="btn-primary text-sm">
                    + Add First Transaction
                  </button>
                  <button onClick={() => setModal({ type: 'buyTemplate' })} className="btn-secondary text-sm">
                    + Buy Template
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Date', 'Type', 'Fund', 'Units', 'Price (EUR)', 'Fees (EUR)', 'Total (EUR)', ''].map((h) => (
                        <th key={h} className="table-th whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map((tx) => {
                      const total = Number(tx.units) * Number(tx.pricePerUnit) + Number(tx.fees);
                      return (
                        <tr key={tx.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="table-td font-mono text-xs text-gray-500 whitespace-nowrap">{tx.tradeDate}</td>
                          <td className="table-td">
                            <span className={`badge ${txColor(tx.type)}`}>{tx.type.replace('_', ' ')}</span>
                          </td>
                          <td className="table-td font-medium text-gray-800 max-w-[14rem]">
                            <div className="truncate" title={tx.instrument?.name}>{tx.instrument?.name ?? '—'}</div>
                          </td>
                          <td className="table-td tabular-nums">{fmtUnits(tx.units)}</td>
                          <td className="table-td tabular-nums">{fmtEur(tx.pricePerUnit, 6)}</td>
                          <td className="table-td tabular-nums text-gray-500">{fmtEur(tx.fees)}</td>
                          <td className="table-td tabular-nums font-medium">€{fmtEur(total)}</td>
                          <td className="table-td">
                            <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setModal({ type: 'editTxn', transaction: tx })}
                                className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-xs"
                                title="Edit"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => setModal({ type: 'deleteTxn', transaction: tx })}
                                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors text-xs"
                                title="Delete"
                              >
                                ✕
                              </button>
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
      </div>

      {/* ── Modals ── */}
      {modal?.type === 'addTxn' && id && (
        <TransactionFormModal portfolioId={id} onSaved={handleTxnSaved} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'buyTemplate' && id && (
        <TemplateBuyModal
          portfolioId={id}
          valuationDate={date}
          onSaved={handleTemplateBuySaved}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'editTxn' && id && (
        <TransactionFormModal
          portfolioId={id}
          transaction={modal.transaction}
          onSaved={handleTxnSaved}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'deleteTxn' && (
        <ConfirmDialog
          title="Delete Transaction"
          message={`Delete the ${modal.transaction.type} of ${fmtUnits(modal.transaction.units)} units on ${modal.transaction.tradeDate}?`}
          confirmLabel={actionWorking ? 'Deleting…' : 'Delete'}
          onConfirm={handleDeleteTxn}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'deleteAllTxn' && (
        <ConfirmDialog
          title="Clear All Transactions"
          message="This will permanently delete all transactions for this portfolio. This is useful for removing demo seed data before entering real trades."
          confirmLabel={actionWorking ? 'Clearing…' : 'Clear All Transactions'}
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
          message={`Permanently delete "${portfolio.name}" and all its positions and transactions?`}
          confirmLabel={actionWorking ? 'Deleting…' : 'Delete Portfolio'}
          onConfirm={handleDeletePortfolio}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'recalculate' && (
        <ConfirmDialog
          title="Recalculate Positions"
          message="This will replace current positions with values derived from the transaction ledger (summed units, weighted average cost basis). Continue?"
          confirmLabel={actionWorking ? 'Recalculating…' : 'Recalculate'}
          danger={false}
          onConfirm={handleRecalculate}
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

function txColor(type: string) {
  switch (type) {
    case 'BUY':               return 'bg-blue-100 text-blue-700';
    case 'SELL':              return 'bg-red-100 text-red-700';
    case 'SWITCH':            return 'bg-purple-100 text-purple-700';
    case 'DIVIDEND_REINVEST': return 'bg-green-100 text-green-700';
    default:                  return 'bg-gray-100 text-gray-600';
  }
}
