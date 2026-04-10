import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Instrument } from './instrument.entity';
import { CreateInstrumentDto, UpdateInstrumentDto } from './instrument.dto';

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
}
