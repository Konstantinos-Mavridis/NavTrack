/** Format a number as EUR with 2 decimal places */
export function fmtEur(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('el-GR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format a percentage */
export function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

/** Format units (up to 6 decimal places, trimmed) */
export function fmtUnits(n: number | null | undefined): string {
  if (n == null) return '—';
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
  GREEK_EQUITY:          'Greek Equity',
  GLOBAL_EQUITY:         'Global Equity',
  GREEK_GOV_BOND:        'Greek Gov Bond',
  GREEK_CORP_BOND:       'Greek Corp Bond',
  GLOBAL_BOND:           'Global Bond',
  HIGH_YIELD:            'High Yield',
  FUND_OF_FUNDS:         'Fund of Funds',
  ABSOLUTE_RETURN:       'Absolute Return',
  RESERVE_MONEY_MARKET:  'Reserve / MM',
};

/** Deterministic colour per asset class */
export const ASSET_CLASS_COLORS: Record<string, string> = {
  GREEK_EQUITY:          '#3b82f6',
  GLOBAL_EQUITY:         '#6366f1',
  GREEK_GOV_BOND:        '#10b981',
  GREEK_CORP_BOND:       '#34d399',
  GLOBAL_BOND:           '#f59e0b',
  HIGH_YIELD:            '#ef4444',
  FUND_OF_FUNDS:         '#8b5cf6',
  ABSOLUTE_RETURN:       '#ec4899',
  RESERVE_MONEY_MARKET:  '#94a3b8',
};

/** Risk-level badge colour */
export function riskColor(level: number): string {
  if (level <= 2) return 'bg-green-100 text-green-700';
  if (level <= 4) return 'bg-yellow-100 text-yellow-700';
  if (level <= 5) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

/** Today as YYYY-MM-DD in local time */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
