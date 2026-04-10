import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NavPrice, NavSource } from './nav-price.entity';
import { NavPriceEntryDto } from './nav-price.dto';
import { InstrumentsService } from '../instruments/instruments.service';

@Injectable()
export class NavPricesService {
  constructor(
    @InjectRepository(NavPrice)
    private readonly repo: Repository<NavPrice>,
    private readonly instruments: InstrumentsService,
  ) {}

  async findByInstrument(instrumentId: string): Promise<NavPrice[]> {
    await this.instruments.findOne(instrumentId); // 404 guard
    return this.repo.find({
      where: { instrumentId },
      order: { date: 'ASC' },
    });
  }

  async latestForInstrument(instrumentId: string): Promise<NavPrice | null> {
    return this.repo.findOne({
      where: { instrumentId },
      order: { date: 'DESC' },
    });
  }

  async latestForManyInstruments(ids: string[]): Promise<Map<string, NavPrice>> {
    if (!ids.length) return new Map();
    // Use a DISTINCT ON query via raw SQL for efficiency
    const rows: NavPrice[] = await this.repo
      .createQueryBuilder('n')
      .where('n.instrument_id IN (:...ids)', { ids })
      .orderBy('n.instrument_id')
      .addOrderBy('n.date', 'DESC')
      .distinctOn(['n.instrument_id'])
      .getMany();
    const map = new Map<string, NavPrice>();
    rows.forEach((r) => map.set(r.instrumentId, r));
    return map;
  }

  async navOnDate(instrumentId: string, date: string): Promise<NavPrice | null> {
    // Find the most recent NAV on or before `date`
    return this.repo
      .createQueryBuilder('n')
      .where('n.instrument_id = :instrumentId', { instrumentId })
      .andWhere('n.date <= :date', { date })
      .orderBy('n.date', 'DESC')
      .getOne();
  }

  async bulkUpsert(instrumentId: string, entries: NavPriceEntryDto[]): Promise<{ upserted: number }> {
    await this.instruments.findOne(instrumentId);
    for (const e of entries) {
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(NavPrice)
        .values({
          instrumentId,
          date: e.date,
          nav: e.nav,
          source: e.source ?? NavSource.MANUAL,
        })
        .orUpdate(['nav', 'source'], ['instrument_id', 'date'])
        .execute();
    }
    return { upserted: entries.length };
  }
}
