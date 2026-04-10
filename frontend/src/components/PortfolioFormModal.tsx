import { useState } from 'react';
import Modal from './Modal';
import { api } from '../api/client';
import type { Portfolio } from '../types';

interface Props {
  /** Pass an existing portfolio to edit; omit to create new */
  portfolio?: Portfolio;
  onSaved: (p: Portfolio) => void;
  onClose: () => void;
}

export default function PortfolioFormModal({ portfolio, onSaved, onClose }: Props) {
  const isEdit = !!portfolio;

  const [name, setName]               = useState(portfolio?.name ?? '');
  const [description, setDescription] = useState(portfolio?.description ?? '');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { name: name.trim(), description: description.trim() || undefined };
      const result = isEdit
        ? await api.portfolios.update(portfolio!.id, payload)
        : await api.portfolios.create(payload);
      onSaved(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Portfolio' : 'New Portfolio'}
      subtitle={isEdit ? portfolio!.name : 'Create a new model portfolio'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Flexible Greek"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            className="input resize-none"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of the portfolio strategy…"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Portfolio'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
