import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type {
  Portfolio, PortfolioPosition, ValuationResult, Transaction, PerformanceRange,
  PositionBreakdown,
} from '../types';
import { Spinner, ErrorBanner } from '../components/ui';
import PortfolioFormModal from '../components/PortfolioFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import TransactionFormModal from '../components/TransactionFormModal';
import PortfolioValueChart from '../components/PortfolioValueChart';
import { fmtEur, fmtPct, today } from '../utils/format';

type Tab = 'positions' | 'transactions';

type TransactionModal =
  | { type: 'create' }
  | { type: 'edit'; transaction: Transaction }
  | { type: 'delete'; transaction: Transaction };

const RANGE_DAYS: Record<PerformanceRange, number | undefined> = {
  '1M':  30,
  '3M':  90,
  '6M':  180,
  '1Y':  365,
  'ALL': undefined,
};

export default function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [portfolio,    setPortfolio]    = useState<Portfolio | null>(null);
  const [valuation,    setValuation]    = useState<ValuationResult | null>(null);
  // positions state is used only for recalculate; display is driven from valuation.positions
  const [,             setPositions]    = useState<PortfolioPosition[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [activeTab,    setActiveTab]    = useState<Tab>('positions');
  const [editModal,    setEditModal]    = useState(false);
  const [deleteModal,  setDeleteModal]  = useState(false);
  const [txModal,      setTxModal]      = useState<TransactionModal | null>(null);
  const [chartSeries,  setChartSeries]  = useState<{ date: string; value: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError,   setChartError]   = useState('');
  const [selectedRange, setSelectedRange] = useState<PerformanceRange>('1M');
  const prevRangeRef = useRef<PerformanceRange>('1M');

  const loadChartSeries = useCallback(async (range: PerformanceRange) => {
    setChartLoading(true);
    setChartError('');
    try {
      const pts = await api.portfolios.aggregateSeries(RANGE_DAYS[range], today(), [id!]);
      setChartSeries(pts.map((p) => ({ date: p.date, value: p.totalValue })));
    } catch (e: any) {
      setChartError(e.message);
    } finally {
      setChartLoading(false);
    }
  }, [id]);

  useEffect(() => {
    async function load() {
      try {
        const [p, v, pos, txs] = await Promise.all([
          api.portfolios.get(id!),
          api.valuation.get(id!, today()),
          api.positions.list(id!),
          api.transactions.list(id!),
        ]);
        setPortfolio(p);
        setValuation(v);
        setPositions(pos);
        setTransactions(txs);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!loading) void loadChartSeries(selectedRange);
  }, [loading, loadChartSeries]);

  useEffect(() => {
    if (loading) return;
    if (prevRangeRef.current === selectedRange) return;
    prevRangeRef.current = selectedRange;
    void loadChartSeries(selectedRange);
  }, [selectedRange, loading, loadChartSeries]);

  async function handleDeletePortfolio() {
    try {
      await api.portfolios.delete(id!);
      navigate('/portfolios');
    } catch (e: any) {
      setError(e.message);
      setDeleteModal(false);
    }
  }

  async function handleDeleteTransaction() {
    if (txModal?.type !== 'delete') return;
    try {
      await api.transactions.delete(id!, txModal.transaction.id);
      setTransactions((prev) => prev.filter((t) => t.id !== txModal.transaction.id));
      const [v, pos] = await Promise.all([
        api.valuation.get(id!, today()),
        api.positions.list(id!),
      ]);
      setValuation(v);
      setPositions(pos);
      setTxModal(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleTxSaved() {
    setTxModal(null);
    const [v, pos, txs] = await Promise.all([
      api.valuation.get(id!, today()),
      api.positions.list(id!),
      api.transactions.list(id!),
    ]);
    setValuation(v);
    setPositions(pos);
    setTransactions(txs);
    void loadChartSeries(selectedRange);
  }

  if (loading) return <Spinner />;
  if (error || !portfolio) return <div className="p-6"><ErrorBanner message={error || 'Not found'} /></div>;

  const pnlPositive = (valuation?.unrealisedPnl ?? 0) >= 0;
  // Positions display comes from valuation.positions (PositionBreakdown[]) which
  // carries nav/value/cost/pnl/weightPct — not from the raw PortfolioPosition[].
  const positionRows: PositionBreakdown[] = valuation?.positions ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Link to="/portfolios" className="hover:text-blue-600 dark:hover:text-blue-400">Portfolios</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-800 dark:text-gray-200 font-medium">{portfolio.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{portfolio.name}</h1>
          {portfolio.description && (
            <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">{portfolio.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setEditModal(true)} className="btn-secondary text-sm">Edit</button>
          <button onClick={() => setDeleteModal(true)} className="btn-danger text-sm">Delete</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Total Value</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">€{fmtEur(valuation?.totalValue ?? 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Total Cost</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">€{fmtEur(valuation?.totalCost ?? 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Unrealised P&L</p>
          <p className={`text-2xl font-bold ${
            pnlPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
          }`}>€{fmtEur(valuation?.unrealisedPnl ?? 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Return</p>
          <p className={`text-2xl font-bold ${
            pnlPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
          }`}>{pnlPositive ? '+' : ''}{fmtPct(valuation?.unrealisedPnlPct ?? 0)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <PortfolioValueChart
          data={chartSeries}
          loading={chartLoading}
          error={chartError}
          selectedRange={selectedRange}
          onRangeChange={setSelectedRange}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-6">
          {(['positions', 'transactions'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Positions Tab — driven from valuation.positions (PositionBreakdown[]) */}
      {activeTab === 'positions' && (
        <div>
          {positionRows.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <p className="text-4xl mb-3">📊</p>
              <p className="font-medium text-gray-600 dark:text-gray-400 mb-1">No positions yet</p>
              <p className="text-sm">Add transactions to build your positions.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-th">Instrument</th>
                    <th className="table-th text-right">Units</th>
                    <th className="table-th text-right">NAV</th>
                    <th className="table-th text-right">Value</th>
                    <th className="table-th text-right">Cost</th>
                    <th className="table-th text-right">P&L</th>
                    <th className="table-th text-right">Return</th>
                    <th className="table-th text-right">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {positionRows.map((pos) => {
                    const posPos = (pos.pnl ?? 0) >= 0;
                    return (
                      <tr key={pos.instrumentId} className="table-row">
                        <td className="table-td font-medium max-w-xs">
                          <Link
                            to={`/instruments/${pos.instrumentId}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline truncate block"
                          >
                            {pos.instrumentName}
                          </Link>
                        </td>
                        <td className="table-td text-right">{pos.units}</td>
                        <td className="table-td text-right">€{fmtEur(pos.nav ?? 0)}</td>
                        <td className="table-td text-right">€{fmtEur(pos.value ?? 0)}</td>
                        <td className="table-td text-right">€{fmtEur(pos.cost ?? 0)}</td>
                        <td className={`table-td text-right font-medium ${
                          posPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                        }`}>{posPos ? '+' : ''}€{fmtEur(pos.pnl ?? 0)}</td>
                        <td className={`table-td text-right font-medium ${
                          posPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                        }`}>
                          {pos.pnl != null && pos.cost != null && pos.cost !== 0
                            ? `${posPos ? '+' : ''}${fmtPct((pos.pnl / pos.cost) * 100)}`
                            : '—'}
                        </td>
                        <td className="table-td text-right">
                          {pos.weightPct != null ? fmtPct(pos.weightPct) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setTxModal({ type: 'create' })} className="btn-primary text-sm">
              + Add Transaction
            </button>
          </div>
          {transactions.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium text-gray-600 dark:text-gray-400 mb-1">No transactions yet</p>
              <p className="text-sm">Record your first buy or sell to start tracking.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-th">Date</th>
                    <th className="table-th">Type</th>
                    <th className="table-th">Instrument</th>
                    <th className="table-th text-right">Units</th>
                    <th className="table-th text-right">Price</th>
                    <th className="table-th text-right">Fees</th>
                    <th className="table-th text-right">Total</th>
                    <th className="table-th"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const isBuy  = tx.type === 'BUY';
                    const isSell = tx.type === 'SELL';
                    return (
                      <tr key={tx.id} className="table-row">
                        <td className="table-td text-gray-500 dark:text-gray-400">{tx.tradeDate}</td>
                        <td className="table-td">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            isBuy  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                            : isSell ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="table-td font-medium text-gray-800 dark:text-gray-200 max-w-[14rem]">
                          <Link
                            to={`/instruments/${tx.instrumentId}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline truncate block"
                          >
                            {tx.instrument?.name ?? tx.instrumentId}
                          </Link>
                        </td>
                        <td className="table-td text-right">{tx.units}</td>
                        <td className="table-td text-right">€{fmtEur(tx.pricePerUnit)}</td>
                        <td className="table-td text-right">
                          {tx.fees ? `€${fmtEur(tx.fees)}` : '—'}
                        </td>
                        <td className="table-td text-right">
                          €{fmtEur(tx.units * tx.pricePerUnit + (tx.fees ?? 0))}
                        </td>
                        <td className="table-td">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setTxModal({ type: 'edit', transaction: tx })}
                              className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors"
                              title="Edit"
                            >✎</button>
                            <button
                              onClick={() => setTxModal({ type: 'delete', transaction: tx })}
                              className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
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
          )}
        </div>
      )}

      {/* Modals */}
      {editModal && (
        <PortfolioFormModal
          portfolio={portfolio}
          onClose={() => setEditModal(false)}
          onSaved={(p) => { setPortfolio(p); setEditModal(false); }}
        />
      )}
      {deleteModal && (
        <ConfirmDialog
          title="Delete Portfolio"
          message={`Delete "${portfolio.name}"? All positions and transactions will be permanently removed.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeletePortfolio}
          onCancel={() => setDeleteModal(false)}
        />
      )}
      {txModal?.type === 'create' && (
        <TransactionFormModal portfolioId={id!} onClose={() => setTxModal(null)} onSaved={handleTxSaved} />
      )}
      {txModal?.type === 'edit' && (
        <TransactionFormModal
          portfolioId={id!}
          transaction={txModal.transaction}
          onClose={() => setTxModal(null)}
          onSaved={handleTxSaved}
        />
      )}
      {txModal?.type === 'delete' && (
        <ConfirmDialog
          title="Delete Transaction"
          message="Delete this transaction? Positions and valuations will be recalculated."
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteTransaction}
          onCancel={() => setTxModal(null)}
        />
      )}
    </div>
  );
}
