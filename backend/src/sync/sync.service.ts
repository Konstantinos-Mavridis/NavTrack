import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncJob, SyncStatus } from './sync-job.entity';
import { YahooFinanceService } from './yahoo-finance.service';
import { Instrument } from '../instruments/instrument.entity';
import { NavPrice, NavSource } from '../nav-prices/nav-price.entity';

export interface SyncOptions {
  fromDate?: string;
  toDate?: string;
  triggeredBy?: string;
  forceTickerRefresh?: boolean;
  forceFullHistory?: boolean;
}

export interface SyncResult {
  jobId: string;
  instrumentId: string;
  isin: string;
  yahooTicker: string | null;
  status: SyncStatus;
  recordsFetched: number;
  recordsUpserted: number;
  error?: string;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(SyncJob)
    private readonly jobRepo: Repository<SyncJob>,
    @InjectRepository(Instrument)
    private readonly instrumentRepo: Repository<Instrument>,
    @InjectRepository(NavPrice)
    private readonly navRepo: Repository<NavPrice>,
    private readonly yahoo: YahooFinanceService,
  ) {}

  // ─── Single instrument sync ────────────────────────────────────────────────

  async syncInstrument(
    instrumentId: string,
    opts: SyncOptions = {},
  ): Promise<SyncResult> {
    const instrument = await this.instrumentRepo.findOneBy({ id: instrumentId });
    if (!instrument) throw new NotFoundException(`Instrument ${instrumentId} not found`);

    const job = await this.jobRepo.save(
      this.jobRepo.create({
        instrumentId,
        status: SyncStatus.RUNNING,
        fromDate: opts.fromDate ?? null,
        toDate:   opts.toDate   ?? null,
        triggeredBy: opts.triggeredBy ?? 'API',
      }),
    );

    try {
      // 1. Resolve ticker
      let ticker: string | null =
        !opts.forceTickerRefresh
          ? (instrument.externalIds as any)?.yahoo_ticker ?? null
          : null;

      if (!ticker) {
        const info = await this.yahoo.resolveTickerForIsin(instrument.isin);
        ticker = info?.symbol ?? null;

        if (ticker) {
          // Persist the resolved ticker so we skip this step next time
          await this.instrumentRepo
            .createQueryBuilder()
            .update(Instrument)
            .set({
              externalIds: () =>
                `external_ids || '{"yahoo_ticker": "${ticker}"}'::jsonb`,
            })
            .where('id = :id', { id: instrumentId })
            .execute();
        }
      }

      if (!ticker) {
        return await this.failJob(job, 'Could not resolve Yahoo Finance ticker for this ISIN', {
          instrumentId,
          isin: instrument.isin,
          yahooTicker: null,
        });
      }

      // 2. Determine date range.
      // Default mode: incremental sync from day-after-latest stored NAV.
      // Force mode: leave fromDate undefined so Yahoo fetches full history.
      let fromDate = opts.fromDate;
      if (!fromDate && !opts.forceFullHistory) {
        const latest = await this.navRepo.findOne({
          where: { instrumentId },
          order: { date: 'DESC' },
        });
        if (latest) {
          // Start the day after last known price
          const d = new Date(latest.date);
          d.setDate(d.getDate() + 1);
          fromDate = d.toISOString().slice(0, 10);
        }
      }

      // 3. Fetch from Yahoo Finance.
      // Use effectiveToDate for both the guard check AND the actual fetch call.
      // Previously opts.toDate (undefined in normal syncs) was passed to
      // fetchHistory, causing Yahoo's period2 to be a mid-day timestamp that
      // excluded today's candle until after midnight UTC.
      const effectiveToDate = opts.toDate ?? new Date().toISOString().slice(0, 10);

      // Guard against invalid future-only windows (fromDate > toDate), which Yahoo rejects with HTTP 400.
      if (fromDate && fromDate > effectiveToDate) {
        this.logger.log(
          `No sync needed for ${instrument.isin}: latest NAV already up to date (${fromDate} > ${effectiveToDate})`,
        );
        return await this.completeJob(job, SyncStatus.SUCCESS, 0, {
          instrumentId,
          isin: instrument.isin,
          yahooTicker: ticker,
        });
      }

      // Pass effectiveToDate (not opts.toDate) so today's candle is always included.
      const points = await this.yahoo.fetchHistory(ticker, fromDate, effectiveToDate);
      job.recordsFetched = points.length;

      if (!points.length) {
        return await this.completeJob(job, SyncStatus.SUCCESS, 0, {
          instrumentId,
          isin: instrument.isin,
          yahooTicker: ticker,
        });
      }

      // 4. Bulk upsert into nav_prices
      let upserted = 0;
      for (const pt of points) {
        const result = await this.navRepo
          .createQueryBuilder()
          .insert()
          .into(NavPrice)
          .values({
            instrumentId,
            date: pt.date,
            nav:  pt.nav,
            source: NavSource.YAHOO,
          })
          .orUpdate(['nav', 'source'], ['instrument_id', 'date'])
          .execute();

        if (result.raw?.length || result.identifiers?.length) upserted++;
      }
      // Fallback count if result.raw is unreliable
      if (upserted === 0) upserted = points.length;

      return await this.completeJob(job, SyncStatus.SUCCESS, upserted, {
        instrumentId,
        isin: instrument.isin,
        yahooTicker: ticker,
      });
    } catch (err: any) {
      this.logger.error(`Sync failed for ${instrument.isin}: ${err.message}`);
      return await this.failJob(job, err.message, {
        instrumentId,
        isin: instrument.isin,
        yahooTicker: null,
      });
    }
  }

  // ─── Sync all instruments ──────────────────────────────────────────────────

  async syncAll(opts: SyncOptions = {}): Promise<SyncResult[]> {
    const instruments = await this.instrumentRepo.find({ order: { name: 'ASC' } });
    this.logger.log(`Starting sync for ${instruments.length} instruments`);

    const results: SyncResult[] = [];

    for (const inst of instruments) {
      // Polite delay between instruments — Yahoo search endpoint rate-limits
      // aggressively on bursts. 3 s keeps us safely under the threshold.
      if (results.length > 0) await sleep(3000);

      const result = await this.syncInstrument(inst.id, {
        ...opts,
        triggeredBy: opts.triggeredBy ?? 'API_ALL',
      });
      results.push(result);
    }

    this.logger.log(
      `Sync all complete: ${results.filter((r) => r.status === SyncStatus.SUCCESS).length}` +
      `/${results.length} succeeded`,
    );

    return results;
  }

  // ─── Query jobs ────────────────────────────────────────────────────────────

  listJobs(limit = 50): Promise<SyncJob[]> {
    return this.jobRepo.find({
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  listJobsForInstrument(instrumentId: string, limit = 20): Promise<SyncJob[]> {
    return this.jobRepo.find({
      where: { instrumentId },
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  getJob(id: string): Promise<SyncJob | null> {
    return this.jobRepo.findOneBy({ id });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async completeJob(
    job: SyncJob,
    status: SyncStatus,
    upserted: number,
    extra: Partial<SyncResult>,
  ): Promise<SyncResult> {
    job.status           = status;
    job.recordsUpserted  = upserted;
    job.completedAt      = new Date();
    await this.jobRepo.save(job);
    return {
      jobId:            job.id,
      instrumentId:     extra.instrumentId!,
      isin:             extra.isin!,
      yahooTicker:      extra.yahooTicker ?? null,
      status,
      recordsFetched:   job.recordsFetched,
      recordsUpserted:  upserted,
    };
  }

  private async failJob(
    job: SyncJob,
    error: string,
    extra: Partial<SyncResult>,
  ): Promise<SyncResult> {
    job.status        = SyncStatus.FAILED;
    job.errorMessage  = error;
    job.completedAt   = new Date();
    await this.jobRepo.save(job);
    return {
      jobId:           job.id,
      instrumentId:    extra.instrumentId!,
      isin:            extra.isin!,
      yahooTicker:     extra.yahooTicker ?? null,
      status:          SyncStatus.FAILED,
      recordsFetched:  job.recordsFetched,
      recordsUpserted: 0,
      error,
    };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
