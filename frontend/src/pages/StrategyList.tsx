import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Instrument, AllocationTemplate } from '../types';
import { Spinner, ErrorBanner, RiskBadge, AssetClassChip, EmptyState } from '../components/ui';
import SyncAllButton from '../components/SyncAllButton';
import TemplateFormModal from '../components/TemplateFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import ImportExportModal from '../components/ImportExportModal';
import TemplatePerformanceChart from '../components/TemplatePerformanceChart';

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; template: AllocationTemplate }
  | { type: 'delete'; template: AllocationTemplate }
  | null;

export default function StrategyList() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [instLoading, setInstLoading] = useState(true);
  const [instError,   setInstError]   = useState('');
  const [search,      setSearch]      = useState('');

  async function loadInstruments() {
    try {
      setInstruments(await api.instruments.list());
      setInstError('');
    } catch (e: any) {
      setInstError(e.message);
    } finally {
      setInstLoading(false);
    }
  }

  useEffect(() => { loadInstruments(); }, []);

  const filtered = instruments.filter((i) => {
    const q = search.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      i.isin.toLowerCase().includes(q) ||
      i.assetClass.toLowerCase().includes(q)
    );
  });

  const [templates,   setTemplates]   = useState<AllocationTemplate[]>([]);
  const [tmplLoading, setTmplLoading] = useState(true);
  const [tmplError,   setTmplError]   = useState('');
  const [modal,       setModal]       = useState<ModalState>(null);

  async function loadTemplates() {
    try {
      setTemplates(await api.templates.list());
      setTmplError('');
    } catch (e: any) {
      setTmplError(e.message);
    } finally {
      setTmplLoading(false);
    }
  }

  useEffect(() => { loadTemplates(); }, []);

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
    await api.templates.delete(modal.template.id);
    setTemplates((prev) => prev.filter((t) => t.id !== modal.template.id));
    setModal(null);
  }

  if (instLoading || tmplLoading) return <Spinner />;

  const instrumentImportExportConfig = {
    label: 'Instruments',
    onExportJson: () => api.instruments.exportJson(),
    onExportCsv:  () => api.instruments.exportCsv(),
    onImportJson: async (data: any[]) => {
      const r = await api.instruments.importJson(data);
      return `Imported ${r.imported} instrument${r.imported !== 1 ? 's' : ''}${
        r.skipped ? `, skipped ${r.skipped} (ISIN already exists)` : ''
      }.`;
    },
    onImportCsv: async (csv: string) => {
      const r = await api.instruments.importCsv(csv);
      return `Imported ${r.imported} instrument${r.imported !== 1 ? 's' : ''}${
        r.skipped ? `, skipped ${r.skipped} (ISIN already exists)` : ''
      }.`;
    },
    exportJsonFilename: 'instruments-export.json',
    exportCsvFilename:  'instruments-export.csv',
    csvHint: 'Columns: name, isin, currency, assetClass, riskLevel, dataSources, externalIds',
  };

  const templateImportExportConfig = {
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

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Strategies</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Allocation templates and tracked instruments</p>
        </div>
      </div>


      {/* ── Allocation Templates section ── */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Allocation Templates</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Reusable fund allocations for bulk BUY transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportExportModal config={templateImportExportConfig} onImported={loadTemplates} />
          <button onClick={() => setModal({ type: 'create' })} className="btn-primary">
            + New Template
          </button>
        </div>
      </div>

      {tmplError && <div className="mb-6"><ErrorBanner message={tmplError} /></div>}

      {templates.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500 card mb-10">
          <p className="text-lg font-medium mb-2 text-gray-600 dark:text-gray-400">No templates yet</p>
          <p className="text-sm mb-6">Create a template to buy predefined allocations in one step.</p>
          <button onClick={() => setModal({ type: 'create' })} className="btn-primary">
            Create Template
          </button>
        </div>
      ) : (
        <div className="grid gap-4 mb-10">
          {templates.map((template) => {
            const totalWeight = template.items.reduce((acc, i) => acc + Number(i.weight), 0);
            const isEditing = modal?.type === 'edit' && modal.template.id === template.id;
            return (
              <div key={template.id} className="card p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{template.code}</h3>
                    {template.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{template.description}</p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {template.items.length} fund{template.items.length !== 1 ? 's' : ''} · total {totalWeight.toFixed(4)}%
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
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <TemplatePerformanceChart templateId={template.id} paused={isEditing} />

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/60">
                      <tr>
                        <th className="table-th">Fund</th>
                        <th className="table-th">ISIN</th>
                        <th className="table-th">Class</th>
                        <th className="table-th">Risk</th>
                        <th className="table-th">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {template.items
                        .slice()
                        .sort((a, b) => Number(b.weight) - Number(a.weight))
                        .map((item) => (
                          <tr key={item.id ?? item.instrumentId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="table-td text-left font-medium">
                              {item.instrument ? (
                                <Link
                                  to={`/instruments/${item.instrument.id}`}
                                  className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  {item.instrument.name}
                                </Link>
                              ) : (
                                <span className="text-gray-800 dark:text-gray-200">{item.instrumentId}</span>
                              )}
                            </td>
                            <td className="table-td font-mono text-xs text-gray-500 dark:text-gray-400">
                              {item.instrument?.isin.trim() ?? '—'}
                            </td>
                            <td className="table-td">
                              {item.instrument ? <AssetClassChip ac={item.instrument.assetClass} /> : '—'}
                            </td>
                            <td className="table-td">
                              {item.instrument ? <RiskBadge level={item.instrument.riskLevel ?? 0} /> : '—'}
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

      {/* ── Instruments section ── */}
      <div className="flex items-start justify-between mt-16 mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Instruments</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{instruments.length} funds tracked</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ImportExportModal config={instrumentImportExportConfig} onImported={loadInstruments} />
          <input
            type="search"
            placeholder="Search by name, ISIN or class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-64"
          />
        </div>
      </div>

      {instError && <div className="mb-6"><ErrorBanner message={instError} /></div>}

      <div className="card overflow-hidden mb-2">
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <EmptyState message="No instruments match your search" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  {['Fund Name', 'ISIN', 'Asset Class', 'Risk', 'Currency'].map((h) => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((inst) => (
                  <tr key={inst.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="table-td font-medium max-w-xs">
                      <Link
                        to={`/instruments/${inst.id}`}
                        className="truncate block text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title={inst.name}
                      >
                        {inst.name}
                      </Link>
                    </td>
                    <td className="table-td font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {inst.isin}
                    </td>
                    <td className="table-td"><AssetClassChip ac={inst.assetClass} /></td>
                    <td className="table-td"><RiskBadge level={inst.riskLevel ?? 0} /></td>
                    <td className="table-td text-gray-500 dark:text-gray-400">{inst.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <SyncAllButton onComplete={() => api.instruments.list().then(setInstruments).catch(() => {})} />
      </div>

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
          confirmLabel="Delete Template"
          onConfirm={handleDelete}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
