import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { api } from '../api/client';
import type { AllocationTemplate, ApplyTemplateBuyResult, TemplateNavPreview } from '../types';
import { today } from '../utils/format';

interface Props {
  portfolioId: string;
  valuationDate: string;
  onSaved: (result: ApplyTemplateBuyResult) => void;
  onClose: () => void;
}

export default function TemplateBuyModal({ portfolioId, valuationDate, onSaved, onClose }: Props) {
  const [templates, setTemplates] = useState<AllocationTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [tradeDate, setTradeDate] = useState(valuationDate || today());
  const [settlementDate, setSettlementDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [navPreview, setNavPreview] = useState<TemplateNavPreview | null>(null);
  const [navLoading, setNavLoading] = useState(false);
  const [navError, setNavError] = useState('');

  useEffect(() => {
    api.templates.list().then((list) => {
      setTemplates(list);
      if (list.length > 0) setTemplateId(list[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  const selected = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  const amountNum = parseFloat(totalAmount) || 0;
  const previewItems = useMemo(
    () => (navPreview?.items ?? []).slice().sort((a, b) => Number(b.weight) - Number(a.weight)),
    [navPreview],
  );
  const hasMissingNav = previewItems.some((item) => item.nav == null);

  useEffect(() => {
    setTradeDate(valuationDate || today());
  }, [valuationDate]);

  useEffect(() => {
    if (!templateId || !tradeDate) {
      setNavPreview(null);
      setNavError('');
      setNavLoading(false);
      return;
    }

    let active = true;
    setNavLoading(true);
    setNavError('');

    api.templates.navPreview(templateId, tradeDate)
      .then((result) => {
        if (!active) return;
        setNavPreview(result);
      })
      .catch((e: any) => {
        if (!active) return;
        setNavPreview(null);
        setNavError(e.message);
      })
      .finally(() => {
        if (active) setNavLoading(false);
      });

    return () => {
      active = false;
    };
  }, [templateId, tradeDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!templateId) {
      setError('Please choose a template');
      return;
    }
    if (amountNum <= 0) {
      setError('Total amount must be positive');
      return;
    }
    if (navLoading) {
      setError('Please wait for NAV preview to finish loading');
      return;
    }
    if (hasMissingNav) {
      setError('One or more funds have no NAV on or before the selected trade date');
      return;
    }

    setSaving(true);
    try {
      const result = await api.transactions.applyTemplateBuy(portfolioId, {
        templateId,
        tradeDate,
        settlementDate: settlementDate || undefined,
        totalAmount: amountNum,
        notes: notes.trim() || undefined,
      });
      onSaved(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Buy Using Template"
      subtitle="Split a single amount into multiple BUY transactions"
      onClose={onClose}
      width="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template *</label>
          <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
            <option value="">Select template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.code}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (EUR) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="e.g. 10000"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trade Date *</label>
            <input
              type="date"
              className="input"
              value={tradeDate}
              max={today()}
              onChange={(e) => setTradeDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Date</label>
            <input
              type="date"
              className="input"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <input
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>

        {selected && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Allocation preview ({selected.code})
            </div>
            <div className="px-3 py-2 space-y-2">
              {navLoading && (
                <p className="text-sm text-gray-500">Loading NAV values for {tradeDate}...</p>
              )}

              {!navLoading && navError && (
                <p className="text-sm text-red-600">{navError}</p>
              )}

              {!navLoading && !navError && previewItems.length > 0 && previewItems.map((item) => {
                const alloc = amountNum > 0 ? (amountNum * Number(item.weight)) / 100 : 0;
                const estUnits = item.nav && item.nav > 0 ? alloc / item.nav : null;
                const fallback = item.navDate && item.navDate !== tradeDate;

                return (
                  <div key={item.instrumentId} className="rounded-md border border-gray-100 p-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate pr-3">{item.instrumentName}</span>
                      <span className="text-gray-500 shrink-0">
                        {Number(item.weight).toFixed(4)}% - EUR {alloc.toLocaleString('el-GR', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {item.nav != null ? (
                        <>
                          NAV used: EUR {Number(item.nav).toFixed(6)} ({item.navDate})
                          {fallback && (
                            <span className="text-amber-600"> - latest available on/before valuation date</span>
                          )}
                          {estUnits != null && (
                            <span> - est. units: {estUnits.toLocaleString('el-GR', { maximumFractionDigits: 6 })}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-red-600">No NAV on or before {tradeDate}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {!navLoading && !navError && previewItems.length === 0 && (
                <p className="text-sm text-gray-500">No template items found.</p>
              )}

              <p className="text-xs text-gray-400 pt-1">
                Buy Template uses these NAV values as of the selected trade date.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving || navLoading || hasMissingNav} className="btn-primary">
            {saving ? 'Creating transactions...' : 'Create BUY Transactions'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
