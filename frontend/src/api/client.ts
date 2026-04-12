import type {
  Instrument, Portfolio, PortfolioPosition, Transaction,
  NavPrice, ValuationResult, AggregatePortfolioValuePoint,
  CreateInstrumentPayload, UpsertPositionPayload,
  CreateTransactionPayload, NavEntryPayload,
  AllocationTemplate, CreateAllocationTemplatePayload,
  ApplyTemplateBuyPayload, ApplyTemplateBuyResult, ImportSummary,
  TemplateNavPreview, TemplateNavSeriesPoint, TemplateRange,
  TemplateNavAvailableRange,
} from '../types';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({ message: res.statusText }));
  if (!res.ok) {
    const msg = body?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return body as T;
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, msg || `HTTP ${res.status}`);
  }
  return res.text();
}

export interface InstrumentImportResult {
  imported: number;
  skipped: number;
  skippedIsins: string[];
}

export interface TemplateImportResult {
  imported: number;
  skipped: number;
  skippedCodes: string[];
  missingIsins: string[];
}

/** days=0 is the sentinel for ALL (backend returns full history). */
const RANGE_DAYS: Record<Exclude<TemplateRange, 'CUSTOM'>, number> = {
  '1M':  30,
  '3M':  90,
  '6M': 180,
  '1Y': 365,
  'ALL':  0,
};

