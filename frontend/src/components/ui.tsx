// ─── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner({ size = 8 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div
        className={`animate-spin rounded-full border-4 border-blue-500 dark:border-blue-400 border-t-transparent`}
        style={{ width: size * 4, height: size * 4 }}
      />
    </div>
  );
}

// ─── Error banner ────────────────────────────────────────────────────────────
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 text-sm">
      ⚠ {message}
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'positive' | 'negative' | 'neutral';
}
export function StatCard({ label, value, sub, accent = 'neutral' }: StatCardProps) {
  const accentClass =
    accent === 'positive' ? 'text-emerald-600 dark:text-emerald-400'
    : accent === 'negative' ? 'text-red-500 dark:text-red-400'
    : 'text-gray-900 dark:text-gray-100';
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accentClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── P&L cell ────────────────────────────────────────────────────────────────
export function PnlCell({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  const cls = value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
  return (
    <span className={`font-medium ${cls}`}>
      {value >= 0 ? '+' : ''}
      {value.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      {suffix}
    </span>
  );
}

// ─── Section heading ─────────────────────────────────────────────────────────
export function SectionHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h2>
      {children}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
      <p className="text-4xl mb-3">📭</p>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Risk badge ──────────────────────────────────────────────────────────────
import { riskColor } from '../utils/format';
export function RiskBadge({ level }: { level: number }) {
  return (
    <span className={`badge ${riskColor(level)}`}>
      SRI {level}
    </span>
  );
}

// ─── Asset class chip ────────────────────────────────────────────────────────
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from '../utils/format';
export function AssetClassChip({ ac }: { ac: string }) {
  const color = ASSET_CLASS_COLORS[ac] ?? '#94a3b8';
  const label = ASSET_CLASS_LABELS[ac] ?? ac.replace(/_/g, ' ');
  return (
    <span
      className="badge text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}
