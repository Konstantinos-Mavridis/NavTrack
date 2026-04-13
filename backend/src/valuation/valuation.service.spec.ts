/**
 * Unit tests for ValuationService
 *
 * All dependencies (PortfoliosService, NavPricesService) are replaced with
 * Jest mocks so no database is required.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ValuationService } from './valuation.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { NavPricesService } from '../nav-prices/nav-prices.service';
import { PortfolioPosition } from '../portfolios/portfolio-position.entity';

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a minimal PortfolioPosition for test purposes.
 * ORM-managed fields (portfolio, portfolioId, notes, createdAt, updatedAt)
 * are irrelevant to ValuationService logic, so we cast via `any`.
 */
function makePosition(overrides: Partial<{
  id: string;
  instrumentId: string;
  units: number;
  costBasisPerUnit: number | null;
  instrument: { name: string; isin: string; assetClass: string };
}> = {}): PortfolioPosition {
  return {
    id: overrides.id ?? 'pos-1',
    instrumentId: overrides.instrumentId ?? 'inst-1',
    units: overrides.units ?? 100,
    costBasisPerUnit: overrides.costBasisPerUnit !== undefined ? overrides.costBasisPerUnit : 10,
    instrument: overrides.instrument ?? {
      name: 'Test Fund',
      isin: 'IE0001234567',
      assetClass: 'EQUITY',
    },
  } as any as PortfolioPosition;
}

function makeNavPrice(nav: number, date: string = '2024-01-31') {
  return { nav, date } as any;
}

// ── test suite ───────────────────────────────────────────────────────────────

