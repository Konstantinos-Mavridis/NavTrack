// ─── Domain types ────────────────────────────────────────────────────────────

export type AssetClass =
  | 'GREEK_EQUITY'
  | 'GLOBAL_EQUITY'
  | 'GREEK_GOV_BOND'
  | 'GREEK_CORP_BOND'
  | 'GLOBAL_BOND'
  | 'HIGH_YIELD'
  | 'FUND_OF_FUNDS'
  | 'ABSOLUTE_RETURN'
  | 'RESERVE_MONEY_MARKET';

export type TransactionType = 'BUY' | 'SELL' | 'SWITCH' | 'DIVIDEND_REINVEST';
export type NavSource = 'MANUAL' | 'FT' | 'EUROBANK' | 'YAHOO' | 'OTHER';

export interface Instrument {
  id: string;
  name: string;
  isin: string;
  currency: string;
  assetClass: AssetClass;
  riskLevel: number;
  dataSources: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioPosition {
  id: string;
  portfolioId: string;
  instrumentId: string;
  instrument: Instrument;
  units: number;
  costBasisPerUnit: number | null;
  notes: string | null;
}

export interface Transaction {
  id: string;
  portfolioId: string;
  instrumentId: string;
  instrument: Instrument;
  type: TransactionType;
  tradeDate: string;
  settlementDate: string | null;
  units: number;
  pricePerUnit: number;
  fees: number;
  notes: string | null;
  createdAt: string;
}

export interface AllocationTemplateItem {
  id: string;
  templateId: string;
  instrumentId: string;
  weight: number;
  instrument: Instrument;
}

export interface AllocationTemplate {
  id: string;
  code: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  items: AllocationTemplateItem[];
}

export interface TemplateNavPreviewItem {
  instrumentId: string;
  instrumentName: string;
  weight: number;
  nav: number | null;
  navDate: string | null;
  exactDateMatch: boolean;
}

export interface TemplateNavPreview {
  templateId: string;
  templateCode: string;
  tradeDate: string;
  items: TemplateNavPreviewItem[];
}

export interface NavPrice {
  id: string;
  instrumentId: string;
  date: string;
  nav: number;
  source: NavSource;
  createdAt: string;
}

// ─── Valuation ───────────────────────────────────────────────────────────────

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
  totalValue: number;
  totalCost: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
  positions: PositionBreakdown[];
  allocationByAssetClass: Record<string, number>;
  allocationByInstrument: Record<string, number>;
}

export interface AggregatePortfolioValuePoint {
  date: string;
  totalValue: number;
  netInvested: number;
  pnl: number;
  pnlPct: number;
}

// 'ALL' = full history since the first transaction across all portfolios
export type PerformanceRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

// ─── API request shapes ──────────────────────────────────────────────────────

export interface CreateInstrumentPayload {
  name: string;
  isin: string;
  assetClass: AssetClass;
  riskLevel: number;
  dataSources?: string[];
}

export interface UpsertPositionPayload {
  instrumentId: string;
  units: number;
  costBasisPerUnit?: number;
  notes?: string;
}

export interface CreateTransactionPayload {
  instrumentId: string;
  type: TransactionType;
  tradeDate: string;
  settlementDate?: string;
  units: number;
  pricePerUnit: number;
  fees?: number;
  notes?: string;
}

export interface ApplyTemplateBuyPayload {
  templateId: string;
  tradeDate: string;
  settlementDate?: string;
  totalAmount: number;
  notes?: string;
}

export interface ApplyTemplateBuyResult {
  templateId: string;
  templateCode: string;
  totalAmount: number;
  tradeDate: string;
  created: number;
  transactions: Transaction[];
}

export interface TemplateItemPayload {
  instrumentId: string;
  weight: number;
}

export interface CreateAllocationTemplatePayload {
  code: string;
  description?: string;
  items: TemplateItemPayload[];
}

export interface ImportSummary {
  portfoliosImported: number;
  transactionsImported: number;
  transactionsSkipped: number;
  missingInstruments: string[];
  skippedReasons: string[];
}

export interface NavEntryPayload {
  date: string;
  nav: number;
}
