import { useRef, useState } from 'react';
import { api } from '../api/client';
import type { ImportSummary } from '../types';

interface Props {
  onImported?: () => void;
}

export default function PortfolioImportExport({ onImported }: Props) {
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleExportJson() {
    setError('');
    setMessage('');
    setWorking(true);
    try {
      const data = await api.portfolios.exportJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `portfolio-export-${todayStamp()}.json`);
      setMessage('JSON export downloaded');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleExportCsv() {
    setError('');
    setMessage('');
    setWorking(true);
    try {
      const csv = await api.portfolios.exportCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, `portfolio-export-${todayStamp()}.csv`);
      setMessage('CSV export downloaded');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleImportJson(file: File) {
    setError('');
    setMessage('');
    setWorking(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await api.portfolios.importJson(payload);
      setMessage(formatImportSummary(result));
      onImported?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking(false);
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    }
  }

  async function handleImportCsv(file: File) {
    setError('');
    setMessage('');
    setWorking(true);
    try {
      const text = await file.text();
      const result = await api.portfolios.importCsv(text);
      setMessage(formatImportSummary(result));
      onImported?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <button onClick={handleExportJson} disabled={working} className="btn-secondary text-sm py-1.5">
          Export JSON
        </button>
        <button onClick={handleExportCsv} disabled={working} className="btn-secondary text-sm py-1.5">
          Export CSV
        </button>

        <button
          onClick={() => jsonInputRef.current?.click()}
          disabled={working}
          className="btn-secondary text-sm py-1.5"
        >
          Import JSON
        </button>
        <input
          ref={jsonInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportJson(file);
          }}
        />

        <button
          onClick={() => csvInputRef.current?.click()}
          disabled={working}
          className="btn-secondary text-sm py-1.5"
        >
          Import CSV
        </button>
        <input
          ref={csvInputRef}
          type="file"
          accept="text/csv,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportCsv(file);
          }}
        />
      </div>

      {message && <p className="text-xs text-emerald-600 text-right">{message}</p>}
      {error && <p className="text-xs text-red-500 text-right">{error}</p>}
    </div>
  );
}

function formatImportSummary(r: ImportSummary): string {
  const missing = r.missingInstruments.length ? ` Missing ISINs: ${r.missingInstruments.join(', ')}` : '';
  return `Imported ${r.portfoliosImported} portfolios, ${r.transactionsImported} transactions, skipped ${r.transactionsSkipped}.${missing}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
