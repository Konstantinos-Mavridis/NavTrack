/**
 * Unit tests for TransactionsController
 *
 * TransactionsService is fully mocked so these tests verify only that
 * the controller delegates correctly and returns the service result.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { Transaction, TransactionType } from './transaction.entity';

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

function makeService() {
  return {
    findByPortfolio: jest.fn(),
    create: jest.fn(),
    applyTemplateBuy: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    clearAll: jest.fn(),
  };
}

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: service }],
    }).compile();

    controller = module.get(TransactionsController);
  });

  describe('findAll', () => {
    it('delegates to service.findByPortfolio and returns the result', async () => {
      const txns = [makeTxn()];
      service.findByPortfolio.mockResolvedValue(txns);
      await expect(controller.findAll('port-1')).resolves.toEqual(txns);
      expect(service.findByPortfolio).toHaveBeenCalledWith('port-1');
    });
  });

  describe('create', () => {
    it('delegates to service.create and returns the created transaction', async () => {
      const txn = makeTxn();
      service.create.mockResolvedValue(txn);
      const dto = { instrumentId: 'inst-1', type: TransactionType.BUY, tradeDate: '2024-01-15', units: 100, pricePerUnit: 10 };
      await expect(controller.create('port-1', dto as any)).resolves.toEqual(txn);
      expect(service.create).toHaveBeenCalledWith('port-1', dto);
    });
  });

  describe('update', () => {
    it('delegates to service.update and returns the updated transaction', async () => {
      const txn = makeTxn({ notes: 'Updated' });
      service.update.mockResolvedValue(txn);
      await expect(controller.update('port-1', 'txn-1', { notes: 'Updated' } as any)).resolves.toEqual(txn);
      expect(service.update).toHaveBeenCalledWith('port-1', 'txn-1', { notes: 'Updated' });
    });
  });

  describe('remove', () => {
    it('delegates to service.remove', async () => {
      service.remove.mockResolvedValue(undefined);
      await expect(controller.remove('port-1', 'txn-1')).resolves.toBeUndefined();
      expect(service.remove).toHaveBeenCalledWith('port-1', 'txn-1');
    });
  });

  describe('clearAll', () => {
    it('delegates to service.clearAll and returns the deletion summary', async () => {
      service.clearAll.mockResolvedValue({ deleted: 7 });
      await expect(controller.clearAll('port-1')).resolves.toEqual({ deleted: 7 });
      expect(service.clearAll).toHaveBeenCalledWith('port-1');
    });
  });
});
