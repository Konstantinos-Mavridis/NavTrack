import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Portfolio } from './portfolio.entity';
import { PortfolioPosition } from './portfolio-position.entity';
import { CreatePortfolioDto, UpdatePortfolioDto, UpsertPositionDto } from './portfolio.dto';
import { Transaction, TransactionType } from '../transactions/transaction.entity';
import { Instrument } from '../instruments/instrument.entity';

@Injectable()
export class PortfoliosService {
  constructor(
    @InjectRepository(Portfolio)
    private readonly portfolioRepo: Repository<Portfolio>,
    @InjectRepository(PortfolioPosition)
    private readonly positionRepo: Repository<PortfolioPosition>,
    @InjectRepository(Instrument)
    private readonly instrumentRepo: Repository<Instrument>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Portfolios ─────────────────────────────────────────────────────────────

  findAll(): Promise<Portfolio[]> {
    return this.portfolioRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Portfolio> {
    const p = await this.portfolioRepo.findOneBy({ id });
    if (!p) throw new NotFoundException(`Portfolio ${id} not found`);
    return p;
  }

  create(dto: CreatePortfolioDto): Promise<Portfolio> {
    return this.portfolioRepo.save(this.portfolioRepo.create(dto));
  }

  async update(id: string, dto: UpdatePortfolioDto): Promise<Portfolio> {
    const p = await this.findOne(id);
    if (dto.name        !== undefined) p.name        = dto.name;
    if (dto.description !== undefined) p.description = dto.description;
    return this.portfolioRepo.save(p);
  }

  async remove(id: string): Promise<void> {
    await this.portfolioRepo.remove(await this.findOne(id));
  }

  /**
   * Aggregate portfolio performance across all portfolios for each day in range.
   * - totalValue is derived from TRANSACTION-ledger units (historical holdings)
   * - netInvested is cumulative net cash invested
   * - pnl / pnlPct show value relative to invested capital
   */
  async aggregateValuationSeries(
    days: number,
    toDate?: string,
  ): Promise<Array<{
    date: string;
    totalValue: number;
    netInvested: number;
    pnl: number;
    pnlPct: number;
  }>> {
    const endDate = toDate ?? new Date().toISOString().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new BadRequestException('to must be in YYYY-MM-DD format');
    }

    const safeDays = Math.min(Math.max(days, 2), 365);

    const rows: Array<{
      date: string | Date;
      total_value: string;
      net_invested: string;
      pnl: string;
      pnl_pct: string;
    }> = await this.dataSource.query(
      `
      WITH bounds AS (
        SELECT
          ($2::date - ($1::int - 1) * interval '1 day')::date AS start_day,
          $2::date AS end_day
      ),
      days AS (
        SELECT gs::date AS day
        FROM bounds b
        CROSS JOIN generate_series(
          b.start_day,
          b.end_day,
          interval '1 day'
        ) AS gs
      ),
      instruments AS (
        SELECT DISTINCT t.instrument_id
        FROM transactions t
      ),
      opening_units AS (
        SELECT
          t.instrument_id,
          SUM(
            CASE t.type
              WHEN 'BUY'               THEN  t.units
              WHEN 'DIVIDEND_REINVEST' THEN  t.units
              WHEN 'SELL'              THEN -t.units
              WHEN 'SWITCH'            THEN -t.units
              ELSE 0
            END
          )::numeric(24,6) AS units_before_range
        FROM transactions t
        CROSS JOIN bounds b
        WHERE t.trade_date < b.start_day
        GROUP BY t.instrument_id
      ),
      tx_by_day_instrument AS (
        SELECT
          t.trade_date::date AS day,
          t.instrument_id,
          SUM(
            CASE t.type
              WHEN 'BUY'               THEN  t.units
              WHEN 'DIVIDEND_REINVEST' THEN  t.units
              WHEN 'SELL'              THEN -t.units
              WHEN 'SWITCH'            THEN -t.units
              ELSE 0
            END
          )::numeric(24,6) AS unit_delta
        FROM transactions t
        CROSS JOIN bounds b
        WHERE t.trade_date >= b.start_day
          AND t.trade_date <= b.end_day
        GROUP BY t.trade_date::date, t.instrument_id
      ),
      opening_cash AS (
        SELECT
          COALESCE(SUM(
            CASE t.type
              WHEN 'BUY'               THEN  (t.units * t.price_per_unit + t.fees)
              WHEN 'DIVIDEND_REINVEST' THEN  (t.units * t.price_per_unit + t.fees)
              WHEN 'SELL'              THEN -(t.units * t.price_per_unit - t.fees)
              WHEN 'SWITCH'            THEN -(t.units * t.price_per_unit - t.fees)
              ELSE 0
            END
          ), 0)::numeric(24,6) AS cash_before_range
        FROM transactions t
        CROSS JOIN bounds b
        WHERE t.trade_date < b.start_day
      ),
      tx_cash_by_day AS (
        SELECT
          t.trade_date::date AS day,
          SUM(
            CASE t.type
              WHEN 'BUY'               THEN  (t.units * t.price_per_unit + t.fees)
              WHEN 'DIVIDEND_REINVEST' THEN  (t.units * t.price_per_unit + t.fees)
              WHEN 'SELL'              THEN -(t.units * t.price_per_unit - t.fees)
              WHEN 'SWITCH'            THEN -(t.units * t.price_per_unit - t.fees)
              ELSE 0
            END
          )::numeric(24,6) AS cash_delta
        FROM transactions t
        CROSS JOIN bounds b
        WHERE t.trade_date >= b.start_day
          AND t.trade_date <= b.end_day
        GROUP BY t.trade_date::date
      ),
      grid AS (
        SELECT d.day, i.instrument_id
        FROM days d
        CROSS JOIN instruments i
      ),
      units_by_day AS (
        SELECT
          g.day,
          g.instrument_id,
          COALESCE(ou.units_before_range, 0) +
          SUM(COALESCE(tx.unit_delta, 0)) OVER (
            PARTITION BY g.instrument_id
            ORDER BY g.day
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS units
        FROM grid g
        LEFT JOIN opening_units ou
          ON ou.instrument_id = g.instrument_id
        LEFT JOIN tx_by_day_instrument tx
          ON tx.day = g.day
         AND tx.instrument_id = g.instrument_id
      ),
      value_by_day AS (
        SELECT
          d.day AS date,
          COALESCE(SUM(u.units * latest.nav), 0)::numeric(18,2) AS total_value
        FROM days d
        LEFT JOIN units_by_day u
          ON u.day = d.day
        LEFT JOIN LATERAL (
          SELECT n.nav
          FROM nav_prices n
          WHERE n.instrument_id = u.instrument_id
            AND n.date <= d.day
          ORDER BY n.date DESC
          LIMIT 1
        ) latest
          ON u.instrument_id IS NOT NULL
        GROUP BY d.day
      ),
      invested_by_day AS (
        SELECT
          d.day AS date,
          (
            (SELECT cash_before_range FROM opening_cash) +
            SUM(COALESCE(c.cash_delta, 0)) OVER (
              ORDER BY d.day
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            )
          )::numeric(18,2) AS net_invested
        FROM days d
        LEFT JOIN tx_cash_by_day c
          ON c.day = d.day
      )
      SELECT
        v.date::date AS date,
        v.total_value,
        i.net_invested,
        (v.total_value - i.net_invested)::numeric(18,2) AS pnl,
        CASE
          WHEN i.net_invested > 0
            THEN ROUND(((v.total_value - i.net_invested) / i.net_invested) * 100, 2)
          ELSE 0
        END::numeric(18,2) AS pnl_pct
      FROM value_by_day v
      INNER JOIN invested_by_day i ON i.date = v.date
      ORDER BY v.date ASC
      `,
      [safeDays, endDate],
    );

    return rows.map((r) => ({
      date:
        typeof r.date === 'string'
          ? r.date.slice(0, 10)
          : r.date.toISOString().slice(0, 10),
      totalValue: Number(r.total_value),
      netInvested: Number(r.net_invested),
      pnl: Number(r.pnl),
      pnlPct: Number(r.pnl_pct),
    }));
  }

  // ── Positions ──────────────────────────────────────────────────────────────

  async exportPortfoliosJson(): Promise<{
    version: number;
    exportedAt: string;
    portfolios: Array<{
      name: string;
      description: string | null;
      transactions: Array<{
        type: TransactionType;
        tradeDate: string;
        settlementDate: string | null;
        units: number;
        pricePerUnit: number;
        fees: number;
        notes: string | null;
        instrumentIsin: string;
        instrumentName: string;
      }>;
    }>;
  }> {
    const portfolios = await this.portfolioRepo.find({
      order: { name: 'ASC' },
      relations: ['transactions', 'transactions.instrument'],
    });

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      portfolios: portfolios.map((p) => ({
        name: p.name,
        description: p.description ?? null,
        transactions: [...(p.transactions ?? [])]
          .sort((a, b) => {
            if (a.tradeDate === b.tradeDate) {
              return a.createdAt.getTime() - b.createdAt.getTime();
            }
            return a.tradeDate.localeCompare(b.tradeDate);
          })
          .map((t) => ({
            type: t.type,
            tradeDate: t.tradeDate,
            settlementDate: t.settlementDate ?? null,
            units: Number(t.units),
            pricePerUnit: Number(t.pricePerUnit),
            fees: Number(t.fees),
            notes: t.notes ?? null,
            instrumentIsin: t.instrument.isin.trim(),
            instrumentName: t.instrument.name,
          })),
      })),
    };
  }

