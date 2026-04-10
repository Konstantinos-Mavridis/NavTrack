import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { ModalErrorBanner, FIELD_LABEL_CLS } from './ui';
import { api } from '../api/client';
import type { AllocationTemplate, Instrument, TemplateItemPayload } from '../types';

interface Props {
  template?: AllocationTemplate;
  onSaved: (t: AllocationTemplate) => void;
  onClose: () => void;
}

interface RowState {
  instrumentId: string;
  weight: string;
}

export default function TemplateFormModal({ template, onSaved, onClose }: Props) {
  const isEdit = !!template;

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [code, setCode] = useState(template?.code ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [rows, setRows] = useState<RowState[]>(
    template?.items?.length
      ? template.items.map((i) => ({ instrumentId: i.instrumentId, weight: String(i.weight) }))
      : [{ instrumentId: '', weight: '' }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.instruments.list().then(setInstruments).catch(() => setInstruments([]));
  }, []);

  const totalWeight = useMemo(
    () => rows.reduce((acc, r) => acc + (parseFloat(r.weight) || 0), 0),
    [rows],
  );

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRow(idx: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  function addRow() {
    setRows((prev) => [...prev, { instrumentId: '', weight: '' }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const cleanCode = code.trim();
    if (!cleanCode) { setError('Template code is required'); return; }

    const items: TemplateItemPayload[] = rows
      .filter((r) => r.instrumentId && (parseFloat(r.weight) || 0) > 0)
      .map((r) => ({ instrumentId: r.instrumentId, weight: parseFloat(r.weight) }));

    if (items.length === 0) { setError('Please add at least one fund with positive weight'); return; }

    const unique = new Set(items.map((i) => i.instrumentId));
    if (unique.size !== items.length) { setError('Each fund can only appear once'); return; }

    const sum = items.reduce((acc, i) => acc + i.weight, 0);
    if (Math.abs(sum - 100) > 0.01) { setError(`Weights must add up to 100 (currently ${sum.toFixed(4)})`); return; }

    setSaving(true);
    try {
      const payload = { code: cleanCode, description: description.trim() || undefined, items };
      const saved = isEdit
        ? await api.templates.update(template!.id, payload)
        : await api.templates.create(payload);
      onSaved(saved);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Three-state weight indicator: green = exact 100, red = over, gray = under.
  const totalWeightClass =
    Math.abs(totalWeight - 100) <= 0.01
      ? 'text-emerald-600 dark:text-emerald-400'
      : totalWeight > 100
        ? 'text-red-500 dark:text-red-400'
        : 'text-gray-500 dark:text-gray-400';

  return (
    <Modal
      title={isEdit ? 'Edit Template' : 'New Template'}
      subtitle={isEdit ? template!.code : 'Define funds and target weights'}
      onClose={onClose}
      width="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <ModalErrorBanner error={error} />

        <div>
          <label className={FIELD_LABEL_CLS}>Template Code *</label>
          <input
            className="input" value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. FlexibleGreek20260218" required
          />
        </div>

        <div>
          <label className={FIELD_LABEL_CLS}>Description</label>
          <textarea
            className="input resize-y min-h-[72px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            rows={3}
          />
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Funds &amp; Weights
          </div>
          <div className="p-3 space-y-2 bg-white dark:bg-gray-900">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-8">
                  <select
                    className="input" value={row.instrumentId}
                    onChange={(e) => updateRow(idx, { instrumentId: e.target.value })}
                  >
                    <option value="">Select fund...</option>
                    {instruments.map((i) => (
                      <option key={i.id} value={i.id}>{i.name} ({i.isin.trim()})</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input
                    type="number" step="0.0001" min="0" className="input"
                    value={row.weight}
                    onChange={(e) => updateRow(idx, { weight: e.target.value })}
                    placeholder="Weight %"
                  />
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button" onClick={() => removeRow(idx)}
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-sm transition-colors"
                    title="Remove row"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={addRow} className="btn-secondary text-sm py-1.5">
                + Add Fund
              </button>
              <p className={`text-sm font-medium ${totalWeightClass}`}>
                Total: {totalWeight.toFixed(4)}%
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : isEdit ? 'Save Template' : 'Create Template'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
