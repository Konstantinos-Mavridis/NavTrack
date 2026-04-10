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
  refreshKey?: number;  // increment to force a re-fetch
}

export default function SyncJobHistory({ instrumentId, refreshKey = 0 }: Props) {
  const [jobs, setJobs]     = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/instruments/${instrumentId}/sync/jobs?limit=10`)
      .then((r) => r.json())
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [instrumentId, refreshKey]);

  if (loading) return null;
  if (!jobs.length) return null;

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800 text-sm">Sync History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              {['Date', 'Status', 'Ticker', 'Fetched', 'Saved', 'Triggered by'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-gray-400 whitespace-nowrap">
                  {new Date(job.startedAt).toLocaleString('el-GR', {
                    dateStyle: 'short', timeStyle: 'short',
                  })}
                </td>
                <td className="px-4 py-2">
                  <StatusChip status={job.status} />
                </td>
                <td className="px-4 py-2 text-gray-600 font-mono">
                  {job.errorMessage
                    ? <span className="text-red-400 truncate max-w-[12rem] block" title={job.errorMessage}>{job.errorMessage}</span>
                    : '—'}
                </td>
                <td className="px-4 py-2 text-gray-600 tabular-nums">{job.recordsFetched}</td>
                <td className="px-4 py-2 text-gray-600 tabular-nums">{job.recordsUpserted}</td>
                <td className="px-4 py-2 text-gray-400">{job.triggeredBy}</td>
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
    SUCCESS: 'bg-emerald-100 text-emerald-700',
    PARTIAL: 'bg-yellow-100 text-yellow-700',
    FAILED:  'bg-red-100 text-red-700',
    RUNNING: 'bg-blue-100 text-blue-700',
    PENDING: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}
