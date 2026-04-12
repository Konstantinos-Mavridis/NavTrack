import { useEffect, useState, useRef } from 'react';
import Modal from './Modal';
import { api } from '../api/client';
import type { Transaction, Instrument } from '../types';
import { today } from '../utils/format';

const TX_TYPES = ['BUY', 'SELL', 'SWITCH', 'DIVIDEND_REINVEST'] as const;
type TxType = typeof TX_TYPES[number];

interface Props {
  portfolioId: string;
  transaction?: Transaction;
  onSaved: (t: Transaction) => void;
  onClose: () => void;
}

// Per-type colour tokens — light + dark variants
const TYPE_STYLES: Record<TxType, { active: string; idle: string }> = {
  BUY: {
    active: 'bg-blue-100   text-blue-700   border-blue-300   dark:bg-blue-900/50  dark:text-blue-300  dark:border-blue-700',
    idle:   'bg-white      text-gray-500   border-gray-200   dark:bg-gray-800     dark:text-gray-400  dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500',
  },
  SELL: {
    active: 'bg-red-100    text-red-700    border-red-300    dark:bg-red-900/50   dark:text-red-300   dark:border-red-700',
    idle:   'bg-white      text-gray-500   border-gray-200   dark:bg-gray-800     dark:text-gray-400  dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500',
  },
  SWITCH: {
    active: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700',
    idle:   'bg-white      text-gray-500   border-gray-200   dark:bg-gray-800     dark:text-gray-400  dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500',
  },
  DIVIDEND_REINVEST: {
    active: 'bg-green-100  text-green-700  border-green-300  dark:bg-green-900/50 dark:text-green-300  dark:border-green-700',
    idle:   'bg-white      text-gray-500   border-gray-200   dark:bg-gray-800     dark:text-gray-400  dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500',
  },
};

