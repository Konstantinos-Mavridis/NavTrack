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

const TX_TABLE_LABEL: Record<string, string> = {
  FEE_CONSOLIDATION: 'FEE',
};

function txTableLabel(type: string): string {
  return TX_TABLE_LABEL[type] ?? type.replace(/_/g, ' ');
}

function fmtTxUnits(units: number | string, type: string): string {
  const n = Number(units);
  if (type === 'FEE_CONSOLIDATION') {
    return (n >= 0 ? '+' : '-') + fmtUnits(Math.abs(n));
  }
  return fmtUnits(n);
}

function feeUnitsCls(units: number | string): string {
  return Number(units) >= 0
    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
    : 'text-red-500 dark:text-red-400 font-medium';
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
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-8">

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
