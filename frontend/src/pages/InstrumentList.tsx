import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Instrument } from '../types';
import { Spinner, ErrorBanner, RiskBadge, AssetClassChip, EmptyState } from '../components/ui';
import SyncAllButton from '../components/SyncAllButton';

export default function InstrumentList() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [search, setSearch]           = useState('');

  useEffect(() => {
    api.instruments.list()
      .then(setInstruments)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = instruments.filter((i) => {
    const q = search.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      i.isin.toLowerCase().includes(q) ||
      i.assetClass.toLowerCase().includes(q)
    );
  });

  if (loading) return <Spinner />;
  if (error)   return <div className="p-6"><ErrorBanner message={error} /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Instruments</h1>
          <p className="text-gray-500 mt-1">{instruments.length} funds tracked</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SyncAllButton onComplete={() => api.instruments.list().then(setInstruments).catch(() => {})} />
          <input
            type="search"
            placeholder="Search by name, ISIN or class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <EmptyState message="No instruments match your search" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Fund Name', 'ISIN', 'Asset Class', 'Risk', 'Currency', ''].map((h) => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((inst) => (
                  <tr key={inst.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="table-td font-medium text-gray-900 max-w-xs">
                      <div className="truncate" title={inst.name}>{inst.name}</div>
                    </td>
                    <td className="table-td font-mono text-xs text-gray-500 whitespace-nowrap">
                      {inst.isin}
                    </td>
                    <td className="table-td">
                      <AssetClassChip ac={inst.assetClass} />
                    </td>
                    <td className="table-td">
                      <RiskBadge level={inst.riskLevel} />
                    </td>
                    <td className="table-td text-gray-500">{inst.currency}</td>
                    <td className="table-td">
                      <Link
                        to={`/instruments/${inst.id}`}
                        className="text-blue-500 hover:text-blue-700 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
