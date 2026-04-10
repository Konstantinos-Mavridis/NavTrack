import { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { api } from '../api/client';
import type { TemplateNavSeriesPoint, TemplateNavAvailableRange } from '../types';
import { fmtDateShort, fmtDateLong } from '../utils/format';
import { useTheme } from '../ThemeContext';

type FixedRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';
type ActiveRange = FixedRange | 'CUSTOM';

const FIXED_RANGES: FixedRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];

const CONTENT_H = 180;

const SPIN_STYLE: React.CSSProperties = { animation: 'spin 0.75s linear infinite' };

interface Props {
  templateId: string;
  paused?: boolean;
}

export default function TemplatePerformanceChart({ templateId, paused }: Props) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  // ── Range state ──────────────────────────────────────────────────────────
  const [range, setRange]           = useState<ActiveRange>('3M');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const [available,  setAvailable]  = useState<TemplateNavAvailableRange | null>(null);
  const [showCustom, setShowCustom] = useState(false);

  // ── Chart data state ─────────────────────────────────────────────────────
  const [data,    setData]    = useState<TemplateNavSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Fetch available range once on mount.
  useEffect(() => {
    if (paused) return;
    api.templates.navSeriesAvailableRange(templateId)
      .then((r) => {
        setAvailable(r);
        setCustomFrom(r.from);
        setCustomTo(r.to);
      })
      .catch(() => {});
  }, [templateId, paused]);

  // Fetch series whenever range / custom dates change.
  const load = useCallback(async () => {
    if (paused) return;
    if (range === 'CUSTOM') {
      if (!customFrom || !customTo || customFrom > customTo) return;
    }
    setLoading(true);
    setError('');
    try {
      const points = await api.templates.navSeries(
        templateId,
        range,
        range === 'CUSTOM' ? customFrom : undefined,
        range === 'CUSTOM' ? customTo   : undefined,
      );
      setData(points);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load chart data');
    } finally {
      setLoading(false);
    }
  }, [templateId, range, customFrom, customTo, paused]);

  useEffect(() => { load(); }, [load]);

  // ── Derived display values ────────────────────────────────────────────────
  const gridColor = dark ? '#374151' : '#f3f4f6';
  const tickColor = dark ? '#6b7280' : '#9ca3af';

  const firstNav = data[0]?.weightedNav ?? null;
  const lastNav  = data[data.length - 1]?.weightedNav ?? null;
  const periodReturnPct =
    firstNav && lastNav && firstNav !== 0
      ? ((lastNav - firstNav) / firstNav) * 100
      : null;
  const positive = (periodReturnPct ?? 0) >= 0;

  const strokeColor = positive ? '#10b981' : '#ef4444';
  const fillId = `templateChart-${templateId.slice(0, 8)}`;

  const values = data.map((d) => d.weightedNav);
  const minV = values.length ? Math.min(...values) : 0;
  const maxV = values.length ? Math.max(...values) : 1;
  const pad  = Math.max((maxV - minV) * 0.15, 0.001);
  const yMin = Math.max(0, minV - pad);
  const yMax = maxV + pad;
  const decimalsFor = (max: number) => (max < 10 ? 4 : max < 1000 ? 2 : 0);

  const isLong = range === 'ALL' || range === '1Y' || range === 'CUSTOM';

  // ── Handlers ─────────────────────────────────────────────────────────────
  function selectFixed(r: FixedRange) {
    setShowCustom(false);
    setRange(r);
  }

  function openCustom() {
    setShowCustom(true);
    setRange('CUSTOM');
  }

  // Close the picker panel and let the useEffect on [load] trigger the fetch.
  // Do NOT call load() here — setRange already invalidates the callback.
  function applyCustom() {
    setShowCustom(false);
    // If already CUSTOM, range didn't change so the effect won't re-run;
    // force it by toggling a stable no-op: just call load() only in that case.
    if (range === 'CUSTOM') {
      load();
    } else {
      setRange('CUSTOM');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mb-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-y-2">

        {/* Left: label + period return */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Performance</span>
          {periodReturnPct !== null && !loading && !error && data.length > 0 && (
            <span className={`text-xs font-semibold ${
              positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
            }`}>
              {positive ? '+' : ''}{periodReturnPct!.toFixed(2)}%
            </span>
          )}
          {range === 'CUSTOM' && !showCustom && customFrom && customTo && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {fmtDateLong(customFrom)} – {fmtDateLong(customTo)}
            </span>
          )}
        </div>

        {/* Right: fixed range buttons + Custom button */}
        <div className="flex items-center gap-1">
          <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-0.5">
            {FIXED_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => selectFixed(r)}
                disabled={loading}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                  r === range
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            onClick={openCustom}
            disabled={loading || !available}
            title={available ? 'Pick a custom date range' : 'Loading available range…'}
            className={`px-2 py-0.5 text-[11px] font-medium rounded border transition-colors ${
              range === 'CUSTOM'
                ? 'border-blue-500 bg-blue-600 text-white'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* ── Custom date picker panel ─────────────────────────────────────── */}
      {showCustom && available && (
        <div className="flex items-end gap-2 mb-3 flex-wrap p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">From</label>
            <input
              type="date"
              value={customFrom}
              min={available.from}
              max={customTo || available.to}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="input py-1 text-xs w-36"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">To</label>
            <input
              type="date"
              value={customTo}
              min={customFrom || available.from}
              max={available.to}
              onChange={(e) => setCustomTo(e.target.value)}
              className="input py-1 text-xs w-36"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={applyCustom}
              disabled={!customFrom || !customTo || customFrom > customTo}
              className="btn-primary py-1.5 px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply
            </button>
            <button
              onClick={() => { setShowCustom(false); if (range === 'CUSTOM') setRange('3M'); }}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              Cancel
            </button>
          </div>
          <p className="w-full text-[10px] text-gray-400 dark:text-gray-500">
            Available: {fmtDateLong(available.from)} – {fmtDateLong(available.to)}
          </p>
        </div>
      )}

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      <div style={{ height: CONTENT_H }} className="relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="h-3.5 w-3.5 rounded-full border-2 border-blue-400 border-t-transparent"
              style={SPIN_STYLE}
            />
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-500 dark:text-red-400">
            {error}
          </div>
        ) : !data.length ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
            No NAV data available for this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: tickColor }}
                tickFormatter={(d: string) => fmtDateShort(d, isLong)}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin, yMax]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: tickColor }}
                tickFormatter={(v: number) => v.toFixed(decimalsFor(yMax))}
                width={42}
              />
              <Tooltip content={<ChartTooltip dark={dark} />} />
              <Area
                type="monotone"
                dataKey="weightedNav"
                name="Weighted NAV"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#${fillId})`}
                dot={false}
                activeDot={{ r: 3, fill: strokeColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, dark }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as TemplateNavSeriesPoint | undefined;
  if (!point) return null;
  return (
    <div
      className="rounded-lg border px-2.5 py-1.5 shadow-sm text-xs"
      style={{
        backgroundColor: dark ? '#1f2937' : '#ffffff',
        borderColor:     dark ? '#374151' : '#e5e7eb',
        color:           dark ? '#e5e7eb' : '#111827',
      }}
    >
      <p className="mb-0.5" style={{ color: dark ? '#9ca3af' : '#6b7280' }}>
        {fmtDateLong(String(label))}
      </p>
      <p>Weighted NAV: <span className="font-semibold">{point.weightedNav.toFixed(4)}</span></p>
    </div>
  );
}
