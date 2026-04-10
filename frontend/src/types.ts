// ── Instruments ───────────────────────────────────────────────────────────────
export interface Instrument {
  id: string;
  name: string;
  isin: string;
  assetClass: string;
  currency: string;
  domicile?: string | null;
  ter?: number | null;
  distributionPolicy?: string | null;
  replicationMethod?: string | null;
  description?: string | null;
  riskLevel?: number | null;
  dataSources?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface NavPrice {
  id: string;
  instrumentId: string;
  date: string;
  nav: number;
  source: string;
  createdAt: string;
}

export interface CreateInstrumentPayload {
  name: string;
  isin: string;
  assetClass: string;
  currency: string;
  domicile?: string;
  ter?: number;
  distributionPolicy?: string;
  replicationMethod?: string;
  description?: string;
  riskLevel?: number;
}

export interface NavEntryPayload {
  date: string;
  nav: number;
  source?: string;
}

// ── Portfolios ───────────────────────────────────────────────────────────────
export interface Portfolio {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioPosition {
  id: string;
  portfolioId: string;
  instrumentId: string;
  units: number;
  costBasisPerUnit: number | null;
  createdAt: string;
  updatedAt: string;
  instrument: Instrument;
}

export interface UpsertPositionPayload {
  instrumentId: string;
  units: number;
  costBasisPerUnit?: number | null;
}

// ── Transactions ─────────────────────────────────────────────────────────────
export interface Transaction {
  id: string;
  portfolioId: string;
  instrumentId: string;
  type: 'BUY' | 'SELL' | 'SWITCH' | 'DIVIDEND_REINVEST';
  units: number;
  pricePerUnit: number;
  fees: number;
  tradeDate: string;
  settlementDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  instrument?: Instrument;
}

export interface CreateTransactionPayload {
  instrumentId: string;
  type: 'BUY' | 'SELL' | 'SWITCH' | 'DIVIDEND_REINVEST';
  units: number;
  pricePerUnit: number;
  fees?: number;
  tradeDate: string;
  settlementDate?: string;
  notes?: string;
}

// ── Valuation ─────────────────────────────────────────────────────────────────
export interface PositionBreakdown {
  positionId: string;
  instrumentId: string;
  instrumentName: string;
  isin: string;
  assetClass: string;
  units: number;
  nav: number | null;
  value: number | null;
  cost: number | null;
  pnl: number | null;
  weightPct: number | null;
}

export interface ValuationResult {
  portfolioId: string;
  date: string;
  /** Most recent date for which at least one instrument in this portfolio has a NAV price. */
  latestNavDate: string | null;
  totalValue: number;
  totalCost: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
  positions: PositionBreakdown[];
  allocationByAssetClass: Record<string, number>;
  allocationByInstrument: Record<string, number>;
}

// ── Aggregate chart ───────────────────────────────────────────────────────────
export type PerformanceRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type TemplateRange = '1M' | '3M' | '6M' | '1Y' | 'ALL' | 'CUSTOM';

export interface AggregatePortfolioValuePoint {
  date: string;
  totalValue: number;
  netInvested: number;
  pnl: number;
  pnlPct: number;
}

/** One data point from GET /templates/:id/nav-series */
export interface TemplateNavSeriesPoint {
  date: string;
  /** Index rebased to 100 on the first day with full NAV coverage. */
  indexValue: number;
  /** Raw EUR-weighted NAV sum. */
  weightedNav: number;
}

/** Earliest + latest dates for which ALL funds in a template have NAV data. */
export interface TemplateNavAvailableRange {
  from: string;
  to: string;
}

// ── Import / Export ───────────────────────────────────────────────────────────
export interface ImportSummary {
  portfoliosImported: number;
  transactionsImported: number;
  transactionsSkipped: number;
  missingInstruments: string[];
}

// ── Templates ─────────────────────────────────────────────────────────────────
export interface TemplateItemPayload {
  instrumentId: string;
  weight: number;
}

/** A template item as returned by the API — includes the nested instrument. */
export interface TemplateItem {
  /** Row id — present on API responses, absent on unsaved payloads. */
  id?: string;
  instrumentId: string;
  weight: number;
  instrument?: Instrument;
}

export interface AllocationTemplate {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  items: TemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAllocationTemplatePayload {
  code: string;
  description?: string;
  items: TemplateItemPayload[];
}

export interface ApplyTemplateBuyPayload {
  templateId: string;
  totalAmount: number;
  tradeDate: string;
  settlementDate?: string;
  notes?: string;
  fees?: number;
}

export interface ApplyTemplateBuyResult {
  transactions: Transaction[];
  breakdown: { instrumentId: string; units: number; amount: number }[];
}

export interface TemplateNavPreviewItem {
  instrumentId: string;
  instrumentName: string;
  isin: string;
  weight: number;
  nav: number | null;
  navDate: string | null;
}

export interface TemplateNavPreview {
  items: TemplateNavPreviewItem[];
}

// ── Sync ──────────────────────────────────────────────────────────────────────
export interface SyncResult {
  jobId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  recordsFetched: number;
  recordsUpserted: number;
  yahooTicker: string | null;
  error?: string;
}
