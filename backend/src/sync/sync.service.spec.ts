/**
 * Unit tests for SyncService.
 *
 * All external dependencies (TypeORM repositories, YahooFinanceService)
 * are replaced with Jest mocks. No database or network required.
 *
 * Focus: the three-path ticker resolution order introduced by the
 * crypto support PR and the context-aware error messages.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { SyncService } from './sync.service';
import { SyncJob, SyncStatus } from './sync-job.entity';
import { YahooFinanceService } from './yahoo-finance.service';
import { Instrument } from '../instruments/instrument.entity';
import { AssetClass } from '../instruments/instrument.entity';
import { NavPrice } from '../nav-prices/nav-price.entity';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Minimal Instrument factory. */
function makeInstrument(overrides: Partial<Instrument> = {}): Instrument {
  return {
    id: 'inst-uuid-1',
    name: 'Test Fund',
    isin: 'IE0001234567',
    ticker: null,
    currency: 'EUR',
    assetClass: AssetClass.EQUITY,
    riskLevel: 3,
    dataSources: [],
    externalIds: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as Instrument;
}

/** Minimal SyncJob factory mirroring what jobRepo.save returns. */
function makeJob(overrides: Partial<SyncJob> = {}): SyncJob {
  return {
    id: 'job-uuid-1',
    instrumentId: 'inst-uuid-1',
    status: SyncStatus.RUNNING,
    fromDate: null,
    toDate: null,
    triggeredBy: 'API',
    recordsFetched: 0,
    recordsUpserted: 0,
    errorMessage: null,
    startedAt: new Date(),
    completedAt: null,
    ...overrides,
  } as SyncJob;
}

// ── Mock factories ─────────────────────────────────────────────────────────

function mockQueryBuilder() {
  const qb: any = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orUpdate: jest.fn().mockReturnThis(),
  };
  return qb;
}

function makeRepos() {
  const job = makeJob();

  const jobRepo = {
    create: jest.fn().mockReturnValue(job),
    save: jest.fn().mockResolvedValue(job),
    find: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn().mockResolvedValue(null),
  };

  const instrumentRepo = {
    findOneBy: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder()),
  };

  const navRepo = {
    findOne: jest.fn().mockResolvedValue(null), // no prior prices by default
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder()),
  };

  const yahoo = {
    resolveTickerForIsin: jest.fn(),
    fetchHistory: jest.fn().mockResolvedValue([]),
  };

  return { jobRepo, instrumentRepo, navRepo, yahoo };
}

async function buildService(repos: ReturnType<typeof makeRepos>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SyncService,
      { provide: getRepositoryToken(SyncJob),     useValue: repos.jobRepo },
      { provide: getRepositoryToken(Instrument),  useValue: repos.instrumentRepo },
      { provide: getRepositoryToken(NavPrice),    useValue: repos.navRepo },
      { provide: YahooFinanceService,             useValue: repos.yahoo },
    ],
  }).compile();
  return module.get<SyncService>(SyncService);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SyncService — ticker resolution order', () => {
  it('uses instrument.ticker directly for crypto (no resolveTickerForIsin call)', async () => {
    const repos = makeRepos();
    const inst = makeInstrument({
      isin: null,
      ticker: 'BTC-USD',
      assetClass: AssetClass.CRYPTO,
    });
    repos.instrumentRepo.findOneBy.mockResolvedValue(inst);
    repos.yahoo.fetchHistory.mockResolvedValue([
      { date: '2025-01-01', nav: 95000 },
    ]);

    const svc = await buildService(repos);
    const result = await svc.syncInstrument(inst.id);

    expect(repos.yahoo.resolveTickerForIsin).not.toHaveBeenCalled();
    expect(result.status).toBe(SyncStatus.SUCCESS);
    expect(result.yahooTicker).toBe('BTC-USD');
  });

  it('uses externalIds.yahoo_ticker cache on second run without network call', async () => {
    const repos = makeRepos();
    const inst = makeInstrument({
      externalIds: { yahoo_ticker: 'IE0001234567.IR' } as any,
    });
    repos.instrumentRepo.findOneBy.mockResolvedValue(inst);

    const svc = await buildService(repos);
    await svc.syncInstrument(inst.id);

    expect(repos.yahoo.resolveTickerForIsin).not.toHaveBeenCalled();
  });

  it('calls resolveTickerForIsin when isin is present and no cache/ticker', async () => {
    const repos = makeRepos();
    const inst = makeInstrument({ externalIds: {} });
    repos.instrumentRepo.findOneBy.mockResolvedValue(inst);
    repos.yahoo.resolveTickerForIsin.mockResolvedValue({ symbol: 'IE0001234567.IR' });

    const svc = await buildService(repos);
    await svc.syncInstrument(inst.id);

    expect(repos.yahoo.resolveTickerForIsin).toHaveBeenCalledWith('IE0001234567');
  });

  it('does NOT call resolveTickerForIsin for crypto even when ticker column is set', async () => {
    const repos = makeRepos();
    const inst = makeInstrument({
      isin: null,
      ticker: 'ETH-USD',
      assetClass: AssetClass.CRYPTO,
    });
    repos.instrumentRepo.findOneBy.mockResolvedValue(inst);

    const svc = await buildService(repos);
    await svc.syncInstrument(inst.id);

    expect(repos.yahoo.resolveTickerForIsin).not.toHaveBeenCalled();
  });

  it('forceTickerRefresh bypasses both ticker column and cache, then re-resolves by ISIN', async () => {
    const repos = makeRepos();
    const inst = makeInstrument({
      ticker: 'OLD-TICKER',
      externalIds: { yahoo_ticker: 'CACHED' } as any,
    });
    repos.instrumentRepo.findOneBy.mockResolvedValue(inst);
    repos.yahoo.resolveTickerForIsin.mockResolvedValue({ symbol: 'FRESH-TICKER' });

    const svc = await buildService(repos);
    const result = await svc.syncInstrument(inst.id, { forceTickerRefresh: true });

    expect(repos.yahoo.resolveTickerForIsin).toHaveBeenCalledWith('IE0001234567');
    expect(result.yahooTicker).toBe('FRESH-TICKER');
  });
});

