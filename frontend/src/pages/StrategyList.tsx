import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Strategy, Instrument } from '../types';
import { Spinner, ErrorBanner } from '../components/ui';
import StrategyFormModal from '../components/StrategyFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { fmtPct } from '../utils/format';

type Modal =
  | { type: 'create' }
  | { type: 'edit'; strategy: Strategy }
  | { type: 'delete'; strategy: Strategy };

export default function StrategyList() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [instruments, setInstruments] = useState<Record<string, Instrument>>({});
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState('');
  const [modal,   setModal]     = useState<Modal | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      const [strats, insts] = await Promise.all([
        api.strategies.list(),
        api.instruments.list(),
      ]);
      setStrategies(strats);
      const map: Record<string, Instrument> = {};
      insts.forEach((i) => { map[i.id] = i; });
      setInstruments(map);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    if (modal?.type !== 'delete') return;
    setDeleting(true);
    try {
      await api.strategies.delete(modal.strategy.id);
      setStrategies((prev) => prev.filter((s) => s.id !== modal.strategy.id));
      setModal(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  function handleSaved(s: Strategy) {
    setModal(null);
    setStrategies((prev) => {
      const idx = prev.findIndex((x) => x.id === s.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = s;
        return next;
      }
      return [...prev, s];
    });
  }

  if (loading) return <Spinner />;
  if (error)   return <div className="p-6"><ErrorBanner message={error} /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Strategies</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage allocation strategies for your portfolios</p>
        </div>
        <button onClick={() => setModal({ type: 'create' })} className="btn-primary">
          + New Strategy
        </button>
      </div>

      {strategies.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          <p className="text-5xl mb-4">🎯</p>
          <p className="text-lg font-medium mb-2 text-gray-600 dark:text-gray-400">No strategies yet</p>
          <p className="text-sm mb-6">Create your first strategy to define target allocations.</p>
          <button onClick={() => setModal({ type: 'create' })} className="btn-primary">Create Strategy</button>
        </div>
      ) : (
        <div className="grid gap-5">
          {strategies.map((strategy) => {
            const totalWeight = strategy.allocations.reduce((sum, a) => sum + a.weight, 0);
            const isBalanced  = Math.abs(totalWeight - 100) < 0.01;

            return (
              <div key={strategy.id} className="card p-6 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{strategy.name}</h2>
                    {strategy.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{strategy.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setModal({ type: 'edit', strategy })}
                      className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors"
                      title="Edit strategy"
                    >✎</button>
                    <button
                      onClick={() => setModal({ type: 'delete', strategy })}
                      className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
                      title="Delete strategy"
                    >✕</button>
                  </div>
                </div>

                {strategy.allocations.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">No allocations defined.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table text-sm">
                      <thead>
                        <tr>
                          <th className="table-th">Instrument</th>
                          <th className="table-th text-right">Target Weight</th>
                          <th className="table-th">Bar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {strategy.allocations.map((alloc) => {
                          const inst = instruments[alloc.instrumentId];
                          return (
                            <tr key={alloc.instrumentId} className="table-row">
                              <td className="table-td font-medium max-w-xs">
                                <Link
                                  to={`/instruments/${alloc.instrumentId}`}
                                  className="text-blue-600 dark:text-blue-400 hover:underline truncate block"
                                >
                                  {inst ? inst.name : alloc.instrumentId}
                                </Link>
                              </td>
                              <td className="table-td text-right font-mono">{fmtPct(alloc.weight)}</td>
                              <td className="table-td w-40">
                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                                  <div
                                    className="bg-blue-500 h-1.5 rounded-full"
                                    style={{ width: `${Math.min(alloc.weight, 100)}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="table-td text-xs text-gray-400 dark:text-gray-500">Total</td>
                          <td className={`table-td text-right font-mono font-semibold text-xs ${
                            isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                          }`}>{fmtPct(totalWeight)}</td>
                          <td className="table-td" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal?.type === 'create' && (
        <StrategyFormModal onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {modal?.type === 'edit' && (
        <StrategyFormModal strategy={modal.strategy} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Delete Strategy"
          message={`Delete "${modal.strategy.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
