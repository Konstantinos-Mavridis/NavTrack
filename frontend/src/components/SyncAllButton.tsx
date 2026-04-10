import { useState } from 'react';

interface SyncResult {
  isin: string;
  instrumentId: string;
  yahooTicker: string | null;
  status: string;
  recordsFetched: number;
  recordsUpserted: number;
  error?: string;
}

interface Props {
  onComplete?: () => void;
}

type SyncMode = 'incremental' | 'force';

export default function SyncAllButton({ onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SyncResult[]>([]);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<SyncMode>('incremental');

  async function handleSyncAll(nextMode: SyncMode) {
    if (nextMode === 'force') {
      const ok = window.confirm(
        'Force refresh will re-fetch full history and overwrite existing NAV values. Continue?',
      );
      if (!ok) return;
    }

    setMode(nextMode);
    setLoading(true);
    setResults([]);
    setError('');
    setOpen(true);

    const url = nextMode === 'force'
      ? '/api/sync/all?refresh=true&overwrite=true'
      : '/api/sync/all';

    try {
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SyncResult[] = await res.json();
      setResults(data);
      onComplete?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const succeeded = results.filter((r) => r.status === 'SUCCESS').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => handleSyncAll('incremental')}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          {loading && mode === 'incremental' ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              Syncing all...
            </>
          ) : (
            <>Sync All NAV</>
          )}
        </button>

        <button
          onClick={() => handleSyncAll('force')}
          disabled={loading}
          className="px-3 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          title="Re-fetch full history and overwrite existing NAV prices"
        >
          {loading && mode === 'force' ? 'Force syncing...' : 'Force Refresh NAV'}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  {mode === 'force' ? 'Force Refresh All Instruments' : 'Sync All Instruments'}
                </h2>
                {!loading && results.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {succeeded} succeeded - {failed} failed - {results.length} total
                  </p>
                )}
                {loading && (
                  <p className="text-xs text-blue-500 mt-0.5 animate-pulse">
                    Fetching from Yahoo Finance...
                  </p>
                )}
              </div>
              {!loading && (
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  x
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-3 space-y-2">
              {loading && results.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              {results.map((r) => (
                <div
                  key={r.instrumentId}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border ${
                    r.status === 'SUCCESS'
                      ? 'bg-emerald-50 border-emerald-100'
                      : r.status === 'FAILED'
                      ? 'bg-red-50 border-red-100'
                      : 'bg-yellow-50 border-yellow-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span>{r.status === 'SUCCESS' ? 'OK' : r.status === 'FAILED' ? 'ERR' : '~'}</span>
                    <div className="min-w-0">
                      <span className="font-mono text-xs text-gray-500">{r.isin.trim()}</span>
                      {r.yahooTicker && (
                        <span className="ml-2 text-gray-400 text-xs">to {r.yahooTicker}</span>
                      )}
                      {r.error && (
                        <p className="text-red-500 text-xs truncate">{r.error}</p>
                      )}
                    </div>
                  </div>
                  {r.status === 'SUCCESS' && (
                    <span className="text-emerald-600 text-xs font-medium shrink-0 ml-2">
                      +{r.recordsUpserted} prices
                    </span>
                  )}
                </div>
              ))}
            </div>

            {!loading && (
              <div className="px-6 py-4 border-t border-gray-100">
                <button onClick={() => setOpen(false)} className="btn-secondary w-full text-sm">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
