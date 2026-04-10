import { Injectable } from '@nestjs/common';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { NavPricesService } from '../nav-prices/nav-prices.service';

export interface PositionBreakdown {
  positionId: string;
  instrumentId: string;
  instrumentName: string;
  isin: string;
  assetClass: string;
  units: number;
  nav: number | null;
  value: number | null;
  cost: number | null;
  pnl: number | null;
  weightPct: number | null;
}

export interface ValuationResult {
  portfolioId: string;
  date: string;
  totalValue: number;
  totalCost: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
  positions: PositionBreakdown[];
  allocationByAssetClass: Record<string, number>;
  allocationByInstrument: Record<string, number>;
}

@Injectable()
export class ValuationService {
  constructor(
    private readonly portfolios: PortfoliosService,
    private readonly navPrices: NavPricesService,
  ) {}

  async compute(portfolioId: string, date?: string): Promise<ValuationResult> {
    const today = date ?? new Date().toISOString().slice(0, 10);
    const positions = await this.portfolios.getPositions(portfolioId);

    // Fetch each instrument's latest NAV on or before the target date
    const navMap = new Map<string, number>();
    await Promise.all(
      positions.map(async (pos) => {
        const nav = await this.navPrices.navOnDate(pos.instrumentId, today);
        if (nav) navMap.set(pos.instrumentId, Number(nav.nav));
      }),
    );

    let totalValue = 0;
    let totalCost = 0;

    const posBreakdowns: PositionBreakdown[] = positions.map((pos) => {
      const units   = Number(pos.units);
      const nav     = navMap.get(pos.instrumentId) ?? null;
      const value   = nav !== null ? units * nav : null;
      const cost    = pos.costBasisPerUnit !== null ? units * Number(pos.costBasisPerUnit) : null;
      const pnl     = value !== null && cost !== null ? value - cost : null;

      if (value !== null) totalValue += value;
      if (cost !== null)  totalCost  += cost;

      return {
        positionId:     pos.id,
        instrumentId:   pos.instrumentId,
        instrumentName: pos.instrument.name,
        isin:           pos.instrument.isin,
        assetClass:     pos.instrument.assetClass,
        units,
        nav,
        value,
        cost,
        pnl,
        weightPct: null,
      };
    });

    // Compute weights now that totalValue is known
    for (const p of posBreakdowns) {
      p.weightPct =
        totalValue > 0 && p.value !== null
          ? round2(p.value / totalValue * 100)
          : null;
    }

    // Allocation by asset class
    const byClass: Record<string, number> = {};
    for (const p of posBreakdowns) {
      if (p.value !== null && totalValue > 0) {
        const key = p.assetClass;
        byClass[key] = round2((byClass[key] ?? 0) + p.value / totalValue * 100);
      }
    }

    // Allocation by instrument
    const byInstrument: Record<string, number> = {};
    for (const p of posBreakdowns) {
      if (p.weightPct !== null) byInstrument[p.instrumentId] = p.weightPct;
    }

    const unrealisedPnl    = totalValue - totalCost;
    const unrealisedPnlPct = totalCost > 0 ? round2(unrealisedPnl / totalCost * 100) : 0;

    return {
      portfolioId,
      date:           today,
      totalValue:     round2(totalValue),
      totalCost:      round2(totalCost),
      unrealisedPnl:  round2(unrealisedPnl),
      unrealisedPnlPct,
      positions:      posBreakdowns,
      allocationByAssetClass:  byClass,
      allocationByInstrument:  byInstrument,
    };
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
