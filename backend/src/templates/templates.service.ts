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
    // One row per template item: code, description, isin, weight
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

      // Resolve ISINs → instrument IDs
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

    // Group rows by code to rebuild template objects
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
