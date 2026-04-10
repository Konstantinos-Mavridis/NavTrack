import { useEffect, useState } from 'react';

interface SyncJob {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  source: string;
  recordsFetched: number;
  recordsUpserted: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string;
}

interface Props {
  instrumentId: string;
  refreshKey?: number;
}

export default function SyncJobHistory({ instrumentId, refreshKey = 0 }: Props) {
  const [jobs,    setJobs]    = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    async function fetchJobs() {
      try {
        const res = await fetch(`/api/instruments/${instrumentId}/sync/jobs?limit=10`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setJobs(await res.json());
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    }

    void fetchJobs();
  }, [instrumentId, refreshKey]);

  if (loading) return null;
  if (!jobs.length) return null;

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Sync History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              {['Date', 'Status', 'Message', 'Fetched', 'Saved', 'Triggered by'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-2 font-mono text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {new Date(job.startedAt).toLocaleString('el-GR', {
                    dateStyle: 'short', timeStyle: 'short',
                  })}
                </td>
                <td className="px-4 py-2">
                  <StatusChip status={job.status} />
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400 font-mono">
                  {job.errorMessage
                    ? <span className="text-red-400 dark:text-red-400 truncate max-w-[12rem] block" title={job.errorMessage}>{job.errorMessage}</span>
                    : '—'}
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400 tabular-nums">{job.recordsFetched}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400 tabular-nums">{job.recordsUpserted}</td>
                <td className="px-4 py-2 text-gray-400 dark:text-gray-500">{job.triggeredBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SUCCESS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    PARTIAL: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    FAILED:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    RUNNING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    PENDING: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      styles[status] ?? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
    }`}>
      {status}
    </span>
  );
}
