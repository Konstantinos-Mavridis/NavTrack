import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Instrument } from './instrument.entity';
import { CreateInstrumentDto, UpdateInstrumentDto } from './instrument.dto';

export interface InstrumentExportRow {
  name: string;
  isin: string;
  currency: string;
  assetClass: string;
  riskLevel: number;
  dataSources: string[];
  externalIds: Record<string, string>;
}

export interface InstrumentImportResult {
  imported: number;
  skipped: number;
  skippedIsins: string[];
}

@Injectable()
export class InstrumentsService {
  constructor(
    @InjectRepository(Instrument)
    private readonly repo: Repository<Instrument>,
  ) {}

  findAll(): Promise<Instrument[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Instrument> {
    const inst = await this.repo.findOneBy({ id });
    if (!inst) throw new NotFoundException(`Instrument ${id} not found`);
    return inst;
  }

  async create(dto: CreateInstrumentDto): Promise<Instrument> {
    const existing = await this.repo.findOneBy({ isin: dto.isin });
    if (existing) throw new ConflictException(`ISIN ${dto.isin} already exists`);
    const inst = this.repo.create({
      name: dto.name,
      isin: dto.isin.toUpperCase(),
      currency: dto.currency ?? 'EUR',
      assetClass: dto.assetClass,
      riskLevel: dto.riskLevel,
      dataSources: dto.dataSources ?? [],
    });
    return this.repo.save(inst);
  }

  async update(id: string, dto: UpdateInstrumentDto): Promise<Instrument> {
    const inst = await this.findOne(id);
    Object.assign(inst, dto);
    return this.repo.save(inst);
  }

  async remove(id: string): Promise<void> {
    const inst = await this.findOne(id);
    await this.repo.remove(inst);
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  async exportJson(): Promise<InstrumentExportRow[]> {
    const all = await this.repo.find({ order: { name: 'ASC' } });
    return all.map((i) => ({
      name: i.name,
      isin: i.isin,
      currency: i.currency,
      assetClass: i.assetClass,
      riskLevel: i.riskLevel,
      dataSources: i.dataSources ?? [],
      externalIds: i.externalIds ?? {},
    }));
  }

  async exportCsv(): Promise<string> {
    const rows = await this.exportJson();
    const header = 'name,isin,currency,assetClass,riskLevel,dataSources,externalIds';
    const lines = rows.map((r) =>
      [
        csvEscape(r.name),
        csvEscape(r.isin),
        csvEscape(r.currency),
        csvEscape(r.assetClass),
        String(r.riskLevel),
        csvEscape(r.dataSources.join('|')),
        csvEscape(JSON.stringify(r.externalIds)),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  async importJson(rows: InstrumentExportRow[]): Promise<InstrumentImportResult> {
    let imported = 0;
    const skippedIsins: string[] = [];

    for (const row of rows) {
      const isin = row.isin?.toUpperCase();
      if (!isin) continue;
      const existing = await this.repo.findOneBy({ isin });
      if (existing) { skippedIsins.push(isin); continue; }
      await this.repo.save(
        this.repo.create({
          name: row.name,
          isin,
          currency: row.currency ?? 'EUR',
          assetClass: row.assetClass as any,
          riskLevel: Number(row.riskLevel),
          dataSources: row.dataSources ?? [],
          externalIds: row.externalIds ?? {},
        }),
      );
      imported++;
    }

    return { imported, skipped: skippedIsins.length, skippedIsins };
  }

  async importCsv(csv: string): Promise<InstrumentImportResult> {
    const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return { imported: 0, skipped: 0, skippedIsins: [] };
    // skip header
    const rows: InstrumentExportRow[] = lines.slice(1).map((line) => {
      const [name, isin, currency, assetClass, riskLevel, dataSources, externalIds] = parseCsvLine(line);
      return {
        name,
        isin,
        currency,
        assetClass,
        riskLevel: Number(riskLevel),
        dataSources: dataSources ? dataSources.split('|').filter(Boolean) : [],
        externalIds: externalIds ? tryParseJson(externalIds) : {},
      };
    });
    return this.importJson(rows);
  }
}

function csvEscape(value: string): string {
  if (/[,"\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function parseCsvLine(line: string): string[] {
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

function tryParseJson(value: string): Record<string, string> {
  try { return JSON.parse(value); } catch { return {}; }
}
