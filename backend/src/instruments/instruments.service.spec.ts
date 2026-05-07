/**
 * Unit tests for InstrumentsService
 *
 * All repository calls are mocked — no real database required.
 */
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InstrumentsService } from './instruments.service';
import { Instrument } from './instrument.entity';

function makeInstrument(overrides: Partial<Instrument> = {}): Instrument {
  return {
    id: 'inst-1',
    name: 'Test Fund',
    isin: 'IE0001234567',
    ticker: null,
    currency: 'EUR',
    assetClass: 'EQUITY' as any,
    riskLevel: 3,
    dataSources: [],
    externalIds: {},
    createdAt: new Date(),
    ...overrides,
  } as Instrument;
}

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn((dto: any) => dto),
    remove: jest.fn(),
    ...overrides,
  };
}

describe('InstrumentsService', () => {
  let service: InstrumentsService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstrumentsService,
        { provide: getRepositoryToken(Instrument), useValue: repo },
      ],
    }).compile();

    service = module.get(InstrumentsService);
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all instruments ordered by name', async () => {
      const instruments = [makeInstrument()];
      repo.find.mockResolvedValue(instruments);
      await expect(service.findAll()).resolves.toEqual(instruments);
      expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the instrument when found', async () => {
      const inst = makeInstrument();
      repo.findOneBy.mockResolvedValue(inst);
      await expect(service.findOne('inst-1')).resolves.toEqual(inst);
    });

    it('throws NotFoundException for an unknown id', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const isinDto = {
      name: 'New Fund',
      isin: 'ie0009876543',
      currency: 'EUR',
      assetClass: 'BOND' as any,
      riskLevel: 2,
    };

    it('persists and returns the new instrument with ISIN uppercased', async () => {
      repo.findOneBy.mockResolvedValue(null);
      const saved = makeInstrument({ isin: 'IE0009876543' });
      repo.save.mockResolvedValue(saved);

      const result = await service.create(isinDto);
      expect(result).toEqual(saved);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ isin: 'IE0009876543' }));
    });

    it('throws ConflictException when ISIN already exists', async () => {
      repo.findOneBy.mockResolvedValue(makeInstrument());
      await expect(service.create(isinDto)).rejects.toThrow(ConflictException);
    });

    it('defaults currency to EUR when not provided', async () => {
      repo.findOneBy.mockResolvedValue(null);
      repo.save.mockImplementation(async (inst: any) => inst);
      await service.create({ name: 'X', isin: 'IE0000000001', assetClass: 'EQUITY' as any, riskLevel: 1 } as any);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ currency: 'EUR' }));
    });

    // ── crypto / ticker-only paths ───────────────────────────────────────────

    it('creates a crypto instrument with ticker only (no ISIN)', async () => {
      repo.findOneBy.mockResolvedValue(null);
      const saved = makeInstrument({ isin: null, ticker: 'BTC-USD', assetClass: 'CRYPTO' as any });
      repo.save.mockResolvedValue(saved);

      const result = await service.create({
        name: 'Bitcoin',
        ticker: 'BTC-USD',
        currency: 'USD',
        assetClass: 'CRYPTO' as any,
        riskLevel: 7,
      } as any);

      expect(result.ticker).toBe('BTC-USD');
      expect(result.isin).toBeNull();
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isin: null, ticker: 'BTC-USD' }),
      );
    });

    it('throws ConflictException when ticker already exists', async () => {
      // First findOneBy (isin check) → null; second (ticker check) → existing
      repo.findOneBy
        .mockResolvedValueOnce(null)      // isin check: no conflict
        .mockResolvedValueOnce(makeInstrument({ isin: null, ticker: 'BTC-USD' }));

      await expect(
        service.create({
          name: 'Bitcoin duplicate',
          ticker: 'BTC-USD',
          currency: 'USD',
          assetClass: 'CRYPTO' as any,
          riskLevel: 7,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('creates an instrument with both ISIN and ticker', async () => {
      repo.findOneBy.mockResolvedValue(null);
      repo.save.mockImplementation(async (inst: any) => inst);

      await service.create({
        name: 'Hybrid',
        isin: 'IE0001111111',
        ticker: 'HYB-USD',
        currency: 'USD',
        assetClass: 'EQUITY' as any,
        riskLevel: 4,
      } as any);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isin: 'IE0001111111', ticker: 'HYB-USD' }),
      );
    });

    it('throws BadRequestException when neither isin nor ticker is provided', async () => {
      await expect(
        service.create({
          name: 'Ghost',
          currency: 'EUR',
          assetClass: 'EQUITY' as any,
          riskLevel: 1,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('applies changes and saves', async () => {
      const inst = makeInstrument();
      repo.findOneBy.mockResolvedValue(inst);
      repo.save.mockImplementation(async (i: any) => i);

      const result = await service.update('inst-1', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('throws NotFoundException for unknown id', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.update('ghost', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the instrument', async () => {
      const inst = makeInstrument();
      repo.findOneBy.mockResolvedValue(inst);
      repo.remove.mockResolvedValue(inst);
      await expect(service.remove('inst-1')).resolves.toBeUndefined();
      expect(repo.remove).toHaveBeenCalledWith(inst);
    });

    it('throws NotFoundException for an unknown id', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.remove('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── exportJson ──────────────────────────────────────────────────────────────

  describe('exportJson', () => {
    it('maps ISIN instruments to export rows', async () => {
      const inst = makeInstrument({ dataSources: ['morningstar'], externalIds: { ms: '123' } });
      repo.find.mockResolvedValue([inst]);

      const rows = await service.exportJson();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        name: inst.name,
        isin: inst.isin,
        ticker: null,
        currency: inst.currency,
        dataSources: ['morningstar'],
        externalIds: { ms: '123' },
      });
    });

    it('maps crypto instruments with ticker and null isin', async () => {
      const inst = makeInstrument({ isin: null, ticker: 'ETH-USD', assetClass: 'CRYPTO' as any });
      repo.find.mockResolvedValue([inst]);

      const rows = await service.exportJson();
      expect(rows[0]).toMatchObject({ isin: null, ticker: 'ETH-USD' });
    });
  });

  // ── exportCsv ───────────────────────────────────────────────────────────────

  describe('exportCsv', () => {
    it('produces a CSV string with the correct header including ticker', async () => {
      repo.find.mockResolvedValue([]);
      const csv = await service.exportCsv();
      const header = csv.split('\n')[0];
      expect(header).toContain('name');
      expect(header).toContain('isin');
      expect(header).toContain('ticker');
      expect(header).toContain('currency');
    });

    it('returns only the header row when there are no instruments', async () => {
      repo.find.mockResolvedValue([]);
      const csv = await service.exportCsv();
      const lines = csv.split('\n').filter(Boolean);
      expect(lines).toHaveLength(1);
    });

    it('CSV-escapes values that contain commas', async () => {
      const inst = makeInstrument({ name: 'Fund, Inc.' });
      repo.find.mockResolvedValue([inst]);
      const csv = await service.exportCsv();
      expect(csv).toContain('"Fund, Inc."');
    });

    it('serialises a crypto row with empty isin and populated ticker', async () => {
      const inst = makeInstrument({ isin: null, ticker: 'BTC-USD', assetClass: 'CRYPTO' as any });
      repo.find.mockResolvedValue([inst]);
      const csv = await service.exportCsv();
      // null isin should be empty string in CSV; ticker should be present
      const dataRow = csv.split('\n')[1];
      expect(dataRow).toContain('BTC-USD');
      // isin column is empty — the row should start with the name, then a comma
      // and then an empty isin field before the ticker
      const cols = dataRow.split(',');
      expect(cols[1]).toBe(''); // isin column empty
      expect(cols[2]).toBe('BTC-USD'); // ticker column populated
    });
  });

  // ── importJson ──────────────────────────────────────────────────────────────

  describe('importJson', () => {
    it('imports new ISIN instruments and returns the correct summary', async () => {
      repo.findOneBy.mockResolvedValue(null);
      repo.save.mockImplementation(async (inst: any) => inst);

      const result = await service.importJson([
        { name: 'Fund A', isin: 'IE0001111111', ticker: null, currency: 'EUR', assetClass: 'EQUITY' as any, riskLevel: 3, dataSources: [], externalIds: {} },
      ]);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.skippedIsins).toHaveLength(0);
    });

    it('skips instruments whose ISIN already exists', async () => {
      repo.findOneBy.mockResolvedValue(makeInstrument());

      const result = await service.importJson([
        { name: 'Duplicate', isin: 'IE0001234567', ticker: null, currency: 'EUR', assetClass: 'EQUITY' as any, riskLevel: 3, dataSources: [], externalIds: {} },
      ]);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.skippedIsins).toContain('IE0001234567');
    });

    it('skips rows with neither isin nor ticker', async () => {
      const result = await service.importJson([
        { name: 'No identifiers', isin: null, ticker: null, currency: 'EUR', assetClass: 'EQUITY' as any, riskLevel: 3, dataSources: [], externalIds: {} },
      ]);
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
    });

    // ── crypto-specific import paths ─────────────────────────────────────────

    it('imports a ticker-only (crypto) instrument', async () => {
      repo.findOneBy.mockResolvedValue(null);
      repo.save.mockImplementation(async (inst: any) => inst);

      const result = await service.importJson([
        { name: 'Bitcoin', isin: null, ticker: 'BTC-USD', currency: 'USD', assetClass: 'CRYPTO' as any, riskLevel: 7, dataSources: [], externalIds: {} },
      ]);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('skips a ticker-only row when the ticker already exists', async () => {
      // findOneBy for isin is skipped (null); findOneBy for ticker returns existing
      repo.findOneBy.mockResolvedValue(
        makeInstrument({ isin: null, ticker: 'BTC-USD', assetClass: 'CRYPTO' as any }),
      );

      const result = await service.importJson([
        { name: 'Bitcoin duplicate', isin: null, ticker: 'BTC-USD', currency: 'USD', assetClass: 'CRYPTO' as any, riskLevel: 7, dataSources: [], externalIds: {} },
      ]);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.skippedIsins).toContain('BTC-USD');
    });

    it('imports multiple rows: one ISIN-based, one ticker-only', async () => {
      repo.findOneBy.mockResolvedValue(null);
      repo.save.mockImplementation(async (inst: any) => inst);

      const result = await service.importJson([
        { name: 'Fund A', isin: 'IE0001111111', ticker: null, currency: 'EUR', assetClass: 'EQUITY' as any, riskLevel: 3, dataSources: [], externalIds: {} },
        { name: 'Ethereum', isin: null, ticker: 'ETH-USD', currency: 'USD', assetClass: 'CRYPTO' as any, riskLevel: 7, dataSources: [], externalIds: {} },
      ]);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
    });
  });

  // ── importCsv ───────────────────────────────────────────────────────────────

  describe('importCsv', () => {
    it('returns empty result for an empty string', async () => {
      const result = await service.importCsv('');
      expect(result).toEqual({ imported: 0, skipped: 0, skippedIsins: [] });
    });

    it('returns empty result for header-only CSV (no data rows)', async () => {
      const result = await service.importCsv('name,isin,ticker,currency,assetClass,riskLevel,dataSources,externalIds');
      expect(result).toEqual({ imported: 0, skipped: 0, skippedIsins: [] });
    });

    it('parses a valid ISIN CSV row (new 8-column format) and imports the instrument', async () => {
      repo.findOneBy.mockResolvedValue(null);
      repo.save.mockImplementation(async (inst: any) => inst);

      const csv = [
        'name,isin,ticker,currency,assetClass,riskLevel,dataSources,externalIds',
        'Test Fund,IE0001234567,,EUR,EQUITY,3,,{}',
      ].join('\n');

      const result = await service.importCsv(csv);
      expect(result.imported).toBe(1);
    });

    it('parses a legacy 7-column CSV row (no ticker column) and imports the instrument', async () => {
      repo.findOneBy.mockResolvedValue(null);
      repo.save.mockImplementation(async (inst: any) => inst);

      const csv = [
        'name,isin,currency,assetClass,riskLevel,dataSources,externalIds',
        'Test Fund,IE0001234567,EUR,EQUITY,3,,{}',
      ].join('\n');

      const result = await service.importCsv(csv);
      expect(result.imported).toBe(1);
    });

    it('parses a crypto CSV row (ticker only, empty isin) and imports the instrument', async () => {
      repo.findOneBy.mockResolvedValue(null);
      repo.save.mockImplementation(async (inst: any) => inst);

      const csv = [
        'name,isin,ticker,currency,assetClass,riskLevel,dataSources,externalIds',
        'Bitcoin,,BTC-USD,USD,CRYPTO,7,,{}',
      ].join('\n');

      const result = await service.importCsv(csv);
      expect(result.imported).toBe(1);
    });
  });
});
