/**
 * Unit tests for NavPricesService
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NavPricesService } from './nav-prices.service';
import { NavPrice, NavSource } from './nav-price.entity';
import { InstrumentsService } from '../instruments/instruments.service';

function makeRepo() {
  // qb is the query-builder object returned by repo.createQueryBuilder().
  // Do NOT add createQueryBuilder to qb itself — that would create a circular
  // reference that breaks babel-istanbul's module wrapper.
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    distinctOn: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orUpdate: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };

  return {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
    _qb: qb,
  };
}

describe('NavPricesService', () => {
  let service: NavPricesService;
  let repo: ReturnType<typeof makeRepo>;
  let instruments: jest.Mocked<Pick<InstrumentsService, 'findOne'>>;

  beforeEach(async () => {
    repo = makeRepo();
    instruments = { findOne: jest.fn().mockResolvedValue({ id: 'inst-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NavPricesService,
        { provide: getRepositoryToken(NavPrice), useValue: repo },
        { provide: InstrumentsService,           useValue: instruments },
      ],
    }).compile();

    service = module.get(NavPricesService);
  });

  describe('findByInstrument', () => {
    it('calls 404-guard then returns sorted prices', async () => {
      const prices = [{ id: '1', nav: 10 }] as any[];
      repo.find.mockResolvedValue(prices);

      const result = await service.findByInstrument('inst-1');

      expect(instruments.findOne).toHaveBeenCalledWith('inst-1');
      expect(result).toBe(prices);
    });
  });

  describe('latestForInstrument', () => {
    it('returns null when no price exists', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.latestForInstrument('inst-1')).resolves.toBeNull();
    });

    it('returns the most recent price', async () => {
      const price = { nav: 15.5, date: '2024-01-31' };
      repo.findOne.mockResolvedValue(price);
      await expect(service.latestForInstrument('inst-1')).resolves.toEqual(price);
    });
  });

  describe('latestForManyInstruments', () => {
    it('returns an empty Map when given an empty id array', async () => {
      const result = await service.latestForManyInstruments([]);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('builds a Map keyed by instrumentId', async () => {
      repo._qb.getMany.mockResolvedValue([
        { instrumentId: 'inst-1', nav: 10, date: '2024-01-31' },
        { instrumentId: 'inst-2', nav: 20, date: '2024-01-30' },
      ]);

      const result = await service.latestForManyInstruments(['inst-1', 'inst-2']);

      expect(result.size).toBe(2);
      expect(result.get('inst-1')?.nav).toBe(10);
      expect(result.get('inst-2')?.nav).toBe(20);
    });
  });

  describe('navOnDate', () => {
    it('returns null when there is no NAV on or before the date', async () => {
      repo._qb.getOne.mockResolvedValue(null);
      await expect(service.navOnDate('inst-1', '2024-01-01')).resolves.toBeNull();
    });

    it('returns the price row when one exists', async () => {
      const price = { nav: 12.34, date: '2023-12-31' };
      repo._qb.getOne.mockResolvedValue(price);
      await expect(service.navOnDate('inst-1', '2024-01-01')).resolves.toEqual(price);
    });
  });

  describe('bulkUpsert', () => {
    it('returns the count of upserted entries', async () => {
      const entries = [
        { date: '2024-01-01', nav: 10, source: NavSource.MANUAL },
        { date: '2024-01-02', nav: 11, source: NavSource.MANUAL },
      ];
      const result = await service.bulkUpsert('inst-1', entries);
      expect(result).toEqual({ upserted: 2 });
    });

    it('calls the 404-guard for the instrument', async () => {
      await service.bulkUpsert('inst-1', []);
      expect(instruments.findOne).toHaveBeenCalledWith('inst-1');
    });
  });
});
