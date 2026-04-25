import { useState } from 'react';
import { api } from '../api/client';
import type { AllocationTemplate } from '../types';
import Modal from './Modal';

interface Props {
  /** When provided the modal is in edit mode. */
  strategy?: AllocationTemplate;
  onClose: () => void;
  onSaved: (s: AllocationTemplate) => void;
}

/**
 * Create / edit an AllocationTemplate through the "Strategies" UI.
 * Strategies are stored as AllocationTemplates; this modal only manages
 * the name/code and description — items are managed separately.
 */
export default function StrategyFormModal({ strategy, onClose, onSaved }: Props) {
  const editing = !!strategy;
  const [name,        setName]        = useState(strategy?.name        ?? '');
  const [description, setDescription] = useState(strategy?.description ?? '');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const trimmedName = name.trim();
      const code = strategy?.code ?? trimmedName.toLowerCase().replace(/\s+/g, '-');
      const payload = {
        code,
        description: description.trim() || undefined,
        items: strategy?.items ?? [],
      };
      const saved = editing
        ? await api.templates.update(strategy!.id, payload)
        : await api.templates.create({ ...payload, name: trimmedName });
      onSaved(saved);
    } catch (err: any) {
      setError(err.message ?? 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? 'Edit Strategy' : 'New Strategy'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="strat-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Name
          </label>
          <input
            id="strat-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
            placeholder="e.g. 60/40 Growth"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="strat-desc" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
            <span className="ml-1 text-xs text-gray-400">(optional)</span>
          </label>
          <textarea
            id="strat-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input resize-none"
            placeholder="Brief description of this strategy…"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Strategy'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
