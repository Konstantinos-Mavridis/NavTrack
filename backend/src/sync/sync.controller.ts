import {
  Controller, Post, Get, Param, Query,
  ParseUUIDPipe, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller()
export class SyncController {
  constructor(private readonly svc: SyncService) {}

  /**
   * POST /api/instruments/:id/sync
   * Sync NAV history for a single instrument.
   * Query params:
   *   from     – start date YYYY-MM-DD (default: day after last stored NAV)
   *   to       – end date   YYYY-MM-DD (default: today)
   *   refresh  – "true" to force re-resolve the Yahoo ticker
   */
  @Post('instruments/:id/sync')
  syncOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from')     from?: string,
    @Query('to')       to?: string,
    @Query('refresh')  refresh?: string,
    @Query('overwrite') overwrite?: string,
  ) {
    return this.svc.syncInstrument(id, {
      fromDate:            from,
      toDate:              to,
      forceTickerRefresh:  refresh === 'true',
      forceFullHistory:    overwrite === 'true',
      triggeredBy:         'API',
    });
  }

  /**
   * POST /api/sync/all
   * Trigger a sync for every instrument, sequentially with polite delays.
   * Query params: from, to (same as above)
   */
  @Post('sync/all')
  syncAll(
    @Query('from') from?: string,
    @Query('to')   to?:   string,
    @Query('refresh') refresh?: string,
    @Query('overwrite') overwrite?: string,
  ) {
    return this.svc.syncAll({
      fromDate: from,
      toDate: to,
      forceTickerRefresh: refresh === 'true',
      forceFullHistory: overwrite === 'true',
      triggeredBy: overwrite === 'true' ? 'API_ALL_FORCE' : 'API_ALL',
    });
  }

  /**
   * GET /api/sync/jobs
   * List recent sync jobs across all instruments.
   */
  @Get('sync/jobs')
  listJobs(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.svc.listJobs(Math.min(limit, 200));
  }

  /**
   * GET /api/sync/jobs/:jobId
   * Get a specific sync job by ID.
   */
  @Get('sync/jobs/:jobId')
  getJob(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.svc.getJob(jobId);
  }

  /**
   * GET /api/instruments/:id/sync/jobs
   * List sync jobs for a single instrument.
   */
  @Get('instruments/:id/sync/jobs')
  listJobsForInstrument(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.svc.listJobsForInstrument(id, Math.min(limit, 100));
  }
}
