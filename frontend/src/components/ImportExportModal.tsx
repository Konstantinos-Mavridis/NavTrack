import { useRef, useState } from 'react';

type WorkingState = 'export-json' | 'export-csv' | 'import-json' | 'import-csv' | null;

interface Feedback {
  message?: string;
  error?: string;
}

export interface ImportExportConfig {
  /** Label shown in the trigger button and modal header */
  label: string;
  /** Called with the parsed JSON data array on JSON export click */
  onExportJson: () => Promise<any[]>;
  /** Called on CSV export click; should return raw CSV string */
  onExportCsv: () => Promise<string>;
  /** Called with parsed JSON array on JSON file pick; returns a feedback string */
  onImportJson: (data: any[]) => Promise<string>;
  /** Called with raw CSV string on CSV file pick; returns a feedback string */
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

  const [open,    setOpen]    = useState(false);
  const [working, setWorking] = useState<WorkingState>(null);
  const [feedback, setFeedback] = useState<Feedback>({});

  function openModal() { setFeedback({}); setOpen(true); }
  function closeModal() { if (working) return; setOpen(false); setFeedback({}); }

  async function handleExportJson() {
    setFeedback({}); setWorking('export-json');
    try {
      const data = await config.onExportJson();
      downloadBlob(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        config.exportJsonFilename,
      );
      setFeedback({ message: 'JSON export downloaded.' });
    } catch (e: any) { setFeedback({ error: e.message }); }
    finally { setWorking(null); }
  }

  async function handleExportCsv() {
    setFeedback({}); setWorking('export-csv');
    try {
      const csv = await config.onExportCsv();
      downloadBlob(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
        config.exportCsvFilename,
      );
      setFeedback({ message: 'CSV export downloaded.' });
    } catch (e: any) { setFeedback({ error: e.message }); }
    finally { setWorking(null); }
  }

  async function handleImportJson(file: File) {
    setFeedback({}); setWorking('import-json');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // Accept both a bare array and a wrapped object
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
      <button onClick={openModal} className="btn-secondary text-sm py-1.5">
        ⇅ Import / Export
      </button>

      <input
        ref={jsonInputRef} type="file"
        accept={config.importJsonAccept ?? 'application/json,.json'}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportJson(f); }}
      />
      <input
        ref={csvInputRef} type="file" accept="text/csv,.csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportCsv(f); }}
      />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">{config.label} — Import / Export</h2>
              <button
                onClick={closeModal} disabled={!!working}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
                aria-label="Close"
              >✕</button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Export */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Export</p>
                <div className="grid grid-cols-2 gap-3">
                  <ActionCard
                    emoji={working === 'export-json' ? '⏳' : '📄'}
                    label={working === 'export-json' ? 'Exporting…' : 'JSON'}
                    sub="Full data backup"
                    disabled={!!working}
                    hoverColor="blue"
                    onClick={handleExportJson}
                  />
                  <ActionCard
                    emoji={working === 'export-csv' ? '⏳' : '📊'}
                    label={working === 'export-csv' ? 'Exporting…' : 'CSV'}
                    sub="Spreadsheet-friendly"
                    disabled={!!working}
                    hoverColor="blue"
                    onClick={handleExportCsv}
                  />
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* Import */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Import</p>
                {config.csvHint && (
                  <p className="text-xs text-gray-400 mb-3">{config.csvHint}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <ActionCard
                    emoji={working === 'import-json' ? '⏳' : '📥'}
                    label={working === 'import-json' ? 'Importing…' : 'JSON'}
                    sub=".json file"
                    disabled={!!working}
                    hoverColor="emerald"
                    onClick={() => jsonInputRef.current?.click()}
                  />
                  <ActionCard
                    emoji={working === 'import-csv' ? '⏳' : '📥'}
                    label={working === 'import-csv' ? 'Importing…' : 'CSV'}
                    sub=".csv file"
                    disabled={!!working}
                    hoverColor="emerald"
                    onClick={() => csvInputRef.current?.click()}
                  />
                </div>
              </div>

              {feedback.message && (
                <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  ✓ {feedback.message}
                </p>
              )}
              {feedback.error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  ⚠ {feedback.error}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={closeModal} disabled={!!working} className="btn-secondary text-sm disabled:opacity-40">
                Close
              </button>
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
    ? 'hover:border-blue-300 hover:bg-blue-50'
    : 'hover:border-emerald-300 hover:bg-emerald-50';
  return (
    <button
      onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 transition-colors disabled:opacity-50 ${hover}`}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <span className="text-xs text-gray-400">{sub}</span>
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
