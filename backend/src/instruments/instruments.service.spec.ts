/**
 * Unit tests for InstrumentsService
 *
 * All repository calls are mocked — no real database required.
 */
import {
  ConflictException,
  NotFoundException,
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
    const dto = {
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

      const result = await service.create(dto);
      expect(result).toEqual(saved);
      // Verify create was called with uppercased ISIN
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ isin: 'IE0009876543' }));
    });

    it('throws ConflictException when ISIN already exists', async () => {
      repo.findOneBy.mockResolvedValue(makeInstrument());
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('defaults currency to EUR when not provided', async () => {
      repo.findOneBy.mockResolvedValue(null);
      repo.save.mockImplementation(async (inst: any) => inst);
      await service.create({ name: 'X', isin: 'IE0000000001', assetClass: 'EQUITY' as any, riskLevel: 1 } as any);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ currency: 'EUR' }));
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
    it('maps instruments to export rows', async () => {
      const inst = makeInstrument({ dataSources: ['morningstar'], externalIds: { ms: '123' } });
      repo.find.mockResolvedValue([inst]);

      const rows = await service.exportJson();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        name: inst.name,
        isin: inst.isin,
        currency: inst.currency,
        dataSources: ['morningstar'],
        externalIds: { ms: '123' },
      });
    });
  });

  // ── exportCsv ───────────────────────────────────────────────────────────────

  describe('exportCsv', () => {
    it('produces a CSV string with the correct header', async () => {
      repo.find.mockResolvedValue([]);
      const csv = await service.exportCsv();
      const header = csv.split('\n')[0];
      expect(header).toContain('name');
      expect(header).toContain('isin');
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
  });

  // ── importJson ──────────────────────────────────────────────────────────────

  describe('importJson', () => {
    it('imports new instruments and returns the correct summary', async () => {
      repo.findOneBy.mockResolvedValue(null);
      repo.save.mockImplementation(async (inst: any) => inst);

      const result = await service.importJson([
        { name: 'Fund A', isin: 'IE0001111111', currency: 'EUR', assetClass: 'EQUITY' as any, riskLevel: 3, dataSources: [], externalIds: {} },
      ]);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.skippedIsins).toHaveLength(0);
    });

    it('skips instruments whose ISIN already exists', async () => {
      repo.findOneBy.mockResolvedValue(makeInstrument());

      const result = await service.importJson([
        { name: 'Duplicate', isin: 'IE0001234567', currency: 'EUR', assetClass: 'EQUITY' as any, riskLevel: 3, dataSources: [], externalIds: {} },
      ]);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.skippedIsins).toContain('IE0001234567');
    });

    it('skips rows with a missing ISIN', async () => {
      const result = await service.importJson([
        { name: 'No ISIN', isin: '', currency: 'EUR', assetClass: 'EQUITY' as any, riskLevel: 3, dataSources: [], externalIds: {} },
      ]);
      expect(result.imported).toBe(0);
    });
  });

  // ── importCsv ───────────────────────────────────────────────────────────────

  describe('importCsv', () => {
    it('returns empty result for an empty string', async () => {
      const result = await service.importCsv('');
      expect(result).toEqual({ imported: 0, skipped: 0, skippedIsins: [] });
    });

    it('returns empty result for header-only CSV (no data rows)', async () => {
      const result = await service.importCsv('name,isin,currency,assetClass,riskLevel,dataSources,externalIds');
      expect(result).toEqual({ imported: 0, skipped: 0, skippedIsins: [] });
    });

    it('parses a valid CSV row and imports the instrument', async () => {
      repo.findOneBy.mockResolvedValue(null);
      repo.save.mockImplementation(async (inst: any) => inst);

      const csv = [
        'name,isin,currency,assetClass,riskLevel,dataSources,externalIds',
        'Test Fund,IE0001234567,EUR,EQUITY,3,,{}',
      ].join('\n');

      const result = await service.importCsv(csv);
      expect(result.imported).toBe(1);
    });
  });
});
