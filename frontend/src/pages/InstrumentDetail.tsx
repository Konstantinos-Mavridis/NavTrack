import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Instrument, NavPrice } from '../types';
import {
  Spinner, ErrorBanner, RiskBadge, AssetClassChip, SectionHeading,
} from '../components/ui';
import NavChart from '../components/NavChart';
import SyncButton from '../components/SyncButton';
import SyncJobHistory from '../components/SyncJobHistory';
import { ASSET_CLASS_LABELS, today } from '../utils/format';

export default function InstrumentDetail() {
  const { id } = useParams<{ id: string }>();

  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [navHistory, setNavHistory] = useState<NavPrice[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // Add-NAV form state
  const [navDate, setNavDate]     = useState(today());
  const [navValue, setNavValue]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');
  const [saveErr, setSaveErr]     = useState('');
  const [syncRefreshKey, setSyncRefreshKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.instruments.get(id), api.instruments.navHistory(id)])
      .then(([inst, nav]) => {
        setInstrument(inst);
        setNavHistory(nav);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const latestNav = navHistory[navHistory.length - 1];

  async function handleAddNav(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !navValue) return;
    setSaving(true);
    setSaveMsg('');
    setSaveErr('');
    try {
      await api.instruments.addNav(id, [{ date: navDate, nav: parseFloat(navValue) }]);
      const fresh = await api.instruments.navHistory(id);
      setNavHistory(fresh);
      setSaveMsg(`NAV €${navValue} saved for ${navDate}`);
      setNavValue('');
    } catch (e: any) {
      setSaveErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncSuccess() {
    if (!id) return;
    const fresh = await api.instruments.navHistory(id).catch(() => navHistory);
    setNavHistory(fresh);
    setSyncRefreshKey((k) => k + 1);
  }

  if (loading) return <Spinner />;
  if (error)   return <div className="p-6"><ErrorBanner message={error} /></div>;
  if (!instrument) return null;

  const dataLinks = instrument.dataSources?.filter(Boolean) ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/instruments" className="hover:text-blue-600 transition-colors">Instruments</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium truncate">{instrument.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{instrument.name}</h1>
          <p className="font-mono text-sm text-gray-400 mt-1">{instrument.isin}</p>
        </div>
        <div className="flex gap-2 items-center shrink-0 mt-1">
          <AssetClassChip ac={instrument.assetClass} />
          <RiskBadge level={instrument.riskLevel} />
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Currency',    value: instrument.currency },
          { label: 'Asset Class', value: ASSET_CLASS_LABELS[instrument.assetClass] ?? instrument.assetClass },
          { label: 'Risk Level',  value: `SRI ${instrument.riskLevel} / 7` },
          { label: 'Latest NAV',  value: latestNav ? `€${Number(latestNav.nav).toFixed(4)}` : '—', sub: latestNav?.date },
        ].map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{c.label}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{c.value}</p>
            {c.sub && <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* NAV chart */}
      <div className="card p-6">
        <SectionHeading title={`NAV History (${navHistory.length} data points)`} />
        <NavChart navHistory={navHistory} />
      </div>

      {/* Sync from Yahoo Finance */}
      {id && (
        <div className="card p-6">
          <SectionHeading title="Sync from Yahoo Finance">
            <span className="text-xs text-gray-400">Fetches daily NAV history automatically</span>
          </SectionHeading>
          <p className="text-sm text-gray-500 mb-4">
            Resolves this ISIN to a Yahoo Finance ticker and fetches all available daily
            NAV prices, storing only dates not yet in the database (incremental).
          </p>
          <SyncButton instrumentId={id} onSuccess={handleSyncSuccess} />
        </div>
      )}

      {/* Sync job history */}
      {id && <SyncJobHistory instrumentId={id} refreshKey={syncRefreshKey} />}

      {/* Add NAV form */}
      <div className="card p-6">
        <SectionHeading title="Add NAV Point" />
        <form onSubmit={handleAddNav} className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Date</label>
            <input
              type="date"
              value={navDate}
              max={today()}
              onChange={(e) => setNavDate(e.target.value)}
              required
              className="input w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">NAV (EUR)</label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={navValue}
              onChange={(e) => setNavValue(e.target.value)}
              placeholder="e.g. 9.1234"
              required
              className="input w-36"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save NAV'}
          </button>
        </form>
        {saveMsg && <p className="text-emerald-600 text-sm mt-3">✓ {saveMsg}</p>}
        {saveErr && <p className="text-red-500 text-sm mt-3">✗ {saveErr}</p>}
      </div>

      {/* External data sources */}
      {dataLinks.length > 0 && (
        <div className="card p-6">
          <SectionHeading title="External Data Sources" />
          <ul className="space-y-2">
            {dataLinks.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline break-all"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* NAV table (last 10) */}
      {navHistory.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">
              Recent NAV Prices (last {Math.min(10, navHistory.length)})
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Date</th>
                <th className="table-th">NAV (€)</th>
                <th className="table-th">Change</th>
                <th className="table-th">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...navHistory].reverse().slice(0, 10).map((n, idx, arr) => {
                const prev = arr[idx + 1];
                const change = prev ? Number(n.nav) - Number(prev.nav) : null;
                const changePct = prev && Number(prev.nav) > 0
                  ? ((Number(n.nav) - Number(prev.nav)) / Number(prev.nav)) * 100
                  : null;
                return (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="table-td font-mono text-xs text-gray-500">{n.date}</td>
                    <td className="table-td font-medium tabular-nums">
                      {Number(n.nav).toFixed(4)}
                    </td>
                    <td className="table-td tabular-nums">
                      {change !== null ? (
                        <span className={change >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                          {change >= 0 ? '+' : ''}{change.toFixed(4)}
                          {changePct !== null && ` (${changePct.toFixed(2)}%)`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-td text-gray-400 text-xs">{n.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
