import { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { api } from '../api/client';
import type { TemplateNavSeriesPoint, TemplateRange } from '../types';
import { useTheme } from '../ThemeContext';

interface Props {
  templateId: string;
  /** Pass true while the parent is saving/editing to skip fetching */
  paused?: boolean;
}

const RANGES: TemplateRange[] = ['1M', '3M', '6M', '1Y'];

// Total fixed height of the content area so the card never resizes.
const CONTENT_H = 180;

export default function TemplatePerformanceChart({ templateId, paused }: Props) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [range, setRange]     = useState<TemplateRange>('3M');
  const [data, setData]       = useState<TemplateNavSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    if (paused) return;
    setLoading(true);
    setError('');
    try {
      const points = await api.templates.navSeries(templateId, range);
      setData(points);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load chart data');
    } finally {
      setLoading(false);
    }
  }, [templateId, range, paused]);

  useEffect(() => { load(); }, [load]);

  const gridColor = dark ? '#374151' : '#f3f4f6';
  const tickColor = dark ? '#6b7280' : '#9ca3af';

  // Determine if the overall period return is positive / negative for colouring.
  const first = data[0]?.indexValue ?? 100;
  const last  = data[data.length - 1]?.indexValue ?? 100;
  const positive = last >= first;
  const strokeColor = positive ? '#10b981' : '#ef4444'; // emerald-500 / red-500
  const fillId = `templateChart-${templateId.slice(0, 8)}`;

  // Y-axis domain with a small visual padding.
  const values = data.map((d) => d.indexValue);
  const minV = values.length ? Math.min(...values) : 95;
  const maxV = values.length ? Math.max(...values) : 105;
  const pad  = Math.max((maxV - minV) * 0.15, 0.5);
  const yMin = Math.max(0, minV - pad);
  const yMax = maxV + pad;

  // Period return label
  const periodReturn = data.length >= 2 ? last - first : null;
  const periodReturnPct = data.length >= 2
    ? ((last - first) / first) * 100
    : null;

  return (
    <div className="mb-4">
      {/* Range buttons + period return */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Performance</span>
          {periodReturnPct !== null && !loading && !error && data.length > 0 && (
            <span className={`text-xs font-semibold ${
              (periodReturnPct ?? 0) >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-500 dark:text-red-400'
            }`}>
              {(periodReturnPct ?? 0) >= 0 ? '+' : ''}{periodReturnPct!.toFixed(2)}%
            </span>
          )}
        </div>

        <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
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
      </div>

      {/* Fixed-height chart area */}
      <div style={{ height: CONTENT_H }} className="relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-3.5 w-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
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
                tickFormatter={(d: string) => formatShortDate(d, range)}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin, yMax]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: tickColor }}
                tickFormatter={(v: number) => v.toFixed(1)}
                width={36}
              />
              <Tooltip content={<ChartTooltip dark={dark} />} />
              <Area
                type="monotone"
                dataKey="indexValue"
                name="Index"
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
        {formatLongDate(String(label))}
      </p>
      <p>Index: <span className="font-semibold">{point.indexValue.toFixed(2)}</span></p>
      <p style={{ color: dark ? '#9ca3af' : '#6b7280' }}>Weighted NAV: {point.weightedNav.toFixed(4)}</p>
    </div>
  );
}

function formatShortDate(date: string, range: TemplateRange): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  if (range === '1Y') {
    return `${String(month).padStart(2, '0')}/${String(year).slice(2)}`;
  }
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

function formatLongDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}
