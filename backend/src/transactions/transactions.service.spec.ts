/**
 * Unit tests for TransactionsService
 *
 * All DB calls (Repository, entity manager) and service dependencies are fully
 * mocked so these tests run without a real database.
 */
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TransactionsService } from './transactions.service';
import { Transaction, TransactionType } from './transaction.entity';
import { AllocationTemplate } from '../templates/allocation-template.entity';
import { NavPricesService } from '../nav-prices/nav-prices.service';
import { PortfoliosService } from '../portfolios/portfolios.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    portfolioId: 'port-1',
    instrumentId: 'inst-1',
    type: TransactionType.BUY,
    tradeDate: '2024-01-15',
    settlementDate: null,
    units: 100,
    pricePerUnit: 10,
    fees: 0,
    notes: null,
    createdAt: new Date(),
    instrument: null,
    ...overrides,
  } as Transaction;
}

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    create: jest.fn((dto: any) => dto),
    remove: jest.fn(),
    delete: jest.fn(),
    manager: {
      transaction: jest.fn(async (cb: any) =>
        cb({
          save: jest.fn(async (_cls: any, vals: any[]) =>
            vals.map((v, i) => ({ ...v, id: `txn-new-${i}` }))
          ),
          create: jest.fn((_cls: any, vals: any) => vals),
          find: jest.fn(async () => []),
        })
      ),
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('TransactionsService', () => {
  let service: TransactionsService;
  let txnRepo: ReturnType<typeof makeRepo>;
  let templateRepo: ReturnType<typeof makeRepo>;
  let navPrices: jest.Mocked<NavPricesService>;
  let portfolios: jest.Mocked<Pick<PortfoliosService, 'recalculateFromTransactions'>>;

  beforeEach(async () => {
    txnRepo = makeRepo();
    templateRepo = makeRepo();
    navPrices = { navOnDate: jest.fn() } as any;
    portfolios = { recalculateFromTransactions: jest.fn().mockResolvedValue(undefined) } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: getRepositoryToken(Transaction),        useValue: txnRepo },
        { provide: getRepositoryToken(AllocationTemplate), useValue: templateRepo },
        { provide: NavPricesService,                       useValue: navPrices },
        { provide: PortfoliosService,                      useValue: portfolios },
      ],
    }).compile();

    service = module.get(TransactionsService);
  });

  // ── findByPortfolio ─────────────────────────────────────────────────────────

  describe('findByPortfolio', () => {
    it('returns transactions for the given portfolio', async () => {
      const txns = [makeTxn()];
      txnRepo.find.mockResolvedValue(txns);
      await expect(service.findByPortfolio('port-1')).resolves.toEqual(txns);
      expect(txnRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { portfolioId: 'port-1' } }),
      );
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const baseDto = {
      instrumentId: 'inst-1',
      type: TransactionType.BUY,
      tradeDate: '2024-01-15',
      units: 100,
      pricePerUnit: 10,
    };

    it('saves and returns the new transaction with relations', async () => {
      const saved = makeTxn({ id: 'new-txn' });
      txnRepo.save.mockResolvedValue(saved);
      txnRepo.findOneOrFail.mockResolvedValue(saved);

      const result = await service.create('port-1', baseDto as any);

      expect(txnRepo.save).toHaveBeenCalledTimes(1);
      expect(portfolios.recalculateFromTransactions).toHaveBeenCalledWith('port-1');
      expect(result).toEqual(saved);
    });

    it('throws BadRequestException when units <= 0 for BUY', async () => {
      await expect(
        service.create('port-1', { ...baseDto, units: 0 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when units <= 0 for SELL', async () => {
      await expect(
        service.create('port-1', { ...baseDto, type: TransactionType.SELL, units: -5 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when units === 0 for FEE_CONSOLIDATION', async () => {
      await expect(
        service.create('port-1', {
          ...baseDto,
          type: TransactionType.FEE_CONSOLIDATION,
          units: 0,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts negative units for FEE_CONSOLIDATION', async () => {
      const saved = makeTxn({ type: TransactionType.FEE_CONSOLIDATION, units: -5 });
      txnRepo.save.mockResolvedValue(saved);
      txnRepo.findOneOrFail.mockResolvedValue(saved);
      await expect(
        service.create('port-1', {
          ...baseDto,
          type: TransactionType.FEE_CONSOLIDATION,
          units: -5,
        } as any),
      ).resolves.toEqual(saved);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('applies changes and saves', async () => {
      const existing = makeTxn();
      txnRepo.findOne.mockResolvedValue(existing);
      txnRepo.save.mockResolvedValue(existing);
      txnRepo.findOneOrFail.mockResolvedValue(existing);

      const result = await service.update('port-1', 'txn-1', { notes: 'Updated' });
      expect(existing.notes).toBe('Updated');
      expect(txnRepo.save).toHaveBeenCalledTimes(1);
      expect(portfolios.recalculateFromTransactions).toHaveBeenCalledWith('port-1');
      expect(result).toEqual(existing);
    });

    it('throws NotFoundException for unknown transaction', async () => {
      txnRepo.findOne.mockResolvedValue(null);
      await expect(service.update('port-1', 'missing', {})).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when updating units to 0 on a BUY', async () => {
      txnRepo.findOne.mockResolvedValue(makeTxn());
      await expect(
        service.update('port-1', 'txn-1', { units: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when FEE_CONSOLIDATION units become 0', async () => {
      const existing = makeTxn({ type: TransactionType.FEE_CONSOLIDATION, units: -5 });
      txnRepo.findOne.mockResolvedValue(existing);
      await expect(
        service.update('port-1', 'txn-1', { units: 0 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the transaction and recalculates positions', async () => {
      const txn = makeTxn();
      txnRepo.findOne.mockResolvedValue(txn);
      txnRepo.remove.mockResolvedValue(txn);

      await expect(service.remove('port-1', 'txn-1')).resolves.toBeUndefined();
      expect(txnRepo.remove).toHaveBeenCalledWith(txn);
      expect(portfolios.recalculateFromTransactions).toHaveBeenCalledWith('port-1');
    });

    it('throws NotFoundException for unknown transaction', async () => {
      txnRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('port-1', 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── clearAll ────────────────────────────────────────────────────────────────

  describe('clearAll', () => {
    it('deletes all transactions and returns count', async () => {
      txnRepo.delete.mockResolvedValue({ affected: 5 });
      const result = await service.clearAll('port-1');
      expect(result).toEqual({ deleted: 5 });
      expect(portfolios.recalculateFromTransactions).toHaveBeenCalledWith('port-1');
    });

    it('returns 0 when affected is undefined', async () => {
      txnRepo.delete.mockResolvedValue({ affected: undefined });
      const result = await service.clearAll('port-1');
      expect(result).toEqual({ deleted: 0 });
    });
  });

  // ── applyTemplateBuy ────────────────────────────────────────────────────────

  describe('applyTemplateBuy', () => {
    const dto = {
      templateId: 'tmpl-1',
      totalAmount: 1000,
      tradeDate: '2024-06-01',
    };

    it('throws NotFoundException when template does not exist', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      await expect(service.applyTemplateBuy('port-1', dto as any)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when template has no items', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 'tmpl-1', code: 'T1', items: [] });
      await expect(service.applyTemplateBuy('port-1', dto as any)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no NAV is found for an instrument', async () => {
      templateRepo.findOne.mockResolvedValue({
        id: 'tmpl-1',
        code: 'T1',
        items: [
          { instrumentId: 'inst-1', weight: '1', instrument: { name: 'Fund A' } },
        ],
      });
      navPrices.navOnDate.mockResolvedValue(null);
      await expect(service.applyTemplateBuy('port-1', dto as any)).rejects.toThrow(BadRequestException);
    });

    it('creates transactions and returns a summary when all NAVs are available', async () => {
      const createdTxns = [makeTxn({ id: 'txn-new-0', units: 50, pricePerUnit: 20 })];
      templateRepo.findOne.mockResolvedValue({
        id: 'tmpl-1',
        code: 'T1',
        items: [
          { instrumentId: 'inst-1', weight: '1', instrument: { name: 'Fund A' } },
        ],
      });
      // nav is typed as number on the NavPrice entity
      navPrices.navOnDate.mockResolvedValue({ nav: 20, date: '2024-06-01' } as any);

      txnRepo.manager.transaction.mockImplementation(async (cb: any) =>
        cb({
          save: jest.fn(async (_cls: any, vals: any[]) =>
            vals.map((v, i) => ({ ...v, id: `txn-new-${i}` }))
          ),
          create: jest.fn((_cls: any, vals: any) => vals),
          find: jest.fn(async () => createdTxns),
        })
      );

      const result = await service.applyTemplateBuy('port-1', dto as any);

      expect(result.templateId).toBe('tmpl-1');
      expect(result.templateCode).toBe('T1');
      expect(result.created).toBe(1);
      expect(result.transactions).toEqual(createdTxns);
      expect(portfolios.recalculateFromTransactions).toHaveBeenCalledWith('port-1');
    });
  });
});
