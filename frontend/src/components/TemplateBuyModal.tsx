import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { ModalErrorBanner, FIELD_LABEL_CLS } from './ui';
import { api } from '../api/client';
import type { AllocationTemplate, ApplyTemplateBuyResult, TemplateNavPreview } from '../types';
import { today } from '../utils/format';

const SPIN_STYLE: React.CSSProperties = { animation: 'spin 0.75s linear infinite' };

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
      .then((result) => { if (active) { setNavPreview(result); setNavError(''); } })
      .catch((e: any) => { if (active) { setNavPreview(null); setNavError(e.message); } })
      .finally(() => { if (active) setNavLoading(false); });

    return () => { active = false; };
  }, [templateId, tradeDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!templateId) { setError('Please choose a template'); return; }
    if (amountNum <= 0) { setError('Total amount must be positive'); return; }
    if (navLoading) { setError('Please wait for NAV preview to finish loading'); return; }
    if (hasMissingNav) { setError('One or more funds have no NAV on or before the selected trade date'); return; }

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
      <ModalErrorBanner error={error} />

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Template */}
        <div>
          <label className={FIELD_LABEL_CLS}>Template *</label>
          <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
            <option value="">Select template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.code}</option>
            ))}
          </select>
        </div>

        {/* Amount / Trade Date / Settlement Date */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={FIELD_LABEL_CLS}>Total Amount (EUR) *</label>
            <input
              type="number" step="0.01" min="0" className="input"
              value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="e.g. 10000" required
            />
          </div>
          <div>
            <label className={FIELD_LABEL_CLS}>Trade Date *</label>
            <input
              type="date" className="input" value={tradeDate} max={today()}
              onChange={(e) => setTradeDate(e.target.value)} required
            />
          </div>
          <div>
            <label className={FIELD_LABEL_CLS}>Settlement Date</label>
            <input
              type="date" className="input" value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={FIELD_LABEL_CLS}>Notes</label>
          <input
            className="input" value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Optional"
          />
        </div>

        {/* Allocation preview */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Allocation preview
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 transition-opacity duration-150 ${
                navLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <span
                className="inline-block h-3 w-3 rounded-full border-2 border-blue-400 border-t-transparent"
                style={SPIN_STYLE}
              />
              Updating…
            </span>
          </div>

          <div
            className={`px-3 pt-2 pb-2 h-80 overflow-y-auto transition-opacity duration-200 ${
              navLoading ? 'opacity-40' : 'opacity-100'
            }`}
          >
            {!selected && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Select a template to see the allocation.</p>
            )}

            {selected && navError && !navPreview && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{navError}</p>
            )}

            {selected && !navError && previewItems.length === 0 && !navLoading && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No template items found.</p>
            )}

            <div className="space-y-2">
              {previewItems.map((item) => {
                const alloc = amountNum > 0 ? (amountNum * Number(item.weight)) / 100 : 0;
                const estUnits = item.nav && item.nav > 0 ? alloc / item.nav : null;
                const fallback = item.navDate && item.navDate !== tradeDate;
                return (
                  <div key={item.instrumentId} className="rounded-md border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-200 truncate pr-3">{item.instrumentName}</span>
                      <span className="text-gray-500 dark:text-gray-400 shrink-0">
                        {Number(item.weight).toFixed(4)}%
                        {amountNum > 0 && <> — EUR {alloc.toLocaleString('el-GR', { maximumFractionDigits: 2 })}</>}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {item.nav != null ? (
                        <>
                          NAV: EUR {Number(item.nav).toFixed(6)} ({item.navDate})
                          {fallback && (
                            <span className="text-amber-600 dark:text-amber-400"> — latest available</span>
                          )}
                          {estUnits != null && (
                            <span> — est. {estUnits.toLocaleString('el-GR', { maximumFractionDigits: 6 })} units</span>
                          )}
                        </>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">No NAV on or before {tradeDate}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2 border-t border-gray-100 dark:border-gray-700">
            NAV values as of the selected trade date.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="submit"
            disabled={saving || navLoading || hasMissingNav}
            className="btn-primary inline-flex items-center gap-2"
          >
            {saving && (
              <span
                className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                style={SPIN_STYLE}
              />
            )}
            {saving ? 'Creating…' : 'Create BUY Transactions'}
          </button>
        </div>

      </form>
    </Modal>
  );
}
