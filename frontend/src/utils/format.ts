/** Format a number as EUR with 2 decimal places */
export function fmtEur(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '\u2014';
  return n.toLocaleString('el-GR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format a percentage */
export function fmtPct(n: number | null | undefined): string {
  if (n == null) return '\u2014';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

/** Format units (up to 6 decimal places, trimmed) */
export function fmtUnits(n: number | null | undefined): string {
  if (n == null) return '\u2014';
  return Number(n).toLocaleString('el-GR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

/** Humanise asset class enum value */
export function fmtAssetClass(ac: string): string {
  return ac.replace(/_/g, ' ');
}

/** ASSET_CLASS → display label */
export const ASSET_CLASS_LABELS: Record<string, string> = {
  EQUITY:          'Equity',
  BOND:            'Bond',
  HIGH_YIELD:      'High Yield',
  FUND_OF_FUNDS:   'Fund of Funds',
  ABSOLUTE_RETURN: 'Absolute Return',
};

/** Deterministic colour per asset class */
export const ASSET_CLASS_COLORS: Record<string, string> = {
  EQUITY:          '#3b82f6',
  BOND:            '#10b981',
  HIGH_YIELD:      '#ef4444',
  FUND_OF_FUNDS:   '#8b5cf6',
  ABSOLUTE_RETURN: '#ec4899',
};

/**
 * Risk-level badge colour.
 * Returns Tailwind classes for both light and dark mode.
 */
export function riskColor(level: number): string {
  if (level <= 2) return 'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300';
  if (level <= 4) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
  if (level <= 5) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
  return               'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300';
}

/** Today as YYYY-MM-DD in local time */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Shared chart date / number helpers ────────────────────────────────────────

/**
 * Short axis tick label.
 * - long=false (1M/3M/6M): DD/MM
 * - long=true  (1Y/ALL/CUSTOM): MM/YY
 */
export function fmtDateShort(date: string, long: boolean): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  if (long) return `${String(month).padStart(2, '0')}/${String(year).slice(2)}`;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

/** Full DD/MM/YYYY label for tooltips and display text. */
export function fmtDateLong(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/**
 * Compact number formatter for Y-axis ticks.
 * 1 500 000 → '1.5M', 1 500 → '1.5k', 150 → '150'
 */
export function fmtCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000)     return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}
