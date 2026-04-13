/**
 * Unit tests for ValuationController.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ValuationController } from './valuation.controller';
import { ValuationService }    from './valuation.service';
import { PortfoliosService }   from '../portfolios/portfolios.service';

describe('ValuationController', () => {
  let controller: ValuationController;
  let valuationSvc: jest.Mocked<Pick<ValuationService, 'compute'>>;

  beforeEach(async () => {
    valuationSvc = {
      compute: jest.fn().mockResolvedValue({
        portfolioId: 'p1', totalValue: 1000, totalCost: 900,
        unrealisedPnl: 100, unrealisedPnlPct: 11.11,
        positions: [], allocationByAssetClass: {}, allocationByInstrument: {},
        date: '2024-01-31', latestNavDate: '2024-01-31',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ValuationController],
      providers: [
        { provide: ValuationService,  useValue: valuationSvc },
        { provide: PortfoliosService, useValue: { aggregateValuationSeries: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    controller = module.get(ValuationController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates to ValuationService.compute', async () => {
    const result = await controller.getPortfolioValuation('p1', undefined);
    expect(valuationSvc.compute).toHaveBeenCalledWith('p1', undefined);
    expect(result.totalValue).toBe(1000);
  });
});
