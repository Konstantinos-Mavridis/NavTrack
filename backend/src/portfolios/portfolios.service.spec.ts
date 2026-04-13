/**
 * Unit tests for PortfoliosService
 *
 * Tests focus on the pure-TypeScript helpers and the validation logic inside
 * importPortfoliosFromJson / importPortfoliosFromCsv that run before any DB
 * call.  The DataSource and Repository calls are fully mocked.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PortfoliosService } from './portfolios.service';
import { Portfolio } from './portfolio.entity';
import { PortfolioPosition } from './portfolio-position.entity';
import { Instrument } from '../instruments/instrument.entity';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn((dto: any) => dto),
    remove: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  };
}

function makeDataSource() {
  return {
    query: jest.fn().mockResolvedValue([]),
    transaction: jest.fn(async (cb: any) => cb({
      save: jest.fn(async (e: any) => ({ ...e, id: 'new-id' })),
      create: jest.fn((cls: any, dto: any) => dto),
      delete: jest.fn(),
    })),
  };
}

describe('PortfoliosService', () => {
  let service: PortfoliosService;
  let portfolioRepo: ReturnType<typeof makeRepo>;
  let positionRepo: ReturnType<typeof makeRepo>;
  let instrumentRepo: ReturnType<typeof makeRepo>;
  let dataSource: ReturnType<typeof makeDataSource>;

  beforeEach(async () => {
    portfolioRepo  = makeRepo();
    positionRepo   = makeRepo();
    instrumentRepo = makeRepo();
    dataSource     = makeDataSource();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfoliosService,
        { provide: getRepositoryToken(Portfolio),          useValue: portfolioRepo },
        { provide: getRepositoryToken(PortfolioPosition),  useValue: positionRepo },
        { provide: getRepositoryToken(Instrument),         useValue: instrumentRepo },
        { provide: DataSource,                             useValue: dataSource },
      ],
    }).compile();

    service = module.get(PortfoliosService);
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the portfolio when found', async () => {
      const p = { id: 'p1', name: 'My Portfolio' };
      portfolioRepo.findOneBy.mockResolvedValue(p);
      await expect(service.findOne('p1')).resolves.toEqual(p);
    });

    it('throws NotFoundException when portfolio does not exist', async () => {
      portfolioRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('persists and returns the new portfolio', async () => {
      const dto  = { name: 'Test', description: null };
      const saved = { id: 'new-uuid', ...dto };
      portfolioRepo.save.mockResolvedValue(saved);

      await expect(service.create(dto)).resolves.toEqual(saved);
      expect(portfolioRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('applies name change and saves', async () => {
      const existing = { id: 'p1', name: 'Old', description: null };
      portfolioRepo.findOneBy.mockResolvedValue(existing);
      portfolioRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.update('p1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('throws NotFoundException for an unknown id', async () => {
      portfolioRepo.findOneBy.mockResolvedValue(null);
      await expect(service.update('ghost', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes an existing portfolio', async () => {
      const p = { id: 'p1', name: 'x' };
      portfolioRepo.findOneBy.mockResolvedValue(p);
      portfolioRepo.remove.mockResolvedValue(p);
      await expect(service.remove('p1')).resolves.toBeUndefined();
      expect(portfolioRepo.remove).toHaveBeenCalledWith(p);
    });
  });

  // ── removePosition ─────────────────────────────────────────────────────────

  describe('removePosition', () => {
    it('throws NotFoundException for an unknown position', async () => {
      positionRepo.findOne.mockResolvedValue(null);
      await expect(service.removePosition('p1', 'missing-pos')).rejects.toThrow(NotFoundException);
    });
  });

  // ── clearPositions ─────────────────────────────────────────────────────────

  describe('clearPositions', () => {
    it('returns the number of deleted rows', async () => {
      positionRepo.delete.mockResolvedValue({ affected: 3 });
      const result = await service.clearPositions('p1');
      expect(result).toEqual({ deleted: 3 });
    });

    it('returns 0 when no rows were deleted', async () => {
      positionRepo.delete.mockResolvedValue({ affected: undefined });
      const result = await service.clearPositions('p1');
      expect(result).toEqual({ deleted: 0 });
    });
  });

  // ── importPortfoliosFromJson validation ───────────────────────────────────

  describe('importPortfoliosFromJson', () => {
    it('throws BadRequestException for a missing portfolios array', async () => {
      await expect(service.importPortfoliosFromJson({})).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for an empty portfolios array', async () => {
      await expect(
        service.importPortfoliosFromJson({ portfolios: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for portfolios with blank names', async () => {
      await expect(
        service.importPortfoliosFromJson({ portfolios: [{ name: '   ', transactions: [] }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('imports a valid portfolio without crashing', async () => {
      instrumentRepo.find.mockResolvedValue([]);
      const result = await service.importPortfoliosFromJson({
        portfolios: [{ name: 'My Portfolio', transactions: [] }],
      });
      expect(result.portfoliosImported).toBe(1);
      expect(result.transactionsImported).toBe(0);
    });
  });

  // ── importPortfoliosFromCsv validation ────────────────────────────────────

  describe('importPortfoliosFromCsv', () => {
    it('throws BadRequestException for empty input', async () => {
      await expect(service.importPortfoliosFromCsv('')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for whitespace-only input', async () => {
      await expect(service.importPortfoliosFromCsv('   \n  ')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when required columns are missing', async () => {
      const csv = 'portfolio_name,type\nMy Portfolio,BUY';
      await expect(service.importPortfoliosFromCsv(csv)).rejects.toThrow(BadRequestException);
    });

    it('parses a valid CSV and produces correct import summary', async () => {
      instrumentRepo.find.mockResolvedValue([
        { id: 'inst-1', isin: 'IE0001234567', name: 'Test Fund' },
      ]);

      const header = [
        'portfolio_name,portfolio_description,instrument_isin,instrument_name,',
        'type,trade_date,settlement_date,units,price_per_unit,fees,notes',
      ].join('');
      const row = [
        'My Portfolio,,IE0001234567,Test Fund,',
        'BUY,2024-01-15,,100,10.00,0,',
      ].join('');
      const csv = `${header}\n${row}`;

      const result = await service.importPortfoliosFromCsv(csv);

      expect(result.portfoliosImported).toBe(1);
      expect(result.transactionsImported).toBe(1);
      expect(result.transactionsSkipped).toBe(0);
    });

    it('skips a transaction whose instrument ISIN is not in the database', async () => {
      instrumentRepo.find.mockResolvedValue([]);  // no instruments found

      const header = [
        'portfolio_name,portfolio_description,instrument_isin,instrument_name,',
        'type,trade_date,settlement_date,units,price_per_unit,fees,notes',
      ].join('');
      const row = [
        'My Portfolio,,IE0000000000,Unknown Fund,',
        'BUY,2024-01-15,,100,10.00,0,',
      ].join('');
      const csv = `${header}\n${row}`;

      const result = await service.importPortfoliosFromCsv(csv);

      expect(result.transactionsSkipped).toBe(1);
      expect(result.missingInstruments).toContain('IE0000000000');
    });
  });

  // ── exportPortfoliosCsv ───────────────────────────────────────────────────

  describe('exportPortfoliosCsv', () => {
    it('produces a CSV string with the correct header row', async () => {
      portfolioRepo.find.mockResolvedValue([]);
      const csv = await service.exportPortfoliosCsv();
      const firstLine = csv.split('\n')[0];
      expect(firstLine).toContain('portfolio_name');
      expect(firstLine).toContain('instrument_isin');
      expect(firstLine).toContain('trade_date');
    });

    it('returns only the header when there are no portfolios', async () => {
      portfolioRepo.find.mockResolvedValue([]);
      const csv = await service.exportPortfoliosCsv();
      const lines = csv.split('\n').filter(Boolean);
      expect(lines).toHaveLength(1);  // header only
    });
  });
});
