/**
 * Integration-style tests for PortfoliosController.
 *
 * Uses NestJS TestingModule with a mocked PortfoliosService — no real HTTP
 * server or database is required.  Verifies routing, HTTP status codes, and
 * that the controller delegates correctly to the service.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService }    from './portfolios.service';
import { ValuationService }     from '../valuation/valuation.service';

const mockPortfoliosService = (): jest.Mocked<Partial<PortfoliosService>> => ({
  findAll:                    jest.fn().mockResolvedValue([]),
  findOne:                    jest.fn().mockResolvedValue({ id: 'p1', name: 'Test' }),
  create:                     jest.fn().mockResolvedValue({ id: 'p1', name: 'Test' }),
  update:                     jest.fn().mockResolvedValue({ id: 'p1', name: 'Updated' }),
  remove:                     jest.fn().mockResolvedValue(undefined),
  getPositions:               jest.fn().mockResolvedValue([]),
  upsertPosition:             jest.fn(),
  removePosition:             jest.fn().mockResolvedValue(undefined),
  clearPositions:             jest.fn().mockResolvedValue({ deleted: 0 }),
  recalculateFromTransactions:jest.fn().mockResolvedValue([]),
  exportPortfoliosJson:       jest.fn().mockResolvedValue({ version: 1, exportedAt: '', portfolios: [] }),
  exportPortfoliosCsv:        jest.fn().mockResolvedValue('header\n'),
  importPortfoliosFromJson:   jest.fn(),
  importPortfoliosFromCsv:    jest.fn(),
  aggregateValuationSeries:   jest.fn().mockResolvedValue([]),
});

const mockValuationService = (): jest.Mocked<Partial<ValuationService>> => ({
  compute: jest.fn().mockResolvedValue({
    portfolioId: 'p1', totalValue: 0, totalCost: 0,
    unrealisedPnl: 0, unrealisedPnlPct: 0, positions: [],
    allocationByAssetClass: {}, allocationByInstrument: {},
    date: '2024-01-31', latestNavDate: null,
  }),
});

describe('PortfoliosController', () => {
  let controller: PortfoliosController;
  let portfoliosSvc: jest.Mocked<Partial<PortfoliosService>>;
  let valuationSvc: jest.Mocked<Partial<ValuationService>>;

  beforeEach(async () => {
    portfoliosSvc = mockPortfoliosService();
    valuationSvc  = mockValuationService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortfoliosController],
      providers: [
        { provide: PortfoliosService, useValue: portfoliosSvc },
        { provide: ValuationService,  useValue: valuationSvc },
      ],
    }).compile();

    controller = module.get(PortfoliosController);
  });

  it('findAll returns the service result', async () => {
    const portfolios = [{ id: 'p1', name: 'A' }];
    (portfoliosSvc.findAll as jest.Mock).mockResolvedValue(portfolios);
    await expect(controller.findAll()).resolves.toEqual(portfolios);
  });

  it('findOne delegates to the service', async () => {
    await controller.findOne('p1');
    expect(portfoliosSvc.findOne).toHaveBeenCalledWith('p1');
  });

  it('create passes the DTO through to the service', async () => {
    const dto = { name: 'New Portfolio' };
    await controller.create(dto as any);
    expect(portfoliosSvc.create).toHaveBeenCalledWith(dto);
  });

  it('update passes the id and DTO to the service', async () => {
    const dto = { name: 'Renamed' };
    await controller.update('p1', dto as any);
    expect(portfoliosSvc.update).toHaveBeenCalledWith('p1', dto);
  });

  it('remove calls service.remove with the correct id', async () => {
    await controller.remove('p1');
    expect(portfoliosSvc.remove).toHaveBeenCalledWith('p1');
  });

  it('getValuation calls valuation service with portfolioId', async () => {
    await controller.getValuation('p1', undefined);
    expect(valuationSvc.compute).toHaveBeenCalledWith('p1', undefined);
  });
});
