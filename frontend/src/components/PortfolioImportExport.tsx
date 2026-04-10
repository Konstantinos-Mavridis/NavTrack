import { useRef, useState } from 'react';
import { api } from '../api/client';
import type { ImportSummary } from '../types';

interface Props {
  onImported?: () => void;
}

type WorkingState = 'export-json' | 'export-csv' | 'import-json' | 'import-csv' | null;

export default function PortfolioImportExport({ onImported }: Props) {
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef  = useRef<HTMLInputElement>(null);

  const [open,    setOpen]    = useState(false);
  const [working, setWorking] = useState<WorkingState>(null);
  const [message, setMessage] = useState('');
  const [error,   setError]   = useState('');

  function openModal()  { setMessage(''); setError(''); setOpen(true); }
  function closeModal() { if (working) return; setOpen(false); setMessage(''); setError(''); }

  async function handleExportJson() {
    setError(''); setMessage(''); setWorking('export-json');
    try {
      const data = await api.portfolios.exportJson();
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `portfolio-export-${todayStamp()}.json`);
      setMessage('JSON export downloaded.');
    } catch (e: any) { setError(e.message); }
    finally { setWorking(null); }
  }

  async function handleExportCsv() {
    setError(''); setMessage(''); setWorking('export-csv');
    try {
      const csv = await api.portfolios.exportCsv();
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `portfolio-export-${todayStamp()}.csv`);
      setMessage('CSV export downloaded.');
    } catch (e: any) { setError(e.message); }
    finally { setWorking(null); }
  }

  async function recalculateAll() {
    try {
      const portfolios = await api.portfolios.list();
      await Promise.all(portfolios.map((p) => api.positions.recalculate(p.id)));
    } catch {}
  }

  async function handleImportJson(file: File) {
    setError(''); setMessage(''); setWorking('import-json');
    try {
      const text    = await file.text();
      const payload = JSON.parse(text);
      const result  = await api.portfolios.importJson(payload);
      if (result.portfoliosImported > 0) await recalculateAll();
      setMessage(formatImportSummary(result));
      onImported?.();
    } catch (e: any) { setError(e.message); }
    finally { setWorking(null); if (jsonInputRef.current) jsonInputRef.current.value = ''; }
  }

  async function handleImportCsv(file: File) {
    setError(''); setMessage(''); setWorking('import-csv');
    try {
      const text   = await file.text();
      const result = await api.portfolios.importCsv(text);
      if (result.portfoliosImported > 0) await recalculateAll();
      setMessage(formatImportSummary(result));
      onImported?.();
    } catch (e: any) { setError(e.message); }
    finally { setWorking(null); if (csvInputRef.current) csvInputRef.current.value = ''; }
  }

  return (
    <>
      <button onClick={openModal} className="btn-secondary text-sm py-1.5">⇅ Import / Export</button>

      <input ref={jsonInputRef} type="file" accept="application/json,.json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportJson(f); }} />
      <input ref={csvInputRef} type="file" accept="text/csv,.csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportCsv(f); }} />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Import / Export</h2>
              <button
                onClick={closeModal} disabled={!!working}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
                aria-label="Close"
              >✕</button>
            </div>

            <div className="px-6 py-5 space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Export</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleExportJson} disabled={!!working}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
                  >
                    <span className="text-2xl">{working === 'export-json' ? '⏳' : '📄'}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{working === 'export-json' ? 'Exporting…' : 'JSON'}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">Full data backup</span>
                  </button>
                  <button onClick={handleExportCsv} disabled={!!working}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
                  >
                    <span className="text-2xl">{working === 'export-csv' ? '⏳' : '📊'}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{working === 'export-csv' ? 'Exporting…' : 'CSV'}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">Spreadsheet-friendly</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800" />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Import</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Portfolios are created fresh; positions are recalculated automatically from the imported transactions.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => jsonInputRef.current?.click()} disabled={!!working}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
                  >
                    <span className="text-2xl">{working === 'import-json' ? '⏳' : '📥'}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{working === 'import-json' ? 'Importing…' : 'JSON'}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">.json file</span>
                  </button>
                  <button onClick={() => csvInputRef.current?.click()} disabled={!!working}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
                  >
                    <span className="text-2xl">{working === 'import-csv' ? '⏳' : '📥'}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{working === 'import-csv' ? 'Importing…' : 'CSV'}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">.csv file</span>
                  </button>
                </div>
              </div>

              {message && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-700 rounded-lg px-3 py-2">
                  ✓ {message}
                </p>
              )}
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-700 rounded-lg px-3 py-2">
                  ⚠ {error}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button onClick={closeModal} disabled={!!working} className="btn-secondary text-sm disabled:opacity-40">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatImportSummary(r: ImportSummary): string {
  const missing = r.missingInstruments.length
    ? ` Missing ISINs: ${r.missingInstruments.join(', ')}`
    : '';
  return `Imported ${r.portfoliosImported} portfolios, ${r.transactionsImported} transactions, skipped ${r.transactionsSkipped}.${missing}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function todayStamp() {
  const d   = new Date();
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