describe('ValuationService', () => {
  let service: ValuationService;
  let portfolios: jest.Mocked<Pick<PortfoliosService, 'getPositions'>>;
  let navPrices: jest.Mocked<Pick<NavPricesService, 'latestForManyInstruments' | 'navOnDate'>>;

  beforeEach(async () => {
    portfolios = {
      getPositions: jest.fn(),
    };
    navPrices = {
      latestForManyInstruments: jest.fn(),
      navOnDate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValuationService,
        { provide: PortfoliosService, useValue: portfolios },
        { provide: NavPricesService, useValue: navPrices },
      ],
    }).compile();

    service = module.get(ValuationService);
  });

  // ── basic P&L maths ────────────────────────────────────────────────────────

  it('computes value, cost and unrealised P&L for a single position', async () => {
    // 100 units @ NAV 12.50, cost basis 10.00/unit
    // value = 1 250, cost = 1 000, P&L = 250 (25 %)
    portfolios.getPositions.mockResolvedValue([makePosition()]);
    navPrices.latestForManyInstruments.mockResolvedValue(
      new Map([['inst-1', makeNavPrice(12.5)]]),
    );
    navPrices.navOnDate.mockResolvedValue(makeNavPrice(12.5));

    const result = await service.compute('portfolio-1', '2024-01-31');

    expect(result.totalValue).toBe(1250);
    expect(result.totalCost).toBe(1000);
    expect(result.unrealisedPnl).toBe(250);
    expect(result.unrealisedPnlPct).toBe(25);
  });

  it('rounds monetary results to 2 decimal places', async () => {
    // 3 units @ NAV 1/3 → value = 1.00 exactly after rounding
    portfolios.getPositions.mockResolvedValue([
      makePosition({ units: 3, costBasisPerUnit: 0.1 }),
    ]);
    navPrices.latestForManyInstruments.mockResolvedValue(
      new Map([['inst-1', makeNavPrice(1 / 3)]]),
    );
    navPrices.navOnDate.mockResolvedValue(makeNavPrice(1 / 3));

    const result = await service.compute('portfolio-1', '2024-01-31');

    // Assert the value is a number with at most 2 decimal digits
    expect(result.totalValue).toBe(Math.round(1 * 100) / 100);
  });

  it('returns null P&L when cost basis is missing', async () => {
    portfolios.getPositions.mockResolvedValue([
      makePosition({ costBasisPerUnit: null }),
    ]);
    navPrices.latestForManyInstruments.mockResolvedValue(
      new Map([['inst-1', makeNavPrice(15)]]),
    );
    navPrices.navOnDate.mockResolvedValue(makeNavPrice(15));

    const result = await service.compute('portfolio-1', '2024-01-31');

    expect(result.positions[0].pnl).toBeNull();
    expect(result.positions[0].cost).toBeNull();
    // totalCost should be zero when no position has a cost basis
    expect(result.totalCost).toBe(0);
  });

  it('returns null value and weight when NAV is missing', async () => {
    portfolios.getPositions.mockResolvedValue([makePosition()]);
    navPrices.latestForManyInstruments.mockResolvedValue(new Map());
    navPrices.navOnDate.mockResolvedValue(null);

    const result = await service.compute('portfolio-1', '2024-01-31');

    expect(result.positions[0].value).toBeNull();
    expect(result.positions[0].weightPct).toBeNull();
    expect(result.totalValue).toBe(0);
  });

  // ── multi-position allocation ──────────────────────────────────────────────

  it('computes allocation percentages across two positions', async () => {
    // pos-1: 100 units @ 10 = 1 000 (50%)
    // pos-2: 200 units @  5 = 1 000 (50%)
    portfolios.getPositions.mockResolvedValue([
      makePosition({ id: 'p1', instrumentId: 'inst-1', units: 100, costBasisPerUnit: 10 }),
      makePosition({
        id: 'p2', instrumentId: 'inst-2', units: 200, costBasisPerUnit: 5,
        instrument: { name: 'Bond Fund', isin: 'IE0009999999', assetClass: 'BOND' },
      }),
    ]);
    navPrices.latestForManyInstruments.mockResolvedValue(
      new Map([
        ['inst-1', makeNavPrice(10)],
        ['inst-2', makeNavPrice(5)],
      ]),
    );
    navPrices.navOnDate
      .mockResolvedValueOnce(makeNavPrice(10))
      .mockResolvedValueOnce(makeNavPrice(5));

    const result = await service.compute('portfolio-1', '2024-01-31');

    expect(result.totalValue).toBe(2000);
    expect(result.positions[0].weightPct).toBe(50);
    expect(result.positions[1].weightPct).toBe(50);
    expect(result.allocationByAssetClass['EQUITY']).toBe(50);
    expect(result.allocationByAssetClass['BOND']).toBe(50);
    expect(result.allocationByInstrument['inst-1']).toBe(50);
    expect(result.allocationByInstrument['inst-2']).toBe(50);
  });

  // ── latestNavDate detection ────────────────────────────────────────────────

  it('sets latestNavDate to the most recent NAV date across instruments', async () => {
    portfolios.getPositions.mockResolvedValue([
      makePosition({ id: 'p1', instrumentId: 'inst-1' }),
      makePosition({
        id: 'p2', instrumentId: 'inst-2',
        instrument: { name: 'Bond Fund', isin: 'IE0009999999', assetClass: 'BOND' },
      }),
    ]);
    navPrices.latestForManyInstruments.mockResolvedValue(
      new Map([
        ['inst-1', makeNavPrice(10, '2024-01-20')],
        ['inst-2', makeNavPrice(5,  '2024-01-31')],
      ]),
    );
    navPrices.navOnDate
      .mockResolvedValueOnce(makeNavPrice(10, '2024-01-20'))
      .mockResolvedValueOnce(makeNavPrice(5,  '2024-01-31'));

    const result = await service.compute('portfolio-1');

    expect(result.latestNavDate).toBe('2024-01-31');
  });

  // ── empty portfolio ────────────────────────────────────────────────────────

  it('returns zero totals and empty arrays for a portfolio with no positions', async () => {
    portfolios.getPositions.mockResolvedValue([]);
    navPrices.latestForManyInstruments.mockResolvedValue(new Map());

    const result = await service.compute('portfolio-empty', '2024-01-31');

    expect(result.totalValue).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.unrealisedPnl).toBe(0);
    expect(result.positions).toHaveLength(0);
    expect(result.latestNavDate).toBeNull();
  });

  // ── portfolioId and date are echoed back ───────────────────────────────────

  it('echoes portfolioId and date in the result', async () => {
    portfolios.getPositions.mockResolvedValue([]);
    navPrices.latestForManyInstruments.mockResolvedValue(new Map());

    const result = await service.compute('my-portfolio', '2024-06-15');

    expect(result.portfolioId).toBe('my-portfolio');
    expect(result.date).toBe('2024-06-15');
  });

  // ── unrealised P&L % is 0 when totalCost is 0 ────────────────────────────

  it('returns 0 pnlPct when there is no cost basis', async () => {
    portfolios.getPositions.mockResolvedValue([
      makePosition({ costBasisPerUnit: null }),
    ]);
    navPrices.latestForManyInstruments.mockResolvedValue(
      new Map([['inst-1', makeNavPrice(20)]]),
    );
    navPrices.navOnDate.mockResolvedValue(makeNavPrice(20));

    const result = await service.compute('p', '2024-01-31');

    expect(result.unrealisedPnlPct).toBe(0);
  });
});
