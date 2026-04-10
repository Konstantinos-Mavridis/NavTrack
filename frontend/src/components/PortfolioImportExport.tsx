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

  function openModal() {
    setMessage('');
    setError('');
    setOpen(true);
  }

  function closeModal() {
    if (working) return; // block close while a request is in-flight
    setOpen(false);
    setMessage('');
    setError('');
  }

  async function handleExportJson() {
    setError(''); setMessage(''); setWorking('export-json');
    try {
      const data = await api.portfolios.exportJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `portfolio-export-${todayStamp()}.json`);
      setMessage('JSON export downloaded.');
    } catch (e: any) { setError(e.message); }
    finally { setWorking(null); }
  }

  async function handleExportCsv() {
    setError(''); setMessage(''); setWorking('export-csv');
    try {
      const csv = await api.portfolios.exportCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, `portfolio-export-${todayStamp()}.csv`);
      setMessage('CSV export downloaded.');
    } catch (e: any) { setError(e.message); }
    finally { setWorking(null); }
  }

  async function handleImportJson(file: File) {
    setError(''); setMessage(''); setWorking('import-json');
    try {
      const text    = await file.text();
      const payload = JSON.parse(text);
      const result  = await api.portfolios.importJson(payload);
      setMessage(formatImportSummary(result));
      onImported?.();
    } catch (e: any) { setError(e.message); }
    finally {
      setWorking(null);
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    }
  }

  async function handleImportCsv(file: File) {
    setError(''); setMessage(''); setWorking('import-csv');
    try {
      const text   = await file.text();
      const result = await api.portfolios.importCsv(text);
      setMessage(formatImportSummary(result));
      onImported?.();
    } catch (e: any) { setError(e.message); }
    finally {
      setWorking(null);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  }

  return (
    <>
      {/* Trigger */}
      <button onClick={openModal} className="btn-secondary text-sm py-1.5">
        ⇅ Import / Export
      </button>

      {/* Hidden file inputs (outside modal so they survive re-renders) */}
      <input
        ref={jsonInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportJson(f); }}
      />
      <input
        ref={csvInputRef}
        type="file"
        accept="text/csv,.csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportCsv(f); }}
      />

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Import / Export</h2>
              <button
                onClick={closeModal}
                disabled={!!working}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">

              {/* Export section */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Export</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleExportJson}
                    disabled={!!working}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <span className="text-2xl">{working === 'export-json' ? '⏳' : '📄'}</span>
                    <span className="text-sm font-medium text-gray-700">
                      {working === 'export-json' ? 'Exporting…' : 'JSON'}
                    </span>
                    <span className="text-xs text-gray-400">Full data backup</span>
                  </button>
                  <button
                    onClick={handleExportCsv}
                    disabled={!!working}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <span className="text-2xl">{working === 'export-csv' ? '⏳' : '📊'}</span>
                    <span className="text-sm font-medium text-gray-700">
                      {working === 'export-csv' ? 'Exporting…' : 'CSV'}
                    </span>
                    <span className="text-xs text-gray-400">Spreadsheet-friendly</span>
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Import section */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Import</p>
                <p className="text-xs text-gray-400 mb-3">Existing transactions with matching ISINs will be skipped.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => jsonInputRef.current?.click()}
                    disabled={!!working}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                  >
                    <span className="text-2xl">{working === 'import-json' ? '⏳' : '📥'}</span>
                    <span className="text-sm font-medium text-gray-700">
                      {working === 'import-json' ? 'Importing…' : 'JSON'}
                    </span>
                    <span className="text-xs text-gray-400">.json file</span>
                  </button>
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    disabled={!!working}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                  >
                    <span className="text-2xl">{working === 'import-csv' ? '⏳' : '📥'}</span>
                    <span className="text-sm font-medium text-gray-700">
                      {working === 'import-csv' ? 'Importing…' : 'CSV'}
                    </span>
                    <span className="text-xs text-gray-400">.csv file</span>
                  </button>
                </div>
              </div>

              {/* Feedback */}
              {message && (
                <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  ✓ {message}
                </p>
              )}
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  ⚠ {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={closeModal}
                disabled={!!working}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                Close
              </button>
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
  a.href     = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function todayStamp() {
  const d   = new Date();
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
