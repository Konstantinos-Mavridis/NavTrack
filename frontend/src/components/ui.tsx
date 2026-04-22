// ─── Spinner (page-level, centred) ───────────────────────────────────────────
export function Spinner({ size = 8 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center p-8" role="status" aria-label="Loading">
      <div
        className="rounded-full border-4 border-blue-500 dark:border-blue-400 border-t-transparent"
        style={{
          width: size * 4,
          height: size * 4,
          animation: 'spin 0.75s linear infinite',
        }}
      />
    </div>
  );
}

/**
 * Tiny inline spinner for use inside buttons.
 *
 * WHY inline style animation instead of Tailwind `animate-spin`:
 * Tailwind buttons use `transition-colors`. When a button re-renders
 * simultaneously with an opacity/class change, some browsers defer starting
 * CSS animations on elements inside a transitioning ancestor until the
 * transition settles — making the spinner appear frozen. Using an inline
 * `style` animation bypasses this entirely because inline styles are not
 * subject to the transition cascade.
 *
 * The `@keyframes spin` rule is defined once in index.css.
 */
export function ButtonSpinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 border-blue-500 dark:border-blue-400 border-t-transparent inline-block ${className}`}
      style={{ animation: 'spin 0.75s linear infinite' }}
      aria-hidden
    />
  );
}

// ─── Error banner (page-level) ───────────────────────────────────────────────
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 text-sm">
      ⚠ {message}
    </div>
  );
}

/**
 * Animated error banner for use inside modals.
 * Slides in/out smoothly so the modal height never jumps.
 */
export function ModalErrorBanner({ error }: { error: string }) {
  return (
    <div
      className={`overflow-hidden transition-all duration-200 ${
        error ? 'max-h-20 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'
      }`}
    >
      <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-3 py-2">
        {error}
      </div>
    </div>
  );
}

/**
 * Shared CSS class string for form field labels inside modals.
 */
export const FIELD_LABEL_CLS =
  'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

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
/**
 * Generic empty-state block.
 * Uses a Lucide `Inbox` SVG icon instead of an emoji so it stays consistent
 * with the rest of the app's icon system.
 */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
      {/* Lucide "inbox" icon — inline SVG keeps the bundle zero-cost */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="40" height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mx-auto mb-3 opacity-50"
        aria-hidden
      >
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
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

/**
 * Returns the Tailwind badge classes for a transaction type.
 */
export function txBadgeColor(type: string): string {
  switch (type) {
    case 'BUY':               return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
    case 'SELL':              return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
    case 'SWITCH':            return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
    case 'DIVIDEND_REINVEST': return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
    default:                  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}
