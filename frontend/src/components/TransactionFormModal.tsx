import { useEffect, useState } from 'react';
import Modal from './Modal';
import { ModalErrorBanner, FIELD_LABEL_CLS } from './ui';
import { api } from '../api/client';
import type { Transaction, Instrument, PortfolioPosition } from '../types';
import { today } from '../utils/format';

const TX_TYPES = ['BUY', 'SELL', 'SWITCH', 'DIVIDEND_REINVEST', 'FEE_CONSOLIDATION'] as const;
type TxType = typeof TX_TYPES[number];

interface Props {
  portfolioId: string;
  transaction?: Transaction;
  onSaved: (t: Transaction) => void;
  onClose: () => void;
}

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
  FEE_CONSOLIDATION: {
    active: 'bg-amber-100  text-amber-700  border-amber-300  dark:bg-amber-900/50 dark:text-amber-300  dark:border-amber-700',
    idle:   'bg-white      text-gray-500   border-gray-200   dark:bg-gray-800     dark:text-gray-400  dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500',
  },
};

const REQUIRES_POSITION: Set<TxType> = new Set(['SELL', 'SWITCH', 'FEE_CONSOLIDATION']);

const SPIN_STYLE: React.CSSProperties = { animation: 'spin 0.75s linear infinite' };

// ---------------------------------------------------------------------------
// Tiny tooltip component
// ---------------------------------------------------------------------------
interface TooltipProps {
  variant?: 'idle' | 'loading' | 'success' | 'warning';
  children: React.ReactNode;
}

function NavTooltip({ variant = 'idle', children }: TooltipProps) {
  const [open, setOpen] = useState(false);

  const iconCls =
    variant === 'loading' ? 'text-blue-400 dark:text-blue-500'
    : variant === 'success' ? 'text-emerald-500 dark:text-emerald-400'
    : variant === 'warning' ? 'text-amber-500 dark:text-amber-400'
    : 'text-gray-300 dark:text-gray-600';

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        tabIndex={0}
        aria-label="NAV price info"
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${iconCls}`}
      >
        {variant === 'loading' ? (
          <span
            className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent"
            style={SPIN_STYLE}
          />
        ) : (
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11ZM8 6a.75.75 0 1 0 0-1.5A.75.75 0 0 0 8 6Zm-.75 1.25a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5Z"/>
          </svg>
        )}
      </button>

      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
          w-max max-w-[240px] rounded-lg px-3 py-2 text-xs leading-snug shadow-lg
          bg-gray-900 text-gray-100 dark:bg-gray-100 dark:text-gray-900
          transition-all duration-150 ${
            open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
          }`}
      >
        {children}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------