  async exportPortfoliosCsv(): Promise<string> {
    const payload = await this.exportPortfoliosJson();

    const header = [
      'portfolio_name',
      'portfolio_description',
      'instrument_isin',
      'instrument_name',
      'type',
      'trade_date',
      'settlement_date',
      'units',
      'price_per_unit',
      'fees',
      'notes',
    ];
    const lines = [header.join(',')];

    for (const portfolio of payload.portfolios) {
      for (const tx of portfolio.transactions) {
        lines.push([
          csvEscape(portfolio.name),
          csvEscape(portfolio.description ?? ''),
          csvEscape(tx.instrumentIsin),
          csvEscape(tx.instrumentName),
          csvEscape(tx.type),
          csvEscape(tx.tradeDate),
          csvEscape(tx.settlementDate ?? ''),
          csvEscape(formatNum6(tx.units)),
          csvEscape(formatNum6(tx.pricePerUnit)),
          csvEscape(formatNum6(tx.fees)),
          csvEscape(tx.notes ?? ''),
        ].join(','));
      }
    }

    return lines.join('\n');
  }

  importPortfoliosFromJson(payload: any): Promise<ImportSummary> {
    const portfolios = Array.isArray(payload?.portfolios) ? payload.portfolios : null;
    if (!portfolios) {
      throw new BadRequestException('Invalid JSON payload: missing portfolios array');
    }
    return this.importPortfoliosData(portfolios);
  }