describe('SyncService — failure messages', () => {
  it('names the ISIN in the error when an ISIN instrument cannot be resolved', async () => {
    const repos = makeRepos();
    const inst = makeInstrument({ externalIds: {} });
    repos.instrumentRepo.findOneBy.mockResolvedValue(inst);
    repos.yahoo.resolveTickerForIsin.mockResolvedValue(null);

    const svc = await buildService(repos);
    const result = await svc.syncInstrument(inst.id);

    expect(result.status).toBe(SyncStatus.FAILED);
    expect(result.error).toContain('IE0001234567');
    // Must NOT say 'set the ticker field' — that message is only for crypto
    expect(result.error).not.toContain('set the ticker field');
  });

  it('tells user to set the ticker field for a crypto instrument with no ticker', async () => {
    const repos = makeRepos();
    const inst = makeInstrument({
      name: 'Bitcoin',
      isin: null,
      ticker: null,
      assetClass: AssetClass.CRYPTO,
    });
    repos.instrumentRepo.findOneBy.mockResolvedValue(inst);

    const svc = await buildService(repos);
    const result = await svc.syncInstrument(inst.id);

    expect(result.status).toBe(SyncStatus.FAILED);
    expect(result.error).toContain('set the ticker field');
    // Must NOT contain the word 'ISIN' — crypto has no ISIN
    expect(result.error).not.toContain('ISIN');
  });
});

describe('SyncService — happy-path sync', () => {
  it('syncs a crypto instrument successfully: isin=null, yahooTicker=BTC-USD', async () => {
    const repos = makeRepos();
    const inst = makeInstrument({
      isin: null,
      ticker: 'BTC-USD',
      assetClass: AssetClass.CRYPTO,
    });
    repos.instrumentRepo.findOneBy.mockResolvedValue(inst);
    repos.yahoo.fetchHistory.mockResolvedValue([
      { date: '2025-01-01', nav: 95000 },
      { date: '2025-01-02', nav: 96000 },
    ]);

    const svc = await buildService(repos);
    const result = await svc.syncInstrument(inst.id);

    expect(result.status).toBe(SyncStatus.SUCCESS);
    expect(result.isin).toBeNull();
    expect(result.yahooTicker).toBe('BTC-USD');
    expect(result.recordsUpserted).toBe(2);
  });

  it('syncs an ISIN instrument successfully: isin present in result', async () => {
    const repos = makeRepos();
    const inst = makeInstrument({
      externalIds: { yahoo_ticker: 'IE0001234567.IR' } as any,
    });
    repos.instrumentRepo.findOneBy.mockResolvedValue(inst);
    repos.yahoo.fetchHistory.mockResolvedValue([
      { date: '2025-01-01', nav: 10.5 },
    ]);

    const svc = await buildService(repos);
    const result = await svc.syncInstrument(inst.id);

    expect(result.status).toBe(SyncStatus.SUCCESS);
    expect(result.isin).toBe('IE0001234567');
    expect(result.recordsUpserted).toBe(1);
  });

  it('returns SUCCESS without fetching when already up to date (incremental skip)', async () => {
    const repos = makeRepos();
    const inst = makeInstrument({
      externalIds: { yahoo_ticker: 'IE0001234567.IR' } as any,
    });
    repos.instrumentRepo.findOneBy.mockResolvedValue(inst);
    // Latest stored NAV is today — so fromDate will be tomorrow > effectiveToDate
    const today = new Date().toISOString().slice(0, 10);
    repos.navRepo.findOne.mockResolvedValue({ date: today } as NavPrice);

    const svc = await buildService(repos);
    const result = await svc.syncInstrument(inst.id);

    expect(result.status).toBe(SyncStatus.SUCCESS);
    expect(result.recordsUpserted).toBe(0);
    expect(repos.yahoo.fetchHistory).not.toHaveBeenCalled();
  });
});

describe('SyncService — SyncResult shape', () => {
  it('result.isin is null (not undefined) for crypto instruments', async () => {
    const repos = makeRepos();
    const inst = makeInstrument({ isin: null, ticker: 'BTC-USD', assetClass: AssetClass.CRYPTO });
    repos.instrumentRepo.findOneBy.mockResolvedValue(inst);

    const svc = await buildService(repos);
    const result = await svc.syncInstrument(inst.id);

    // Explicitly null, not undefined — matters for JSON serialisation
    expect(result.isin).toBeNull();
  });

  it('result.isin carries the ISIN string for non-crypto instruments', async () => {
    const repos = makeRepos();
    const inst = makeInstrument({
      externalIds: { yahoo_ticker: 'IE0001234567.IR' } as any,
    });
    repos.instrumentRepo.findOneBy.mockResolvedValue(inst);

    const svc = await buildService(repos);
    const result = await svc.syncInstrument(inst.id);

    expect(result.isin).toBe('IE0001234567');
  });

  it('throws NotFoundException when instrument does not exist', async () => {
    const repos = makeRepos();
    repos.instrumentRepo.findOneBy.mockResolvedValue(null);

    const svc = await buildService(repos);
    await expect(svc.syncInstrument('non-existent-id')).rejects.toThrow(NotFoundException);
  });
});
