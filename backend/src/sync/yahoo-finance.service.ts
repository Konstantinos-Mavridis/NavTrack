import { Injectable, Logger } from '@nestjs/common';

// ─── Yahoo Finance raw response shapes ───────────────────────────────────────

interface YahooSearchQuote {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchDisp?: string;
}

interface YahooSearchResponse {
  quotes?: YahooSearchQuote[];
}

interface YahooChartMeta {
  currency: string;
  symbol: string;
  regularMarketPrice: number;
}

interface YahooChartResult {
  meta: YahooChartMeta;
  timestamp: number[];
  indicators: {
    quote: Array<{ close: (number | null)[] }>;
  };
}

interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: { code: string; description: string } | null;
  };
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface YahooNavPoint {
  date: string;   // YYYY-MM-DD
  nav: number;
}

export interface YahooTickerInfo {
  symbol: string;
  name: string;
  exchDisp: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const SEARCH_URL  = 'https://query1.finance.yahoo.com/v1/finance/search';
const CHART_URL   = 'https://query1.finance.yahoo.com/v8/finance/chart';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

@Injectable()
export class YahooFinanceService {
  private readonly logger = new Logger(YahooFinanceService.name);

  /**
   * Resolve an ISIN to a Yahoo Finance ticker symbol.
   * Returns null if the ISIN is not found.
   */
  async resolveTickerForIsin(isin: string): Promise<YahooTickerInfo | null> {
    const url = `${SEARCH_URL}?q=${encodeURIComponent(isin)}&quotesCount=5&newsCount=0&listsCount=0`;
    this.logger.log(`Resolving ticker for ISIN ${isin}`);

    const data = await this.fetchJson<YahooSearchResponse>(url);

    if (!data?.quotes?.length) {
      this.logger.warn(`No Yahoo Finance results for ISIN ${isin}`);
      return null;
    }

    // Prefer MUTUALFUND or ETF type; fall back to first result
    const preferred = data.quotes.find(
      (q) => q.quoteType === 'MUTUALFUND' || q.quoteType === 'ETF',
    ) ?? data.quotes[0];

    this.logger.log(
      `Resolved ${isin} → ${preferred.symbol} (${preferred.quoteType ?? 'unknown'}, ${preferred.exchDisp ?? ''})`,
    );

    return {
      symbol:   preferred.symbol,
      name:     preferred.longname ?? preferred.shortname ?? isin,
      exchDisp: preferred.exchDisp ?? '',
    };
  }

  /**
   * Fetch daily NAV (= close price) history for a Yahoo ticker.
   *
   * When fromDate is omitted the request is sent with period1 = 0 (Unix epoch),
   * which causes Yahoo Finance to return the full history since the fund's
   * inception — no artificial cap is applied.
   *
   * The toDate string (YYYY-MM-DD) is converted to end-of-day UTC
   * (T23:59:59Z) so that today's daily candle is always within the
   * requested window, regardless of what time of day the sync runs.
   *
   * @param symbol    e.g. "0P00012345.L"
   * @param fromDate  YYYY-MM-DD — when absent, fetches from inception
   * @param toDate    YYYY-MM-DD — defaults to today
   */
  async fetchHistory(
    symbol: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<YahooNavPoint[]> {
    const now = new Date();

    // period1 = 0 (Unix epoch) tells Yahoo to start from the very first
    // available data point for this ticker (fund inception).
    const from = fromDate ? new Date(fromDate) : new Date(0);

    // Use end-of-day UTC for the upper bound so that today's daily candle
    // is always included in Yahoo's response, no matter when during the day
    // the sync runs. new Date('YYYY-MM-DD') resolves to midnight UTC
    // (start of day), which excludes the candle until the next day.
    const to = toDate ? new Date(`${toDate}T23:59:59Z`) : now;

    if (from.getTime() > to.getTime()) {
      this.logger.warn(
        `Skipping history fetch for ${symbol}: invalid range ${fromDate ?? 'inception'} > ${toDate ?? 'today'}`,
      );
      return [];
    }

    const period1 = Math.floor(from.getTime() / 1000);
    const period2 = Math.floor(to.getTime()   / 1000);

    const url =
      `${CHART_URL}/${encodeURIComponent(symbol)}` +
      `?interval=1d&period1=${period1}&period2=${period2}&events=history`;

    this.logger.log(`Fetching history for ${symbol} from ${fromDate ?? 'inception'} to ${toDate ?? 'today'}`);

    const data = await this.fetchJson<YahooChartResponse>(url);

    if (data?.chart?.error) {
      throw new Error(`Yahoo Finance error: ${data.chart.error.description}`);
    }

    const result = data?.chart?.result?.[0];
    if (!result?.timestamp?.length) {
      this.logger.warn(`No historical data returned for ${symbol}`);
      return [];
    }

    const timestamps = result.timestamp;
    const closes     = result.indicators.quote[0]?.close ?? [];

    const points: YahooNavPoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close == null || isNaN(close) || close <= 0) continue;

      // Convert Unix timestamp → YYYY-MM-DD (UTC date)
      const d = new Date(timestamps[i] * 1000);
      const dateStr = d.toISOString().slice(0, 10);

      points.push({ date: dateStr, nav: Math.round(close * 1_000_000) / 1_000_000 });
    }

    this.logger.log(`Fetched ${points.length} data points for ${symbol}`);
    return points;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async fetchJson<T>(url: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, { headers: HEADERS });

        if (res.status === 429) {
          // Rate limited — back off and retry
          const wait = attempt * 3000;
          this.logger.warn(`Rate limited by Yahoo Finance, waiting ${wait}ms (attempt ${attempt})`);
          await sleep(wait);
          continue;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} from Yahoo Finance`);
        }

        return (await res.json()) as T;
      } catch (err: any) {
        lastError = err;
        if (attempt < 3) await sleep(1500 * attempt);
      }
    }

    throw lastError ?? new Error('Yahoo Finance request failed');
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
