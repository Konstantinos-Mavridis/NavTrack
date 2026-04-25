import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AllocationTemplate } from '../types';
import { Spinner, ErrorBanner } from '../components/ui';
import TemplateFormModal from '../components/TemplateFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { fmtPct } from '../utils/format';

type Modal =
  | { type: 'create' }
  | { type: 'edit'; template: AllocationTemplate }
  | { type: 'delete'; template: AllocationTemplate };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<AllocationTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [modal,     setModal]     = useState<Modal | null>(null);

  async function load() {
    try {
      setTemplates(await api.templates.list());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    if (modal?.type !== 'delete') return;
    try {
      await api.templates.delete(modal.template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== modal.template.id));
      setModal(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function handleSaved(t: AllocationTemplate) {
    setModal(null);
    setTemplates((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = t; return next; }
      return [...prev, t];
    });
  }

  if (loading) return <Spinner />;
  if (error)   return <div className="p-6"><ErrorBanner message={error} /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Templates</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Reusable allocation templates</p>
        </div>
        <button onClick={() => setModal({ type: 'create' })} className="btn-primary">
          + New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-lg font-medium mb-2 text-gray-600 dark:text-gray-400">No templates yet</p>
          <p className="text-sm mb-6">Create a reusable template to apply across multiple portfolios.</p>
          <button onClick={() => setModal({ type: 'create' })} className="btn-primary">Create Template</button>
        </div>
      ) : (
        <div className="grid gap-5">
          {templates.map((tpl) => {
            const total = tpl.items.reduce((s, a) => s + a.weight, 0);
            const ok    = Math.abs(total - 100) < 0.01;
            return (
              <div key={tpl.id} className="card p-6 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tpl.name}</h2>
                    <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-0.5">{tpl.code}</p>
                    {tpl.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{tpl.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setModal({ type: 'edit', template: tpl })} className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors" title="Edit">✎</button>
                    <button onClick={() => setModal({ type: 'delete', template: tpl })} className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors" title="Delete">✕</button>
                  </div>
                </div>
                {tpl.items.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">No allocations defined.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table text-sm">
                      <thead><tr><th className="table-th">Instrument</th><th className="table-th text-right">Weight</th><th className="table-th">Bar</th></tr></thead>
                      <tbody>
                        {tpl.items.map((a) => (
                          <tr key={a.instrumentId} className="table-row">
                            <td className="table-td font-medium">{a.instrument?.name ?? a.instrumentId}</td>
                            <td className="table-td text-right font-mono">{fmtPct(a.weight)}</td>
                            <td className="table-td w-40"><div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(a.weight, 100)}%` }} /></div></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr><td className="table-td text-xs text-gray-400 dark:text-gray-500">Total</td><td className={`table-td text-right font-mono font-semibold text-xs ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{fmtPct(total)}</td><td className="table-td" /></tr></tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal?.type === 'create' && <TemplateFormModal onClose={() => setModal(null)} onSaved={handleSaved} />}
      {modal?.type === 'edit'   && <TemplateFormModal template={modal.template} onClose={() => setModal(null)} onSaved={handleSaved} />}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Delete Template"
          message={`Delete "${modal.template.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
