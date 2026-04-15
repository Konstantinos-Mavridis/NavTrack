import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AllocationTemplate } from './allocation-template.entity';
import { AllocationTemplateItem } from './allocation-template-item.entity';
import { Instrument } from '../instruments/instrument.entity';
import { NavPricesService } from '../nav-prices/nav-prices.service';
import {
  AllocationTemplateItemDto,
  CreateAllocationTemplateDto,
  UpdateAllocationTemplateDto,
} from './template.dto';

export interface TemplateExportRow {
  code: string;
  description: string | null;
  items: Array<{ isin: string; weight: number }>;
}

export interface TemplateImportResult {
  imported: number;
  skipped: number;
  skippedCodes: string[];
  missingIsins: string[];
}

/** One point in the template NAV-weighted performance series. */
export interface TemplateNavSeriesPoint {
  date: string;
  /** Weighted-average NAV index (rebased to 100 on the first date). */
  indexValue: number;
  /** Raw weighted NAV sum (EUR-weighted by template weights). */
  weightedNav: number;
}

/** Earliest / latest dates for which ALL funds have NAV data. */
export interface TemplateNavAvailableRange {
  from: string;
  to: string;
}

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(AllocationTemplate)
    private readonly templateRepo: Repository<AllocationTemplate>,
    @InjectRepository(Instrument)
    private readonly instrumentRepo: Repository<Instrument>,
    private readonly dataSource: DataSource,
    private readonly navPrices: NavPricesService,
  ) {}

  list(): Promise<AllocationTemplate[]> {
    return this.templateRepo.find({
      relations: ['items', 'items.instrument'],
      order: { code: 'ASC' },
    });
  }

  async findOne(id: string): Promise<AllocationTemplate> {
    const template = await this.templateRepo.findOne({
      where: { id },
      relations: ['items', 'items.instrument'],
    });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    return template;
  }

  async create(dto: CreateAllocationTemplateDto): Promise<AllocationTemplate> {
    const code = dto.code.trim();
    if (!code) throw new BadRequestException('code is required');

    this.validateItems(dto.items);
    await this.ensureInstrumentsExist(dto.items);

    return this.dataSource.transaction(async (em) => {
      const template = await em.save(
        em.create(AllocationTemplate, {
          code,
          description: dto.description?.trim() || null,
        }),
      );

      for (const item of dto.items) {
        await em.save(
          em.create(AllocationTemplateItem, {
            templateId: template.id,
            instrumentId: item.instrumentId,
            weight: round4(item.weight),
          }),
        );
      }

      return em.findOne(AllocationTemplate, {
        where: { id: template.id },
        relations: ['items', 'items.instrument'],
      }) as Promise<AllocationTemplate>;
    });
  }

  async update(id: string, dto: UpdateAllocationTemplateDto): Promise<AllocationTemplate> {
    const existing = await this.findOne(id);

    if (dto.items) {
      this.validateItems(dto.items);
      await this.ensureInstrumentsExist(dto.items);
    }

    return this.dataSource.transaction(async (em) => {
      existing.code = dto.code !== undefined ? dto.code.trim() : existing.code;
      existing.description = dto.description !== undefined ? (dto.description.trim() || null) : existing.description;
      await em.save(existing);

      if (dto.items) {
        await em.delete(AllocationTemplateItem, { templateId: id });
        for (const item of dto.items) {
          await em.save(
            em.create(AllocationTemplateItem, {
              templateId: id,
              instrumentId: item.instrumentId,
              weight: round4(item.weight),
            }),
          );
        }
      }

      return em.findOne(AllocationTemplate, {
        where: { id },
        relations: ['items', 'items.instrument'],
      }) as Promise<AllocationTemplate>;
    });
  }

  async remove(id: string): Promise<void> {
    const template = await this.templateRepo.findOneBy({ id });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    await this.templateRepo.remove(template);
  }

  async navPreview(id: string, tradeDate?: string): Promise<{
    templateId: string;
    templateCode: string;
    tradeDate: string;
    items: Array<{
      instrumentId: string;
      instrumentName: string;
      weight: number;
      nav: number | null;
      navDate: string | null;
      exactDateMatch: boolean;
    }>;
  }> {
    const date = (tradeDate ?? '').trim();
    if (!isIsoDate(date)) {
      throw new BadRequestException('tradeDate is required in YYYY-MM-DD format');
    }

    const template = await this.findOne(id);
    const items = await Promise.all(
      template.items.map(async (item) => {
        const nav = await this.navPrices.navOnDate(item.instrumentId, date);
        const navDate = nav?.date ?? null;
        return {
          instrumentId: item.instrumentId,
          instrumentName: item.instrument.name,
          weight: Number(item.weight),
          nav: nav ? Number(nav.nav) : null,
          navDate,
          exactDateMatch: navDate === date,
        };
      }),
    );

    return {
      templateId: template.id,
      templateCode: template.code,
      tradeDate: date,
      items,
    };
  }

  /**
   * Returns the earliest and latest dates for which ALL funds in the template
   * simultaneously have NAV data — used to constrain the custom date picker.
   *
   * from = MAX of each fund's earliest NAV date  (all must have started)
   * to   = MIN of each fund's latest  NAV date   (all must still be active)
   */
  async navSeriesAvailableRange(id: string): Promise<TemplateNavAvailableRange> {
    const template = await this.findOne(id);
    if (!template.items.length) throw new BadRequestException('Template has no funds');

    const instrumentIds = template.items.map((i) => i.instrumentId);

    const rows: Array<{ instrument_id: string; min_date: string; max_date: string }> =
      await this.dataSource.query(
        `
        SELECT instrument_id,
               MIN(date)::text AS min_date,
               MAX(date)::text AS max_date
        FROM nav_prices
        WHERE instrument_id = ANY($1::uuid[])
        GROUP BY instrument_id
        `,
        [instrumentIds],
      );

    if (rows.length < instrumentIds.length) {
      // At least one fund has no NAV data at all.
      throw new BadRequestException('One or more funds have no NAV data');
    }

    // from = latest of the earliest dates (all funds must have started)
    const from = rows.reduce(
      (acc, r) => (r.min_date > acc ? r.min_date : acc),
      rows[0].min_date,
    );

    // to = earliest of the latest dates (all funds must still be active)
    const to = rows.reduce(
      (acc, r) => (r.max_date < acc ? r.max_date : acc),
      rows[0].max_date,
    );

    return { from: from.slice(0, 10), to: to.slice(0, 10) };
  }

  /**
   * Returns a daily weighted-NAV series for a template over a date window.
   *
   * Priority:
   *   1. If from + to are provided (YYYY-MM-DD): use that explicit window.
   *   2. If days > 0: fixed rolling window anchored to the latest NAV date.
   *   3. If days <= 0: ALL — window starts from the first date every fund has data.
   *
   * The right-hand boundary is always derived from the data itself
   * (MIN of each fund's MAX nav_prices date) — never from today's calendar
   * date. This prevents a flat phantom tail at the right edge of the chart
   * when NAV data is a few days behind.
   */
  async navSeries(
    id: string,
    days: number,
    from?: string,
    to?: string,
  ): Promise<TemplateNavSeriesPoint[]> {
    const template = await this.findOne(id);
    if (!template.items.length) return [];

    const instrumentIds = template.items.map((i) => i.instrumentId);

    // Derive the true data ceiling: the earliest of each fund's latest NAV
    // date, so every fund in the template is represented on the last point.
    // We use a raw query here so we don't need an extra round-trip after
    // fetching the full history below.
    const ceilingRows: Array<{ instrument_id: string; max_date: string }> =
      await this.dataSource.query(
        `
        SELECT instrument_id, MAX(date)::text AS max_date
        FROM nav_prices
        WHERE instrument_id = ANY($1::uuid[])
        GROUP BY instrument_id
        `,
        [instrumentIds],
      );

    // If any fund has no data at all, return an empty series.
    if (ceilingRows.length < instrumentIds.length) return [];

    // latestNavDate = MIN of each fund's max_date (all must have data up to this point).
    const latestNavDate = ceilingRows.reduce(
      (acc, r) => (r.max_date < acc ? r.max_date : acc),
      ceilingRows[0].max_date,
    ).slice(0, 10);

    // Fetch full NAV history for all instruments up to the true ceiling.
    const navRows: Array<{ instrument_id: string; date: string; nav: string }> =
      await this.dataSource.query(
        `
        SELECT instrument_id, date::text AS date, nav::text AS nav
        FROM nav_prices
        WHERE instrument_id = ANY($1::uuid[])
          AND date <= $2::date
        ORDER BY instrument_id, date ASC
        `,
        [instrumentIds, latestNavDate],
      );

    // Build map: instrumentId → sorted { date, nav }[]
    const navByInstrument = new Map<string, Array<{ date: string; nav: number }>>();
    for (const row of navRows) {
      if (!navByInstrument.has(row.instrument_id)) {
        navByInstrument.set(row.instrument_id, []);
      }
      navByInstrument.get(row.instrument_id)!.push({
        date: row.date.slice(0, 10),
        nav: Number(row.nav),
      });
    }

    // Determine [startDate, endDate] window.
    let startDate: string;
    let endDate: string;

    if (from && to && isIsoDate(from) && isIsoDate(to) && from <= to) {
      // Explicit custom range — honour caller bounds but cap at the data ceiling.
      startDate = from;
      endDate = to > latestNavDate ? latestNavDate : to;
    } else if (days <= 0) {
      // ALL: start from the first date ALL funds have data (MAX of each fund's earliest date).
      let latestFirstDate: string | null = null;
      for (const instrumentId of instrumentIds) {
        const history = navByInstrument.get(instrumentId);
        if (!history?.length) return [];
        const firstDate = history[0].date;
        if (latestFirstDate === null || firstDate > latestFirstDate) {
          latestFirstDate = firstDate;
        }
      }
      startDate = latestFirstDate!;
      endDate = latestNavDate;
    } else {
      // Fixed rolling window — anchor right edge to latest nav data, not today.
      const safeDays = Math.min(Math.max(Math.round(days), 2), 3650);
      startDate = subtractDays(latestNavDate, safeDays - 1);
      endDate = latestNavDate;
    }

    // Build weight map (percentage → fraction)
    const weights = new Map<string, number>();
    for (const item of template.items) {
      weights.set(item.instrumentId, Number(item.weight) / 100);
    }

    // Walk each day and compute the weighted NAV.
    const points: TemplateNavSeriesPoint[] = [];
    let baseWeightedNav: number | null = null;

    let cursor = startDate;
    while (cursor <= endDate) {
      let weightedNav = 0;
      let hasAllNavs = true;

      for (const instrumentId of instrumentIds) {
        const history = navByInstrument.get(instrumentId);
        const nav = findLatestNavOnOrBefore(history ?? [], cursor);
        if (nav === null) { hasAllNavs = false; break; }
        weightedNav += nav * (weights.get(instrumentId) ?? 0);
      }

      if (hasAllNavs) {
        if (baseWeightedNav === null) baseWeightedNav = weightedNav;
        const indexValue =
          baseWeightedNav > 0
            ? Math.round((weightedNav / baseWeightedNav) * 10_000) / 100
            : 100;

        points.push({
          date: cursor,
          indexValue,
          weightedNav: Math.round(weightedNav * 100) / 100,
        });
      }

      cursor = addOneDay(cursor);
    }

    return points;
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  async exportJson(): Promise<TemplateExportRow[]> {
    const all = await this.templateRepo.find({
      relations: ['items', 'items.instrument'],
      order: { code: 'ASC' },
    });
    return all.map((t) => ({
      code: t.code,
      description: t.description ?? null,
      items: t.items.map((i) => ({
        isin: i.instrument.isin,
        weight: Number(i.weight),
      })),
    }));
  }

  async exportCsv(): Promise<string> {
    const rows = await this.exportJson();
    const header = 'code,description,isin,weight';
    const lines: string[] = [];
    for (const t of rows) {
      for (const item of t.items) {
        lines.push(
          [
            csvEscape(t.code),
            csvEscape(t.description ?? ''),
            csvEscape(item.isin),
            String(item.weight),
          ].join(','),
        );
      }
    }
    return [header, ...lines].join('\n');
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  async importJson(rows: TemplateExportRow[]): Promise<TemplateImportResult> {
    let imported = 0;
    const skippedCodes: string[] = [];
    const missingIsins: string[] = [];

    for (const row of rows) {
      const code = row.code?.trim();
      if (!code) continue;

      const existing = await this.templateRepo.findOneBy({ code });
      if (existing) { skippedCodes.push(code); continue; }

      const items: AllocationTemplateItemDto[] = [];
      let skip = false;
      for (const item of row.items ?? []) {
        const inst = await this.instrumentRepo.findOneBy({ isin: item.isin?.toUpperCase() });
        if (!inst) { missingIsins.push(item.isin); skip = true; break; }
        items.push({ instrumentId: inst.id, weight: Number(item.weight) });
      }
      if (skip) continue;

      try {
        await this.create({ code, description: row.description ?? '', items });
        imported++;
      } catch {
        skippedCodes.push(code);
      }
    }

    return { imported, skipped: skippedCodes.length, skippedCodes, missingIsins };
  }

  async importCsv(csv: string): Promise<TemplateImportResult> {
    if (typeof csv !== 'string') {
      throw new BadRequestException('CSV payload must be a string');
    }
    if (csv.length > 1_000_000) {
      throw new BadRequestException('CSV payload is too large');
    }

    const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return { imported: 0, skipped: 0, skippedCodes: [], missingIsins: [] };

    const map = new Map<string, TemplateExportRow>();
    for (const line of lines.slice(1)) {
      const [code, description, isin, weight] = parseCsvLine(line);
      if (!code || !isin) continue;
      if (!map.has(code)) map.set(code, { code, description: description || null, items: [] });
      map.get(code)!.items.push({ isin, weight: Number(weight) });
    }

    return this.importJson([...map.values()]);
  }

  private validateItems(items: AllocationTemplateItemDto[]) {
    if (!items?.length) {
      throw new BadRequestException('Template must include at least one fund');
    }

    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.instrumentId)) {
        throw new BadRequestException('Each fund can appear only once in a template');
      }
      seen.add(item.instrumentId);
    }

    const sum = items.reduce((acc, i) => acc + Number(i.weight), 0);
    if (Math.abs(sum - 100) > 0.01) {
      throw new BadRequestException(`Weights must add up to 100 (got ${sum.toFixed(4)})`);
    }
  }

  private async ensureInstrumentsExist(items: AllocationTemplateItemDto[]) {
    const ids = Array.from(new Set(items.map((i) => i.instrumentId)));
    const found = await this.instrumentRepo.find({ where: { id: In(ids) } });
    if (found.length !== ids.length) {
      throw new BadRequestException('One or more selected funds are invalid');
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function csvEscape(value: string): string {
  if (/[,"\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function parseCsvLine(line: string): string[] {
  if (typeof line !== 'string') {
    throw new BadRequestException('Invalid CSV line');
  }
  if (line.length > 100_000) {
    throw new BadRequestException('CSV line is too long');
  }

  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current); current = ''; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
}

function findLatestNavOnOrBefore(
  history: Array<{ date: string; nav: number }>,
  date: string,
): number | null {
  if (!history.length) return null;
  let lo = 0;
  let hi = history.length - 1;
  let result: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (history[mid].date <= date) {
      result = history[mid].nav;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

function addOneDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function subtractDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
