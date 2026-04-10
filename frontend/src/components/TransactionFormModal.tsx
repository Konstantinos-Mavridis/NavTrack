import { useEffect, useState } from 'react';
import Modal from './Modal';
import { api } from '../api/client';
import type { Transaction, Instrument } from '../types';
import { today } from '../utils/format';

const TX_TYPES = ['BUY', 'SELL', 'SWITCH', 'DIVIDEND_REINVEST'] as const;
type TxType = typeof TX_TYPES[number];

interface Props {
  portfolioId: string;
  /** Pass existing transaction to edit; omit to add new */
  transaction?: Transaction;
  onSaved: (t: Transaction) => void;
  onClose: () => void;
}

export default function TransactionFormModal({ portfolioId, transaction, onSaved, onClose }: Props) {
  const isEdit = !!transaction;

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [instrumentId, setInstrumentId]   = useState(transaction?.instrumentId ?? '');
  const [type,         setType]           = useState<TxType>((transaction?.type as TxType) ?? 'BUY');
  const [tradeDate,    setTradeDate]       = useState(transaction?.tradeDate ?? today());
  const [settlementDate, setSettlementDate] = useState(transaction?.settlementDate ?? '');
  const [units,        setUnits]           = useState(String(transaction?.units ?? ''));
  const [pricePerUnit, setPricePerUnit]    = useState(String(transaction?.pricePerUnit ?? ''));
  const [fees,         setFees]            = useState(String(transaction?.fees ?? '0'));
  const [notes,        setNotes]           = useState(transaction?.notes ?? '');

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    api.instruments.list().then(setInstruments).catch(() => {});
  }, []);

  // Auto-calculate total display
  const unitNum  = parseFloat(units)       || 0;
  const priceNum = parseFloat(pricePerUnit) || 0;
  const feesNum  = parseFloat(fees)        || 0;
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

  const typeColors: Record<TxType, string> = {
    BUY:               'bg-blue-100 text-blue-700 border-blue-200',
    SELL:              'bg-red-100 text-red-700 border-red-200',
    SWITCH:            'bg-purple-100 text-purple-700 border-purple-200',
    DIVIDEND_REINVEST: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <Modal
      title={isEdit ? 'Edit Transaction' : 'Add Transaction'}
      subtitle={isEdit ? `Editing ${transaction!.instrument?.name ?? ''}` : 'Record a new trade'}
      onClose={onClose}
      width="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}

        {/* Transaction type buttons */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
          <div className="flex gap-2 flex-wrap">
            {TX_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  type === t
                    ? typeColors[t]
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Instrument */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fund <span className="text-red-400">*</span>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trade Date <span className="text-red-400">*</span>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Settlement Date
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Units <span className="text-red-400">*</span>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price / Unit (€) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="0.000001"
              min="0"
              className="input"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              placeholder="e.g. 9.123456"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fees (€)</label>
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
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {unitNum.toLocaleString('el-GR', { maximumFractionDigits: 6 })} units
              × €{priceNum.toFixed(6)}
              {feesNum > 0 && ` + €${feesNum.toFixed(2)} fees`}
            </span>
            <span className="text-base font-bold text-gray-900">
              = €{total.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
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