export default function TransactionFormModal({ portfolioId, transaction, onSaved, onClose }: Props) {
  const isEdit = !!transaction;

  const [instruments,    setInstruments]    = useState<Instrument[]>([]);
  const [instrumentId,   setInstrumentId]   = useState(transaction?.instrumentId ?? '');
  const [type,           setType]           = useState<TxType>((transaction?.type as TxType) ?? 'BUY');
  const [tradeDate,      setTradeDate]      = useState(transaction?.tradeDate ?? today());
  const [settlementDate, setSettlementDate] = useState(transaction?.settlementDate ?? '');
  const [units,          setUnits]          = useState(String(transaction?.units ?? ''));
  const [pricePerUnit,   setPricePerUnit]   = useState(String(transaction?.pricePerUnit ?? ''));
  const [fees,           setFees]           = useState(String(transaction?.fees ?? '0'));
  const [notes,          setNotes]          = useState(transaction?.notes ?? '');

  // NAV auto-fill state
  const [navLoading,  setNavLoading]  = useState(false);
  const [navHint,     setNavHint]     = useState<string | null>(null); // e.g. "NAV on 2024-03-15"
  const [navMissing,  setNavMissing]  = useState(false);
  // Track whether the user has manually overridden the auto-filled price
  const autoFilledPrice = useRef<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  // Load instruments once
  useEffect(() => {
    api.instruments.list().then(setInstruments).catch(() => {});
  }, []);

  // Auto-fill price whenever fund or trade date changes
  useEffect(() => {
    if (!instrumentId || !tradeDate) {
      setNavHint(null);
      setNavMissing(false);
      return;
    }

    let cancelled = false;
    setNavLoading(true);
    setNavHint(null);
    setNavMissing(false);

    api.instruments.navOnDate(instrumentId, tradeDate)
      .then((nav) => {
        if (cancelled) return;
        if (nav) {
          const navStr = String(nav.nav);
          // Only overwrite price if field is still empty OR was previously auto-filled
          if (!pricePerUnit || pricePerUnit === autoFilledPrice.current) {
            setPricePerUnit(navStr);
            autoFilledPrice.current = navStr;
          }
          // Show hint: exact match vs. look-back date
          const navDate = typeof nav.date === 'string' ? nav.date.slice(0, 10) : '';
          setNavHint(
            navDate === tradeDate
              ? `NAV on ${navDate}`
              : `Latest NAV before ${tradeDate}: ${navDate}`,
          );
          setNavMissing(false);
        } else {
          setNavMissing(true);
          setNavHint(null);
        }
      })
      .catch(() => {
        if (!cancelled) { setNavMissing(true); setNavHint(null); }
      })
      .finally(() => { if (!cancelled) setNavLoading(false); });

    return () => { cancelled = true; };
    // Intentionally excluding pricePerUnit from deps — we don't want to re-fire
    // the lookup just because the user is typing a manual price.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrumentId, tradeDate]);

  // Auto-calculated total
  const unitNum  = parseFloat(units)        || 0;
  const priceNum = parseFloat(pricePerUnit) || 0;
  const feesNum  = parseFloat(fees)         || 0;
  const total    = unitNum * priceNum + feesNum;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!instrumentId) { setError('Please select a fund'); return; }
    if (!tradeDate)    { setError('Trade date is required'); return; }
    if (unitNum  <= 0) { setError('Units must be positive'); return; }
    if (priceNum <= 0) { setError('Price must be positive'); return; }

    setSaving(true);
    try {
      const payload = {
        instrumentId,
        type,
        tradeDate,
        settlementDate: settlementDate || undefined,
        units:          unitNum,
        pricePerUnit:   priceNum,
        fees:           feesNum,
        notes:          notes.trim() || undefined,
      };
      const result = isEdit
        ? await api.transactions.update(portfolioId, transaction!.id, payload)
        : await api.transactions.create(portfolioId, payload);
      onSaved(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Label class — consistent across all form labels
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <Modal
      title={isEdit ? 'Edit Transaction' : 'Add Transaction'}
      subtitle={isEdit ? `Editing ${transaction!.instrument?.name ?? ''}` : 'Record a new trade'}
      onClose={onClose}
      width="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Error banner */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-3 py-2">
            {error}
          </div>
        )}

        {/* Transaction type buttons */}
        <div>
          <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2`}>Type</label>
          <div className="flex gap-2 flex-wrap">
            {TX_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  type === t ? TYPE_STYLES[t].active : TYPE_STYLES[t].idle
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Fund selector */}
        <div>
          <label className={labelCls}>
            Fund <span className="text-red-400 dark:text-red-500">*</span>
          </label>
          <select
            className="input"
            value={instrumentId}
            onChange={(e) => setInstrumentId(e.target.value)}
            required
          >
            <option value="">— Select a fund —</option>
            {instruments.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.isin.trim()})
              </option>
            ))}
          </select>
        </div>

        {/* Dates row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              Trade Date <span className="text-red-400 dark:text-red-500">*</span>
            </label>
            <input
              type="date"
              className="input"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Settlement Date</label>
            <input
              type="date"
              className="input"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
            />
          </div>
        </div>

        {/* Units / Price / Fees row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>
              Units <span className="text-red-400 dark:text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.000001"
              min="0"
              className="input"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="e.g. 100"
              required
            />
          </div>

          {/* Price / Unit — with NAV auto-fill feedback */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Price / Unit (€) <span className="text-red-400 dark:text-red-500">*</span>
              </label>
              {/* NAV hint inline next to the label */}
              {navLoading && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full border border-blue-400 border-t-transparent animate-spin" />
                  Loading NAV…
                </span>
              )}
              {!navLoading && navHint && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ {navHint}
                </span>
              )}
              {!navLoading && navMissing && instrumentId && tradeDate && (
                <span className="text-[10px] text-amber-500 dark:text-amber-400">
                  No NAV found
                </span>
              )}
            </div>
            <input
              type="number"
              step="0.000001"
              min="0"
              className="input"
              value={pricePerUnit}
              onChange={(e) => {
                setPricePerUnit(e.target.value);
                // If user manually edits, clear the auto-fill marker
                autoFilledPrice.current = null;
              }}
              placeholder="e.g. 9.123456"
              required
            />
          </div>

          <div>
            <label className={labelCls}>Fees (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Total preview */}
        {unitNum > 0 && priceNum > 0 && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {unitNum.toLocaleString('el-GR', { maximumFractionDigits: 6 })} units
              × €{priceNum.toFixed(6)}
              {feesNum > 0 && ` + €${feesNum.toFixed(2)} fees`}
            </span>
            <span className="text-base font-bold text-gray-900 dark:text-gray-100">
              = €{total.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className={labelCls}>Notes</label>
          <input
            type="text"
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional note…"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Transaction'}
          </button>
        </div>

      </form>
    </Modal>
  );
}
