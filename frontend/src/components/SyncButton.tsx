import { useState } from 'react';

interface SyncResult {
  jobId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  recordsFetched: number;
  recordsUpserted: number;
  yahooTicker: string | null;
  error?: string;
}

interface Props {
  instrumentId: string;
  onSuccess?: () => void;
}

export default function SyncButton({ instrumentId, onSuccess }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleSync() {
    setState('loading');
    setResult(null);
    try {
      const res = await fetch(`/api/instruments/${instrumentId}/sync`, { method: 'POST' });
      const data: SyncResult = await res.json();
      setResult(data);
      setState(data.status === 'FAILED' ? 'error' : 'done');
      if (data.status === 'SUCCESS' || data.status === 'PARTIAL') onSuccess?.();
    } catch (e: any) {
      setState('error');
      setResult({ jobId: '', status: 'FAILED', recordsFetched: 0, recordsUpserted: 0, yahooTicker: null, error: e.message });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={state === 'loading'}
        className="btn-primary flex items-center gap-2"
      >
        {state === 'loading' ? (
          <>
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Syncing…
          </>
        ) : (
          <>
            <span>⟳</span> Sync from Yahoo Finance
          </>
        )}
      </button>

      {result && (
        <div className={`rounded-lg px-3 py-2 text-xs border ${
          state === 'error'
            ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/40 dark:border-red-800 dark:text-red-300'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300'
        }`}>
          {state === 'error' ? (
            <span>✗ {result.error ?? 'Sync failed'}</span>
          ) : (
            <span>
              ✓ {result.recordsUpserted} price{result.recordsUpserted !== 1 ? 's' : ''} saved
              {result.yahooTicker && (
                <span className="ml-2 opacity-75">via {result.yahooTicker}</span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
