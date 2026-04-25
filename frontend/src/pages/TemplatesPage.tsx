import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AllocationTemplate } from '../types';
import { Spinner, ErrorBanner, AssetClassChip } from '../components/ui';
import TemplateFormModal from '../components/TemplateFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import ImportExportModal from '../components/ImportExportModal';

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; template: AllocationTemplate }
  | { type: 'delete'; template: AllocationTemplate }
  | null;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<AllocationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      setTemplates(await api.templates.list());
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleSaved(saved: AllocationTemplate) {
    setModal(null);
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === saved.id);
      const next = exists
        ? prev.map((t) => (t.id === saved.id ? saved : t))
        : [...prev, saved];
      return next.sort((a, b) => a.code.localeCompare(b.code));
    });
  }

  async function handleDelete() {
    if (modal?.type !== 'delete') return;
    setDeleting(true);
    try {
      await api.templates.delete(modal.template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== modal.template.id));
      setModal(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <Spinner />;

  const importExportConfig = {
    label: 'Templates',
    onExportJson: () => api.templates.exportJson(),
    onExportCsv:  () => api.templates.exportCsv(),
    onImportJson: async (data: any[]) => {
      const r = await api.templates.importJson(data);
      return `Imported ${r.imported} template${r.imported !== 1 ? 's' : ''}${
        r.skipped ? `, skipped ${r.skipped} (code already exists)` : ''
      }${r.missingIsins?.length ? `. Unknown ISINs: ${r.missingIsins.join(', ')}` : ''}.`;
    },
    onImportCsv: async (csv: string) => {
      const r = await api.templates.importCsv(csv);
      return `Imported ${r.imported} template${r.imported !== 1 ? 's' : ''}${
        r.skipped ? `, skipped ${r.skipped} (code already exists)` : ''
      }${r.missingIsins?.length ? `. Unknown ISINs: ${r.missingIsins.join(', ')}` : ''}.`;
    },
    exportJsonFilename: 'templates-export.json',
    exportCsvFilename:  'templates-export.csv',
    csvHint: 'Columns: code, description, isin, weight (one row per fund per template)',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-500 mt-1">Create reusable fund allocations for bulk BUY transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportExportModal config={importExportConfig} onImported={load} />
          <button onClick={() => setModal({ type: 'create' })} className="btn-primary">
            + New Template
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error} />
        </div>
      )}

      {templates.length === 0 ? (
        <div className="text-center py-20 text-gray-400 card">
          <p className="text-lg font-medium mb-2">No templates yet</p>
          <p className="text-sm mb-6">Create a template to buy predefined allocations in one step.</p>
          <button onClick={() => setModal({ type: 'create' })} className="btn-primary">
            Create Template
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => {
            const totalWeight = template.items.reduce((acc, i) => acc + Number(i.weight), 0);
            return (
              <div key={template.id} className="card p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{template.code}</h2>
                    {template.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{template.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {template.items.length} fund{template.items.length !== 1 ? 's' : ''} - total {totalWeight.toFixed(4)}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setModal({ type: 'edit', template })}
                      className="btn-secondary text-sm py-1.5"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setModal({ type: 'delete', template })}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="table-th">Fund</th>
                        <th className="table-th">ISIN</th>
                        <th className="table-th">Class</th>
                        <th className="table-th">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {template.items
                        .slice()
                        .sort((a, b) => Number(b.weight) - Number(a.weight))
                        .map((item) => (
                          <tr key={item.id ?? item.instrumentId}>
                            <td className="table-td text-left font-medium text-gray-800">
                              {item.instrument?.name ?? item.instrumentId}
                            </td>
                            <td className="table-td font-mono text-xs text-gray-500">
                              {item.instrument?.isin.trim() ?? '—'}
                            </td>
                            <td className="table-td">
                              {item.instrument ? <AssetClassChip ac={item.instrument.assetClass} /> : '—'}
                            </td>
                            <td className="table-td font-semibold">{Number(item.weight).toFixed(4)}%</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal?.type === 'create' && (
        <TemplateFormModal onSaved={handleSaved} onClose={() => setModal(null)} />
      )}

      {modal?.type === 'edit' && (
        <TemplateFormModal
          template={modal.template}
          onSaved={handleSaved}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Delete Template"
          message={`Delete template "${modal.template.code}"?`}
          confirmLabel={deleting ? 'Deleting...' : 'Delete Template'}
          onConfirm={handleDelete}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
