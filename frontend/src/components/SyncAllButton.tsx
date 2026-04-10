import { useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { ErrorBanner } from './ui';
import { api } from '../api/client';
import type { Instrument } from '../types';

// ─── Per-instrument row state ─────────────────────────────────────────────────
type RowStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed';

interface InstrumentRow {
  instrument: Instrument;
  status: RowStatus;
  recordsUpserted: number;
  yahooTicker: string | null;
  error?: string;
}

interface Props {
  onComplete?: () => void;
}

type SyncMode = 'incremental' | 'force';

export default function SyncAllButton({ onComplete }: Props) {
  const [open,         setOpen]         = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [rows,         setRows]         = useState<InstrumentRow[]>([]);
  const [fetchError,   setFetchError]   = useState('');
  const [mode,         setMode]         = useState<SyncMode>('incremental');
  const [confirmForce, setConfirmForce] = useState(false);

  // ── helpers ────────────────────────────────────────────────────────────────
  function patchRow(id: string, patch: Partial<InstrumentRow>) {
    setRows((prev) =>
      prev.map((r) => (r.instrument.id === id ? { ...r, ...patch } : r)),
    );
  }

  // ── main sync logic ────────────────────────────────────────────────────────
  async function runSync(nextMode: SyncMode) {
    setMode(nextMode);
    setFetchError('');
    setRows([]);
    setOpen(true);
    setLoading(true);

    // Step 1 — fetch instrument list so we can show pending rows immediately
    let instruments: Instrument[];
    try {
      instruments = await api.instruments.list();
    } catch (e: any) {
      setFetchError(`Could not load instruments: ${e.message}`);
      setLoading(false);
      return;
    }

    if (instruments.length === 0) {
      setFetchError('No instruments found.');
      setLoading(false);
      return;
    }

    // Step 2 — seed every row as pending so the user can see the full list
    setRows(
      instruments.map((inst) => ({
        instrument: inst,
        status: 'pending',
        recordsUpserted: 0,
        yahooTicker: null,
      })),
    );

    // Step 3 — sync instruments one by one, updating each row in real-time
    const suffix = nextMode === 'force' ? '?refresh=true&overwrite=true' : '';

    for (const inst of instruments) {
      patchRow(inst.id, { status: 'running' });
      try {
        const res = await fetch(`/api/instruments/${inst.id}/sync${suffix}`, {
          method: 'POST',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as {
          status: string;
          recordsUpserted: number;
          yahooTicker: string | null;
          error?: string;
        };
        patchRow(inst.id, {
          status:
            data.status === 'SUCCESS' ? 'success'
            : data.status === 'PARTIAL' ? 'partial'
            : 'failed',
          recordsUpserted: data.recordsUpserted ?? 0,
          yahooTicker: data.yahooTicker ?? null,
          error: data.error,
        });
      } catch (e: any) {
        patchRow(inst.id, { status: 'failed', error: e.message });
      }
    }

    setLoading(false);
    onComplete?.();
  }

  // ── derived counts ─────────────────────────────────────────────────────────
  const total     = rows.length;
  const done      = rows.filter((r) => r.status === 'success' || r.status === 'partial' || r.status === 'failed').length;
  const succeeded = rows.filter((r) => r.status === 'success' || r.status === 'partial').length;
  const failed    = rows.filter((r) => r.status === 'failed').length;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/*
         * aria-busy + pointer-events-none instead of `disabled` while loading
         * so the ButtonSpinner animation is not paused by the browser.
         */}
        <button
          onClick={() => { if (!loading) void runSync('incremental'); }}
          aria-busy={loading && mode === 'incremental'}
          className={`btn-secondary flex items-center gap-2 text-sm ${
            loading ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {loading && mode === 'incremental' ? (
            <>
              {/* Inline style so the animation is not deferred by transition-colors */}
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-blue-500 dark:border-blue-400 border-t-transparent inline-block"
                style={{ animation: 'spin 0.75s linear infinite' }}
                aria-hidden
              />
              Syncing all…
            </>
          ) : 'Sync All NAV'}
        </button>

        <button
          onClick={() => { if (!loading) setConfirmForce(true); }}
          aria-busy={loading && mode === 'force'}
          className={`px-3 py-2 text-sm font-medium rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors ${
            loading ? 'opacity-50 pointer-events-none' : ''
          }`}
          title="Re-fetch full history and overwrite existing NAV prices"
        >
          {loading && mode === 'force' ? (
            <span className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-red-400 border-t-transparent inline-block"
                style={{ animation: 'spin 0.75s linear infinite' }}
                aria-hidden
              />
              Force syncing…
            </span>
          ) : 'Force Refresh NAV'}
        </button>
      </div>

      {/* Force-refresh confirmation */}
      {confirmForce && (
        <ConfirmDialog
          title="Force Refresh All Instruments"
          message="This will re-fetch full history from Yahoo Finance and overwrite existing NAV values. Continue?"
          confirmLabel="Force Refresh"
          confirmingLabel="Starting…"
          danger
          onConfirm={async () => {
            setConfirmForce(false);
            await runSync('force');
          }}
          onCancel={() => setConfirmForce(false)}
        />
      )}

      {/* Progress modal — not closeable while sync is running */}
      {open && (
        <Modal
          title={mode === 'force' ? 'Force Refresh All Instruments' : 'Sync All Instruments'}
          subtitle={
            loading
              ? total > 0
                ? `${done} / ${total} done…`
                : 'Loading instruments…'
              : total > 0
              ? `${succeeded} succeeded · ${failed} failed · ${total} total`
              : undefined
          }
          onClose={() => setOpen(false)}
          closeable={!loading}
          width="max-w-lg"
        >
          {fetchError && <ErrorBanner message={fetchError} />}

          {/* Loading instruments before the list is ready */}
          {loading && rows.length === 0 && !fetchError && (
            <div className="flex items-center justify-center py-10 gap-3 text-gray-400 dark:text-gray-500">
              <span
                className="h-5 w-5 rounded-full border-2 border-blue-400 border-t-transparent inline-block shrink-0"
                style={{ animation: 'spin 0.75s linear infinite' }}
                aria-hidden
              />
              <span className="text-sm">Loading instrument list…</span>
            </div>
          )}

          {/* Per-instrument progress list */}
          {rows.length > 0 && (
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {rows.map((row) => (
                <RowItem key={row.instrument.id} row={row} />
              ))}
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="mt-4">
              <button onClick={() => setOpen(false)} className="btn-secondary w-full text-sm">
                Close
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

// ─── Single instrument row ────────────────────────────────────────────────────
function RowItem({ row }: { row: InstrumentRow }) {
  const { instrument, status, recordsUpserted, yahooTicker, error } = row;

  const containerCls =
    status === 'success' || status === 'partial'
      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800'
      : status === 'failed'
      ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'
      : status === 'running'
      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
      : 'bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-700';

  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border ${containerCls}`}>
      {/* Left: icon + name + isin */}
      <div className="flex items-center gap-2 min-w-0">
        <StatusIcon status={status} />
        <div className="min-w-0">
          <p className="font-medium text-gray-800 dark:text-gray-200 truncate" title={instrument.name}>
            {instrument.name}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
            {instrument.isin}
            {yahooTicker && (
              <span className="ml-2 opacity-75">via {yahooTicker}</span>
            )}
          </p>
          {error && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-0.5 truncate" title={error}>{error}</p>
          )}
        </div>
      </div>

      {/* Right: records count or status label */}
      <div className="shrink-0 ml-3 text-xs font-medium">
        {(status === 'success' || status === 'partial') && (
          <span className="text-emerald-600 dark:text-emerald-400">+{recordsUpserted} prices</span>
        )}
        {status === 'failed' && (
          <span className="text-red-500 dark:text-red-400">failed</span>
        )}
        {status === 'running' && (
          <span className="text-blue-500 dark:text-blue-400">syncing…</span>
        )}
        {status === 'pending' && (
          <span className="text-gray-400 dark:text-gray-500">pending</span>
        )}
      </div>
    </div>
  );
}

// ─── Status icon ──────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: RowStatus }) {
  if (status === 'running') {
    return (
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-blue-500 dark:border-blue-400 border-t-transparent inline-block"
        style={{ animation: 'spin 0.75s linear infinite' }}
        aria-hidden
      />
    );
  }
  if (status === 'success' || status === 'partial') {
    return <span className="text-emerald-500 dark:text-emerald-400 text-base leading-none shrink-0">✓</span>;
  }
  if (status === 'failed') {
    return <span className="text-red-500 dark:text-red-400 text-base leading-none shrink-0">✕</span>;
  }
  // pending
  return (
    <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-600 inline-block" />
  );
}
