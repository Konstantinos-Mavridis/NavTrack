import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import type { AggregatePortfolioValuePoint, PerformanceRange } from '../types';
import { fmtEur, fmtPct, fmtDateShort, fmtDateLong, fmtCompact } from '../utils/format';
import { useTheme } from '../ThemeContext';

interface Props {
  data: AggregatePortfolioValuePoint[];
  loading: boolean;
  error?: string;
  selectedRange: PerformanceRange;
  onRangeChange: (range: PerformanceRange) => void;
}

const RANGE_OPTIONS: PerformanceRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];

// Total fixed height of the content area beneath the header row.
// = KPI row (56px) + period change (24px) + chart (280px) + gaps (~16px) = 376px
const CONTENT_H = 376;

export default function PortfolioAggregateChart({
  data,
  loading,
  error,
  selectedRange,
  onRangeChange,
}: Props) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const gridColor = dark ? '#374151' : '#f3f4f6';
  const tickColor = dark ? '#6b7280' : '#9ca3af';

  const latest = data[data.length - 1];
  const first  = data[0];

  const totalStart   = first?.totalValue ?? 0;
  const totalEnd     = latest?.totalValue ?? 0;
  const periodChange = totalEnd - totalStart;

  const minSeries = data.length
    ? Math.min(...data.flatMap((d) => [d.totalValue, d.netInvested]))
    : 0;
  const maxSeries = data.length
    ? Math.max(...data.flatMap((d) => [d.totalValue, d.netInvested]))
    : 1;
  const padding = Math.max((maxSeries - minSeries) * 0.1, maxSeries * 0.02, 1);
  const yMin = Math.max(0, minSeries - padding);
  const yMax = maxSeries + padding;

  const isLong = selectedRange === 'ALL' || selectedRange === '1Y';

  return (
    <div className="card p-6">
      {/* ── Header row: title + range buttons ── */}
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Portfolio Value vs Net Invested
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Transaction-aware aggregate across all portfolios
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-1">
          {RANGE_OPTIONS.map((range) => {
            const active = range === selectedRange;
            return (
              <button
                key={range}
                onClick={() => onRangeChange(range)}
                disabled={loading}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {range}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Fixed-height content area — never changes size ── */}
      <div style={{ height: CONTENT_H }} className="relative">

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              Loading history...
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-red-500 dark:text-red-400">
            {error}
          </div>
        ) : !data.length ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            No data available yet
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* KPI pills */}
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Portfolio Value</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">EUR {fmtEur(totalEnd)}</p>
              </div>
              <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Net Invested</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">EUR {fmtEur(latest.netInvested)}</p>
              </div>
              <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Current Return</p>
                <p className={`text-sm font-semibold mt-0.5 ${
                  latest.pnl >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500 dark:text-red-400'
                }`}>
                  {latest.pnl >= 0 ? '+' : ''}EUR {fmtEur(latest.pnl)} ({fmtPct(latest.pnlPct)})
                </p>
              </div>
            </div>

            {/* Period change */}
            <div className="mb-2 text-xs text-gray-400 dark:text-gray-500">
              Period change:{' '}
              <span className={
                periodChange >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500 dark:text-red-400'
              }>
                {periodChange >= 0 ? '+' : ''}EUR {fmtEur(periodChange)}
              </span>
            </div>

            {/* Chart — flex-1 fills whatever height remains */}
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: tickColor }}
                    tickFormatter={(date: string) => fmtDateShort(date, isLong)}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[yMin, yMax]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: tickColor }}
                    tickFormatter={(v: number) => fmtCompact(v)}
                    width={60}
                  />
                  <Tooltip
                    content={<PerformanceTooltip dark={dark} />}
                    labelFormatter={(label) => fmtDateLong(String(label))}
                  />
                  <Legend
                    iconType="line"
                    iconSize={12}
                    formatter={(value) => (
                      <span style={{ fontSize: 11, color: dark ? '#9ca3af' : '#6b7280' }}>{value}</span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalValue"
                    name="Portfolio Value"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: '#2563eb' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netInvested"
                    name="Net Invested"
                    stroke="#64748b"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={{ r: 3, fill: '#64748b' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PerformanceTooltip({ active, payload, label, dark }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as AggregatePortfolioValuePoint | undefined;
  if (!point) return null;

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-sm text-xs"
      style={{
        backgroundColor: dark ? '#1f2937' : '#ffffff',
        borderColor:     dark ? '#374151' : '#e5e7eb',
        color:           dark ? '#e5e7eb' : '#111827',
      }}
    >
      <p className="mb-1" style={{ color: dark ? '#9ca3af' : '#6b7280' }}>
        {fmtDateLong(String(label))}
      </p>
      <p>
        Portfolio Value:{' '}
        <span className="font-semibold">EUR {fmtEur(point.totalValue)}</span>
      </p>
      <p>
        Net Invested:{' '}
        <span className="font-semibold">EUR {fmtEur(point.netInvested)}</span>
      </p>
      <p style={{ color: point.pnl >= 0 ? (dark ? '#34d399' : '#059669') : (dark ? '#f87171' : '#ef4444') }}>
        Return: {point.pnl >= 0 ? '+' : ''}EUR {fmtEur(point.pnl)} ({fmtPct(point.pnlPct)})
      </p>
    </div>
  );
}