  importPortfoliosFromCsv(csv: string): Promise<ImportSummary> {
    if (typeof csv !== 'string') {
      throw new BadRequestException('CSV content must be a string');
    }

    if (!csv.trim()) {
      throw new BadRequestException('CSV content is empty');
    }

    const rows = parseCsv(csv);
    if (!rows.length) {
      throw new BadRequestException('CSV has no data rows');
    }

    const required = [
      'portfolio_name',
      'portfolio_description',
      'instrument_isin',
      'type',
      'trade_date',
      'units',
      'price_per_unit',
      'fees',
      'notes',
    ];
    const missing = required.filter((k) => !(k in rows[0]));
    if (missing.length) {
      throw new BadRequestException(`CSV missing columns: ${missing.join(', ')}`);
    }

    const grouped = new Map<string, any>();
    for (const row of rows) {
      const key = `${row.portfolio_name}||${row.portfolio_description ?? ''}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: row.portfolio_name,
          description: row.portfolio_description || null,
          transactions: [],
        });
      }

      grouped.get(key).transactions.push({
        instrumentIsin: row.instrument_isin,
        type: row.type,
        tradeDate: row.trade_date,
        settlementDate: row.settlement_date || null,
        units: row.units,
        pricePerUnit: row.price_per_unit,
        fees: row.fees,
        notes: row.notes || null,
      });
    }

    return this.importPortfoliosData(Array.from(grouped.values()));
  }

  private async importPortfoliosData(portfoliosInput: any[]): Promise<ImportSummary> {
    const cleaned = portfoliosInput
      .filter((p) => p && typeof p.name === 'string' && p.name.trim().length > 0)
      .map((p) => ({
        name: p.name.trim(),
        description: typeof p.description === 'string' ? p.description : null,
        transactions: Array.isArray(p.transactions) ? p.transactions : [],
      }));

    if (!cleaned.length) {
      throw new BadRequestException('No valid portfolios found in import payload');
    }

    const isins = Array.from(
      new Set(
        cleaned.flatMap((p) =>
          p.transactions.map((t: any) => String(t.instrumentIsin ?? '').trim()).filter(Boolean),
        ),
      ),
    );

    const instruments = isins.length
      ? await this.instrumentRepo.find({ where: { isin: In(isins) } })
      : [];
    const instrumentByIsin = new Map(instruments.map((i) => [i.isin.trim(), i]));

    const summary: ImportSummary = {
      portfoliosImported: 0,
      transactionsImported: 0,
      transactionsSkipped: 0,
      missingInstruments: [],
      skippedReasons: [],
    };

    const missingIsin = new Set<string>();

    await this.dataSource.transaction(async (em) => {
      for (const p of cleaned) {
        const createdPortfolio = await em.save(
          em.create(Portfolio, {
            name: p.name,
            description: p.description,
          }),
        );
        summary.portfoliosImported++;

        for (const tx of p.transactions) {
          const isin = String(tx.instrumentIsin ?? '').trim();
          const instrument = instrumentByIsin.get(isin);
          if (!instrument) {
            summary.transactionsSkipped++;
            missingIsin.add(isin);
            continue;
          }

          const typeStr = String(tx.type ?? '').toUpperCase();
          if (!Object.values(TransactionType).includes(typeStr as TransactionType)) {
            summary.transactionsSkipped++;
            summary.skippedReasons.push(`Invalid transaction type: ${typeStr}`);
            continue;
          }

          const units = toPositiveNumber(tx.units);
          const pricePerUnit = toPositiveNumber(tx.pricePerUnit);
          const fees = toNonNegativeNumber(tx.fees ?? 0);
          const tradeDate = String(tx.tradeDate ?? '');
          const settlementDate = tx.settlementDate ? String(tx.settlementDate) : null;

          if (!isIsoDate(tradeDate)) {
            summary.transactionsSkipped++;
            summary.skippedReasons.push(`Invalid trade date: ${tradeDate}`);
            continue;
          }
          if (settlementDate && !isIsoDate(settlementDate)) {
            summary.transactionsSkipped++;
            summary.skippedReasons.push(`Invalid settlement date: ${settlementDate}`);
            continue;
          }

          if (units <= 0 || pricePerUnit <= 0 || fees < 0) {
            summary.transactionsSkipped++;
            summary.skippedReasons.push(`Invalid numeric values for ISIN ${isin}`);
            continue;
          }

          await em.save(
            em.create(Transaction, {
              portfolioId: createdPortfolio.id,
              instrumentId: instrument.id,
              type: typeStr as TransactionType,
              tradeDate,
              settlementDate,
              units: round6(units),
              pricePerUnit: round6(pricePerUnit),
              fees: round6(fees),
              notes: typeof tx.notes === 'string' ? tx.notes : null,
            }),
          );

          summary.transactionsImported++;
        }
      }
    });

    summary.missingInstruments = Array.from(missingIsin).filter(Boolean).sort();
    summary.skippedReasons = Array.from(new Set(summary.skippedReasons)).slice(0, 20);

    return summary;
  }

  getPositions(portfolioId: string): Promise<PortfolioPosition[]> {
    return this.positionRepo.find({
      where: { portfolioId },
      relations: ['instrument'],
    });
  }

  async upsertPosition(portfolioId: string, dto: UpsertPositionDto): Promise<PortfolioPosition> {
    await this.findOne(portfolioId);
    let pos = await this.positionRepo.findOne({
      where: { portfolioId, instrumentId: dto.instrumentId },
    });
    if (!pos) {
      pos = this.positionRepo.create({ portfolioId, instrumentId: dto.instrumentId });
    }
    pos.units               = dto.units;
    pos.costBasisPerUnit    = dto.costBasisPerUnit ?? null;
    pos.notes               = dto.notes ?? null;
    return this.positionRepo.save(pos);
  }

  async removePosition(portfolioId: string, positionId: string): Promise<void> {
    const pos = await this.positionRepo.findOne({ where: { id: positionId, portfolioId } });
    if (!pos) throw new NotFoundException(`Position ${positionId} not found`);
    await this.positionRepo.remove(pos);
  }

  /**
   * Clear all positions for a portfolio (part of "clear demo data" flow).
   */
  async clearPositions(portfolioId: string): Promise<{ deleted: number }> {
    const result = await this.positionRepo.delete({ portfolioId });
    return { deleted: result.affected ?? 0 };
  }

  /**
   * Recalculate positions from the transaction ledger.
   * For each instrument with transactions in this portfolio:
   *   units          = sum of signed units (BUY/DIVIDEND_REINVEST +, SELL -)
   *   costBasisPerUnit = weighted average cost of BUY + DIVIDEND_REINVEST lots
   * Existing positions are replaced atomically.
   */
  async recalculateFromTransactions(portfolioId: string): Promise<PortfolioPosition[]> {
    await this.findOne(portfolioId);

    const rows: Array<{
      instrument_id: string;
      total_units: string;
      avg_cost: string | null;
    }> = await this.dataSource.query(
      `
      SELECT
        instrument_id,
        SUM(
          CASE type
            WHEN 'BUY'               THEN  units
            WHEN 'DIVIDEND_REINVEST' THEN  units
            WHEN 'SELL'              THEN -units
            WHEN 'SWITCH'            THEN -units
            ELSE 0
          END
        )                                                              AS total_units,
        SUM(
          CASE WHEN type IN ('BUY','DIVIDEND_REINVEST')
               THEN units * price_per_unit
               ELSE 0
          END
        ) /
        NULLIF(
          SUM(CASE WHEN type IN ('BUY','DIVIDEND_REINVEST') THEN units ELSE 0 END),
          0
        )                                                              AS avg_cost
      FROM transactions
      WHERE portfolio_id = $1
      GROUP BY instrument_id
      HAVING SUM(
               CASE type
                 WHEN 'BUY'               THEN  units
                 WHEN 'DIVIDEND_REINVEST' THEN  units
                 WHEN 'SELL'              THEN -units
                 WHEN 'SWITCH'            THEN -units
                 ELSE 0
               END
             ) > 0
      `,
      [portfolioId],
    );

    // Atomic replace inside a transaction
    await this.dataSource.transaction(async (em) => {
      await em.delete(PortfolioPosition, { portfolioId });
      for (const row of rows) {
        await em.save(
          em.create(PortfolioPosition, {
            portfolioId,
            instrumentId:    row.instrument_id,
            units:           parseFloat(row.total_units),
            costBasisPerUnit: row.avg_cost != null ? parseFloat(row.avg_cost) : null,
          }),
        );
      }
    });

    return this.getPositions(portfolioId);
  }
}

export interface ImportSummary {
  portfoliosImported: number;
  transactionsImported: number;
  transactionsSkipped: number;
  missingInstruments: string[];
  skippedReasons: string[];
}

function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatNum6(n: number): string {
  return (Math.round(n * 1_000_000) / 1_000_000).toString();
}

function parseCsv(csv: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];

    if (inQuotes) {
      if (ch === '"' && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(current);
      current = '';
    } else if (ch === '\n') {
      row.push(current);
      current = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      current += ch;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((v) => v.trim() !== '')) rows.push(row);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? '').trim();
    });
    return obj;
  });
}

function toPositiveNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toNonNegativeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : -1;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
