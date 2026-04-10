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

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Best-effort human label from a URL string. */
function sourceLabelFromUrl(raw: string): { host: string; path: string } {
  try {
    const u = new URL(raw);
    // strip leading "www."
    const host = u.hostname.replace(/^www\./, '');
    // show only the first meaningful path segment (e.g. "/funds/lu0273962166" → "/funds/…")
    const segments = u.pathname.split('/').filter(Boolean);
    const path = segments.length ? '/' + segments.slice(0, 2).join('/') + (segments.length > 2 ? '/…' : '') : '';
    return { host, path };
  } catch {
    return { host: raw, path: '' };
  }
}

/** Google favicon CDN — works for any public domain. */
function faviconUrl(raw: string): string {
  try {
    const { hostname } = new URL(raw);
    return `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`;
  } catch {
    return '';
  }
}

// ─── sub-component ────────────────────────────────────────────────────────────

function DataSourceList({ links }: { links: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {links.map((url) => {
        const { host, path } = sourceLabelFromUrl(url);
        const favicon = faviconUrl(url);
        return (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="
                group flex items-center gap-3
                rounded-lg border border-gray-100 dark:border-gray-800
                bg-gray-50 dark:bg-gray-800/50
                hover:bg-blue-50 dark:hover:bg-blue-900/20
                hover:border-blue-200 dark:hover:border-blue-700
                px-3 py-2.5 transition-colors
              "
            >
              {/* favicon */}
              {favicon && (
                <img
                  src={favicon}
                  alt=""
                  width={16}
                  height={16}
                  className="shrink-0 rounded-sm opacity-80 group-hover:opacity-100"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              )}

              {/* label */}
              <span className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                  {host}
                </span>
                {path && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-1 font-mono">
                    {path}
                  </span>
                )}
                {/* full URL on second line, truncated */}
                <span className="block text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5 font-mono">
                  {url}
                </span>
              </span>

              {/* external-link icon */}
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-3.5 h-3.5 shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors"
              >
                <path d="M6 2H2v12h12v-4M14 2H9m5 0v5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function InstrumentDetail() {
  const { id } = useParams<{ id: string }>();

  const [instrument,     setInstrument]     = useState<Instrument | null>(null);
  const [navHistory,     setNavHistory]     = useState<NavPrice[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');

  // Add-NAV form state
  const [navDate,        setNavDate]        = useState(today());
  const [navValue,       setNavValue]       = useState('');
  const [saving,         setSaving]         = useState(false);
  const [saveMsg,        setSaveMsg]        = useState('');
  const [saveErr,        setSaveErr]        = useState('');
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
      <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
        <Link to="/instruments" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Instruments
        </Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-200 font-medium truncate">{instrument.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{instrument.name}</h1>
          <p className="font-mono text-sm text-gray-400 dark:text-gray-500 mt-1">{instrument.isin}</p>
        </div>
        <div className="flex gap-2 items-center shrink-0 mt-1">
          <AssetClassChip ac={instrument.assetClass} />
          <RiskBadge level={instrument.riskLevel ?? 0} />
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Currency',    value: instrument.currency },
          { label: 'Asset Class', value: ASSET_CLASS_LABELS[instrument.assetClass] ?? instrument.assetClass },
          { label: 'Risk Level',  value: instrument.riskLevel != null ? `SRI ${instrument.riskLevel} / 7` : '—' },
          { label: 'Latest NAV',  value: latestNav ? `€${Number(latestNav.nav).toFixed(4)}` : '—', sub: latestNav?.date },
        ].map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{c.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{c.value}</p>
            {c.sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{c.sub}</p>}
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
            <span className="text-xs text-gray-400 dark:text-gray-500">Fetches daily NAV history automatically</span>
          </SectionHeading>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
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
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Date</label>
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
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">NAV (EUR)</label>
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

        {/* Inline feedback — slides in/out without layout shift */}
        <div
          className={`overflow-hidden transition-all duration-200 ${
            saveMsg || saveErr ? 'max-h-10 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
          }`}
        >
          {saveMsg && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
              </svg>
              {saveMsg}
            </p>
          )}
          {saveErr && (
            <p className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
              </svg>
              {saveErr}
            </p>
          )}
        </div>
      </div>

      {/* External data sources */}
      {dataLinks.length > 0 && (
        <div className="card p-6">
          <SectionHeading title="External Data Sources">
            <span className="text-xs text-gray-400 dark:text-gray-500">{dataLinks.length} source{dataLinks.length !== 1 ? 's' : ''}</span>
          </SectionHeading>
          <DataSourceList links={dataLinks} />
        </div>
      )}

      {/* NAV table (last 10) */}
      {navHistory.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
              Recent NAV Prices (last {Math.min(10, navHistory.length)})
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className="table-th">Date</th>
                <th className="table-th">NAV (€)</th>
                <th className="table-th">Change</th>
                <th className="table-th">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {[...navHistory].reverse().slice(0, 10).map((n, idx, arr) => {
                const prev = arr[idx + 1];
                const change = prev ? Number(n.nav) - Number(prev.nav) : null;
                const changePct = prev && Number(prev.nav) > 0
                  ? ((Number(n.nav) - Number(prev.nav)) / Number(prev.nav)) * 100
                  : null;
                return (
                  <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="table-td font-mono text-xs text-gray-500 dark:text-gray-400">{n.date}</td>
                    <td className="table-td font-medium tabular-nums">
                      {Number(n.nav).toFixed(4)}
                    </td>
                    <td className="table-td tabular-nums">
                      {change !== null ? (
                        <span className={change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}>
                          {change >= 0 ? '+' : ''}{change.toFixed(4)}
                          {changePct !== null && ` (${changePct.toFixed(2)}%)`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-td text-gray-400 dark:text-gray-500 text-xs">{n.source}</td>
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