export default function TransactionFormModal({ portfolioId, transaction, onSaved, onClose }: Props) {
  const isEdit = !!transaction;

  const [instruments,    setInstruments]    = useState<Instrument[]>([]);
  const [positions,      setPositions]      = useState<PortfolioPosition[]>([]);
  const [instrumentId,   setInstrumentId]   = useState(transaction?.instrumentId ?? '');
  const [type,           setType]           = useState<TxType>((transaction?.type as TxType) ?? 'BUY');
  const [tradeDate,      setTradeDate]      = useState(transaction?.tradeDate ?? today());
  const [settlementDate, setSettlementDate] = useState(transaction?.settlementDate ?? '');
  const [units,          setUnits]          = useState(String(transaction?.units ?? ''));
  const [pricePerUnit,   setPricePerUnit]   = useState(String(transaction?.pricePerUnit ?? ''));
  const [fees,           setFees]           = useState(String(transaction?.fees ?? '0'));
  const [notes,          setNotes]          = useState(transaction?.notes ?? '');

  const [priceIsAutoFilled, setPriceIsAutoFilled] = useState(false);
  const [navLoading,  setNavLoading]  = useState(false);
  const [navHint,     setNavHint]     = useState<string | null>(null);
  const [navMissing,  setNavMissing]  = useState(false);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    api.instruments.list().then(setInstruments).catch(() => {});
    api.positions.list(portfolioId).then(setPositions).catch(() => {});
  }, [portfolioId]);

  const heldInstrumentIds = new Set(positions.map((p) => p.instrumentId));

  function handleTypeChange(newType: TxType) {
    setType(newType);
    if (REQUIRES_POSITION.has(newType) && instrumentId && !heldInstrumentIds.has(instrumentId)) {
      setInstrumentId('');
    }
  }

  const isFeeConsolidation = type === 'FEE_CONSOLIDATION';

  const selectableInstruments: Instrument[] = (() => {
    if (!REQUIRES_POSITION.has(type)) return instruments;
    return instruments.filter(
      (i) => heldInstrumentIds.has(i.id) || (isEdit && i.id === transaction?.instrumentId),
    );
  })();

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
          if (priceIsAutoFilled || !pricePerUnit) {
            setPricePerUnit(navStr);
            setPriceIsAutoFilled(true);
          }
          const navDate = typeof nav.date === 'string' ? nav.date.slice(0, 10) : '';
          setNavHint(
            navDate === tradeDate
              ? `NAV price on ${navDate}`
              : `No NAV on ${tradeDate} — using latest: ${navDate}`,
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
  }, [instrumentId, tradeDate, priceIsAutoFilled, pricePerUnit]);

  const unitNum  = parseFloat(units)        || 0;
  const priceNum = parseFloat(pricePerUnit) || 0;
  const feesNum  = parseFloat(fees)         || 0;
  const total    = unitNum * priceNum + feesNum;
  const showTotal = !isFeeConsolidation && Math.abs(unitNum) > 0 && priceNum > 0;

  type NavStatus = 'loading' | 'hint' | 'missing' | 'idle';
  const navStatus: NavStatus =
    navLoading                                    ? 'loading'
    : navHint !== null                            ? 'hint'
    : navMissing && !!instrumentId && !!tradeDate ? 'missing'
    : 'idle';

  const navTooltipVariant =
    navStatus === 'loading' ? 'loading'
    : navStatus === 'hint'    ? 'success'
    : navStatus === 'missing' ? 'warning'
    : 'idle';

  const navTooltipText =
    navStatus === 'loading' ? 'Loading NAV…'
    : navStatus === 'hint'    ? `✓ ${navHint}`
    : navStatus === 'missing' ? 'No NAV data found for this date'
    : 'Price will be auto-filled from NAV once a fund and trade date are selected';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!instrumentId) { setError('Please select a fund'); return; }
    if (!tradeDate)    { setError('Trade date is required'); return; }
    if (isFeeConsolidation) {
      if (unitNum === 0) { setError('Unit delta cannot be zero'); return; }
    } else {
      if (unitNum  <= 0) { setError('Units must be positive'); return; }
      if (priceNum <= 0) { setError('Price must be positive'); return; }
    }

    setSaving(true);
    try {
      const payload = {
        instrumentId,
        type: type as Transaction['type'],
        tradeDate,
        settlementDate: settlementDate || undefined,
        units: unitNum,
        pricePerUnit: priceNum,
        fees: feesNum,
        notes: notes.trim() || undefined,
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

  const fundHint = REQUIRES_POSITION.has(type) && !isEdit
    ? selectableInstruments.length === 0
      ? 'No held funds — add a BUY transaction first'
      : 'Only funds currently held in this portfolio'
    : null;

  return (
    <Modal
      title={isEdit ? 'Edit Transaction' : 'Add Transaction'}
      subtitle={isEdit ? `Editing ${transaction!.instrument?.name ?? ''}` : 'Record a new trade'}
      onClose={onClose}
      width="max-w-xl"
    >
      <ModalErrorBanner error={error} />

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Type */}
        <div>
          <label className={FIELD_LABEL_CLS} style={{ marginBottom: '0.5rem' }}>Type</label>
          <div className="flex gap-2 flex-wrap">
            {TX_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => handleTypeChange(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  type === t ? TYPE_STYLES[t].active : TYPE_STYLES[t].idle
                }`}>
                {t === 'FEE_CONSOLIDATION' ? 'Fee Consolidation' : t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Fee Consolidation hint */}
        {isFeeConsolidation && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            Bank-initiated unit adjustment for portfolio maintenance fees. Units can be negative
            (fee deduction) or positive (reinstatement). No cash flow is recorded.
          </p>
        )}

        {/* Fund */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Fund <span className="text-red-400 dark:text-red-500">*</span>
            </label>
            <span
              className={`text-xs transition-opacity duration-150 ${
                fundHint
                  ? (selectableInstruments.length === 0
                      ? 'text-amber-500 dark:text-amber-400 opacity-100'
                      : 'text-gray-400 dark:text-gray-500 opacity-100')
                  : 'opacity-0 pointer-events-none select-none'
              }`}
            >
              {fundHint ?? ' '}
            </span>
          </div>
          <select
            className="input"
            value={instrumentId}
            onChange={(e) => setInstrumentId(e.target.value)}
            required
            disabled={REQUIRES_POSITION.has(type) && selectableInstruments.length === 0}
          >
            <option value="">— Select a fund —</option>
            {selectableInstruments.map((i) => (
              <option key={i.id} value={i.id}>{i.name} ({i.isin.trim()})</option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={FIELD_LABEL_CLS}>Trade Date <span className="text-red-400 dark:text-red-500">*</span></label>
            <input type="date" className="input" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} required />
          </div>
          <div>
            <label className={FIELD_LABEL_CLS}>Settlement Date</label>
            <input type="date" className="input" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
          </div>
        </div>

        {/* Units / Price / Fees */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={FIELD_LABEL_CLS}>
              {isFeeConsolidation ? 'Unit Delta' : 'Units'}{' '}
              <span className="text-red-400 dark:text-red-500">*</span>
            </label>
            <input type="number" step="0.000001" className="input"
              value={units} onChange={(e) => setUnits(e.target.value)}
              placeholder={isFeeConsolidation ? 'e.g. -1.234567' : 'e.g. 100'} required />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Price / Unit (€) {!isFeeConsolidation && <span className="text-red-400 dark:text-red-500">*</span>}
              </span>
              {!isFeeConsolidation && (
                <NavTooltip variant={navTooltipVariant}>
                  {navTooltipText}
                </NavTooltip>
              )}
            </div>
            <input
              type="number" step="0.000001" min="0" className="input"
              value={pricePerUnit}
              onChange={(e) => {
                setPricePerUnit(e.target.value);
                setPriceIsAutoFilled(false);
              }}
              placeholder="e.g. 9.123456"
              required={!isFeeConsolidation}
              disabled={isFeeConsolidation}
            />
          </div>
          <div>
            <label className={FIELD_LABEL_CLS}>Fees (€)</label>
            <input type="number" step="0.01" min="0" className="input"
              value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0.00"
              disabled={isFeeConsolidation} />
          </div>
        </div>

        {/* Total row */}
        <div className="rounded-lg border border-gray-100 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/40 px-4 py-3 flex items-center justify-between">
          <span className={`text-sm transition-all duration-150 ${
            showTotal ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-700 select-none'
          }`}>
            {showTotal
              ? <>{unitNum.toLocaleString('el-GR', { maximumFractionDigits: 6 })} units
                  &nbsp;×&nbsp;€{priceNum.toFixed(6)}
                  {feesNum > 0 && ` + €${feesNum.toFixed(2)} fees`}</>
              : isFeeConsolidation
                ? 'Unit-only adjustment — no cash flow'
                : <>— units &nbsp;×&nbsp; €—</>}
          </span>
          <span className={`text-base font-bold transition-all duration-150 ${
            showTotal ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-700 select-none'
          }`}>
            {showTotal
              ? `= €${total.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : isFeeConsolidation ? '' : '= €—'}
          </span>
        </div>

        {/* Notes */}
        <div>
          <label className={FIELD_LABEL_CLS}>Notes</label>
          <input type="text" className="input" value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Optional note…" />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
            {saving && (
              <span
                className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                style={SPIN_STYLE}
              />
            )}
            {saving ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : 'Add Transaction')}
          </button>
        </div>

      </form>
    </Modal>
  );
}
