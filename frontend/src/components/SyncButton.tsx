import { useState } from 'react';
import { ButtonSpinner } from './ui';
import { api } from '../api/client';
import type { SyncResult } from '../types';

interface Props {
  instrumentId: string;
  onSuccess?: () => void;
}

export default function SyncButton({ instrumentId, onSuccess }: Props) {
  const [state, setState]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleSync() {
    setState('loading');
    setResult(null);
    try {
      const data = await api.instruments.sync(instrumentId);
      setResult(data);
      setState(data.status === 'FAILED' ? 'error' : 'done');
      if (data.status === 'SUCCESS' || data.status === 'PARTIAL') onSuccess?.();
    } catch (e: any) {
      setState('error');
      setResult({ jobId: '', status: 'FAILED', recordsFetched: 0, recordsUpserted: 0, yahooTicker: null, error: e.message });
    }
  }

  const loading = state === 'loading';

  return (
    <div className="flex flex-col gap-2">
      {/*
        * aria-busy + pointer-events-none instead of `disabled` so the
        * ButtonSpinner CSS animation is not paused by the browser.
        */}
      <button
        onClick={() => { if (!loading) void handleSync(); }}
        aria-busy={loading}
        className={`btn-primary flex items-center gap-2 ${
          loading ? 'opacity-75 pointer-events-none' : ''
        }`}
      >
        {loading ? (
          <><ButtonSpinner /> Syncing…</>
        ) : (
          <><span>⟳</span> Sync from Yahoo Finance</>
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