export const api = {
  // ── Instruments ───────────────────────────────────────────────────────────
  instruments: {
    list:       ()                               => request<Instrument[]>('/instruments'),
    get:        (id: string)                     => request<Instrument>(`/instruments/${id}`),
    create:     (p: CreateInstrumentPayload)     => request<Instrument>('/instruments', { method: 'POST', body: JSON.stringify(p) }),
    update:     (id: string, p: Partial<CreateInstrumentPayload>) =>
      request<Instrument>(`/instruments/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
    delete:     (id: string)                     => request<void>(`/instruments/${id}`, { method: 'DELETE' }),
    navHistory: (id: string)                     => request<NavPrice[]>(`/instruments/${id}/nav`),
    /**
     * Returns the most recent NAV on or before `date`, or null if none exists.
     * Used to auto-populate the Price/Unit field in the Add Transaction modal.
     */
    navOnDate:  (id: string, date: string)       =>
      request<NavPrice | null>(`/instruments/${id}/nav/on-date?date=${encodeURIComponent(date)}`),
    addNav:     (id: string, entries: NavEntryPayload[]) =>
      request<{ upserted: number }>(`/instruments/${id}/nav`, { method: 'POST', body: JSON.stringify({ entries }) }),
    exportJson: ()                               => request<any[]>('/instruments/export/json'),
    exportCsv:  ()                               => requestText('/instruments/export/csv'),
    importJson: (instruments: any[])             =>
      request<InstrumentImportResult>('/instruments/import/json', { method: 'POST', body: JSON.stringify({ instruments }) }),
    importCsv:  (csv: string)                    =>
      request<InstrumentImportResult>('/instruments/import/csv', { method: 'POST', body: JSON.stringify({ csv }) }),
  },

  // ── Portfolios ────────────────────────────────────────────────────────────
  portfolios: {
    list:   ()                              => request<Portfolio[]>('/portfolios'),
    get:    (id: string)                    => request<Portfolio>(`/portfolios/${id}`),
    create: (p: { name: string; description?: string }) =>
      request<Portfolio>('/portfolios', { method: 'POST', body: JSON.stringify(p) }),
    update: (id: string, p: { name?: string; description?: string }) =>
      request<Portfolio>(`/portfolios/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
    delete: (id: string)                    => request<void>(`/portfolios/${id}`, { method: 'DELETE' }),
    aggregateSeries: (days?: number, toDate?: string, ids?: string[]) =>
      request<AggregatePortfolioValuePoint[]>(
        `/portfolios/aggregate/valuation-series${
          (() => {
            const parts: string[] = [];
            if (days !== undefined) parts.push(`days=${days}`);
            if (toDate)             parts.push(`to=${encodeURIComponent(toDate)}`);
            if (ids && ids.length)  parts.push(`ids=${ids.map(encodeURIComponent).join(',')}`);
            return parts.length ? `?${parts.join('&')}` : '';
          })()
        }`,
      ),
    exportJson: () => request<any>('/portfolios/export/json'),
    exportCsv: () => requestText('/portfolios/export/csv'),
    importJson: (payload: any) =>
      request<ImportSummary>('/portfolios/import/json', { method: 'POST', body: JSON.stringify(payload) }),
    importCsv: (csv: string) =>
      request<ImportSummary>('/portfolios/import/csv', { method: 'POST', body: JSON.stringify({ csv }) }),
  },

  // ── Positions ─────────────────────────────────────────────────────────────
  positions: {
    list:   (portfolioId: string)           => request<PortfolioPosition[]>(`/portfolios/${portfolioId}/positions`),
    upsert: (portfolioId: string, p: UpsertPositionPayload) =>
      request<PortfolioPosition>(`/portfolios/${portfolioId}/positions`, { method: 'POST', body: JSON.stringify(p) }),
    delete: (portfolioId: string, positionId: string) =>
      request<void>(`/portfolios/${portfolioId}/positions/${positionId}`, { method: 'DELETE' }),
    clearAll: (portfolioId: string)         =>
      request<{ deleted: number }>(`/portfolios/${portfolioId}/positions`, { method: 'DELETE' }),
    recalculate: (portfolioId: string)      =>
      request<PortfolioPosition[]>(`/portfolios/${portfolioId}/positions/recalculate`, { method: 'POST' }),
  },

  // ── Transactions ──────────────────────────────────────────────────────────
  transactions: {
    list:   (portfolioId: string)           => request<Transaction[]>(`/portfolios/${portfolioId}/transactions`),
    create: (portfolioId: string, p: CreateTransactionPayload) =>
      request<Transaction>(`/portfolios/${portfolioId}/transactions`, { method: 'POST', body: JSON.stringify(p) }),
    applyTemplateBuy: (portfolioId: string, p: ApplyTemplateBuyPayload) =>
      request<ApplyTemplateBuyResult>(`/portfolios/${portfolioId}/transactions/apply-template`, {
        method: 'POST',
        body: JSON.stringify(p),
      }),
    update: (portfolioId: string, txnId: string, p: Partial<CreateTransactionPayload>) =>
      request<Transaction>(`/portfolios/${portfolioId}/transactions/${txnId}`, { method: 'PUT', body: JSON.stringify(p) }),
    delete: (portfolioId: string, txnId: string) =>
      request<void>(`/portfolios/${portfolioId}/transactions/${txnId}`, { method: 'DELETE' }),
    clearAll: (portfolioId: string)         =>
      request<{ deleted: number }>(`/portfolios/${portfolioId}/transactions`, { method: 'DELETE' }),
  },

  // ── Valuation ─────────────────────────────────────────────────────────────
  valuation: {
    get: (portfolioId: string, date?: string) =>
      request<ValuationResult>(`/portfolios/${portfolioId}/valuation${date ? `?date=${date}` : ''}`),
  },

  // ── Templates ─────────────────────────────────────────────────────────────
  templates: {
    list:       ()                               => request<AllocationTemplate[]>('/templates'),
    get:        (id: string)                     => request<AllocationTemplate>(`/templates/${id}`),
    navPreview: (id: string, tradeDate: string)  =>
      request<TemplateNavPreview>(`/templates/${id}/nav-preview?tradeDate=${encodeURIComponent(tradeDate)}`),
    navSeriesAvailableRange: (id: string)        =>
      request<TemplateNavAvailableRange>(`/templates/${id}/nav-series/available-range`),
    navSeries: (id: string, range: TemplateRange, customFrom?: string, customTo?: string) => {
      if (range === 'CUSTOM' && customFrom && customTo) {
        return request<TemplateNavSeriesPoint[]>(
          `/templates/${id}/nav-series?from=${encodeURIComponent(customFrom)}&to=${encodeURIComponent(customTo)}`,
        );
      }
      const days = RANGE_DAYS[range as Exclude<TemplateRange, 'CUSTOM'>] ?? 30;
      return request<TemplateNavSeriesPoint[]>(`/templates/${id}/nav-series?days=${days}`);
    },
    create:     (p: CreateAllocationTemplatePayload) =>
      request<AllocationTemplate>('/templates', { method: 'POST', body: JSON.stringify(p) }),
    update:     (id: string, p: Partial<CreateAllocationTemplatePayload>) =>
      request<AllocationTemplate>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
    delete:     (id: string)                     => request<void>(`/templates/${id}`, { method: 'DELETE' }),
    exportJson: ()                               => request<any[]>('/templates/export/json'),
    exportCsv:  ()                               => requestText('/templates/export/csv'),
    importJson: (templates: any[])               =>
      request<TemplateImportResult>('/templates/import/json', { method: 'POST', body: JSON.stringify({ templates }) }),
    importCsv:  (csv: string)                    =>
      request<TemplateImportResult>('/templates/import/csv', { method: 'POST', body: JSON.stringify({ csv }) }),
  },
};
