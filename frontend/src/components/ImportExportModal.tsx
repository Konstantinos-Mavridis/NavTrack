import { useRef, useState } from 'react';

type WorkingState = 'export-json' | 'export-csv' | 'import-json' | 'import-csv' | null;

interface Feedback {
  message?: string;
  error?: string;
}

export interface ImportExportConfig {
  label: string;
  onExportJson: () => Promise<any[]>;
  onExportCsv: () => Promise<string>;
  onImportJson: (data: any[]) => Promise<string>;
  onImportCsv: (csv: string) => Promise<string>;
  exportJsonFilename: string;
  exportCsvFilename: string;
  importJsonAccept?: string;
  csvHint?: string;
}

interface Props {
  config: ImportExportConfig;
  onImported?: () => void;
}

export default function ImportExportModal({ config, onImported }: Props) {
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef  = useRef<HTMLInputElement>(null);

  const [open,     setOpen]     = useState(false);
  const [working,  setWorking]  = useState<WorkingState>(null);
  const [feedback, setFeedback] = useState<Feedback>({});

  function openModal()  { setFeedback({}); setOpen(true); }
  function closeModal() { if (working) return; setOpen(false); setFeedback({}); }

  async function handleExportJson() {
    setFeedback({}); setWorking('export-json');
    try {
      const data = await config.onExportJson();
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), config.exportJsonFilename);
      setFeedback({ message: 'JSON export downloaded.' });
    } catch (e: any) { setFeedback({ error: e.message }); }
    finally { setWorking(null); }
  }

  async function handleExportCsv() {
    setFeedback({}); setWorking('export-csv');
    try {
      const csv = await config.onExportCsv();
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), config.exportCsvFilename);
      setFeedback({ message: 'CSV export downloaded.' });
    } catch (e: any) { setFeedback({ error: e.message }); }
    finally { setWorking(null); }
  }

  async function handleImportJson(file: File) {
    setFeedback({}); setWorking('import-json');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const arr  = Array.isArray(data) ? data : (Object.values(data)[0] as any[]);
      const msg  = await config.onImportJson(arr);
      setFeedback({ message: msg });
      onImported?.();
    } catch (e: any) { setFeedback({ error: e.message }); }
    finally { setWorking(null); if (jsonInputRef.current) jsonInputRef.current.value = ''; }
  }

  async function handleImportCsv(file: File) {
    setFeedback({}); setWorking('import-csv');
    try {
      const csv = await file.text();
      const msg = await config.onImportCsv(csv);
      setFeedback({ message: msg });
      onImported?.();
    } catch (e: any) { setFeedback({ error: e.message }); }
    finally { setWorking(null); if (csvInputRef.current) csvInputRef.current.value = ''; }
  }

  return (
    <>
      <button onClick={openModal} className="btn-secondary text-sm py-1.5">⇅ Import / Export</button>

      <input ref={jsonInputRef} type="file" accept={config.importJsonAccept ?? 'application/json,.json'}
        className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportJson(f); }} />
      <input ref={csvInputRef} type="file" accept="text/csv,.csv"
        className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportCsv(f); }} />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{config.label} — Import / Export</h2>
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
                  <ActionCard emoji={working === 'export-json' ? '⏳' : '📄'}
                    label={working === 'export-json' ? 'Exporting…' : 'JSON'}
                    sub="Full data backup" disabled={!!working} hoverColor="blue" onClick={handleExportJson} />
                  <ActionCard emoji={working === 'export-csv' ? '⏳' : '📊'}
                    label={working === 'export-csv' ? 'Exporting…' : 'CSV'}
                    sub="Spreadsheet-friendly" disabled={!!working} hoverColor="blue" onClick={handleExportCsv} />
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800" />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Import</p>
                {config.csvHint && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{config.csvHint}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <ActionCard emoji={working === 'import-json' ? '⏳' : '📥'}
                    label={working === 'import-json' ? 'Importing…' : 'JSON'}
                    sub=".json file" disabled={!!working} hoverColor="emerald"
                    onClick={() => jsonInputRef.current?.click()} />
                  <ActionCard emoji={working === 'import-csv' ? '⏳' : '📥'}
                    label={working === 'import-csv' ? 'Importing…' : 'CSV'}
                    sub=".csv file" disabled={!!working} hoverColor="emerald"
                    onClick={() => csvInputRef.current?.click()} />
                </div>
              </div>

              {feedback.message && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-700 rounded-lg px-3 py-2">
                  ✓ {feedback.message}
                </p>
              )}
              {feedback.error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-700 rounded-lg px-3 py-2">
                  ⚠ {feedback.error}
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

function ActionCard({
  emoji, label, sub, disabled, hoverColor, onClick,
}: {
  emoji: string; label: string; sub: string;
  disabled: boolean; hoverColor: 'blue' | 'emerald';
  onClick: () => void;
}) {
  const hover = hoverColor === 'blue'
    ? 'hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'
    : 'hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30';
  return (
    <button
      onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 transition-colors disabled:opacity-50 ${hover}`}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      <span className="text-xs text-gray-400 dark:text-gray-500">{sub}</span>
    </button>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
