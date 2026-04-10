import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Transaction, TransactionType } from './transaction.entity';
import { ApplyTemplateBuyDto, CreateTransactionDto } from './transaction.dto';
import { AllocationTemplate } from '../templates/allocation-template.entity';
import { NavPricesService } from '../nav-prices/nav-prices.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
    @InjectRepository(AllocationTemplate)
    private readonly templateRepo: Repository<AllocationTemplate>,
    private readonly navPrices: NavPricesService,
  ) {}

  findByPortfolio(portfolioId: string): Promise<Transaction[]> {
    return this.repo.find({
      where: { portfolioId },
      order: { tradeDate: 'DESC' },
      relations: ['instrument'],
    });
  }

  create(portfolioId: string, dto: CreateTransactionDto): Promise<Transaction> {
    return this.repo.save(
      this.repo.create({
        portfolioId,
        instrumentId: dto.instrumentId,
        type: dto.type,
        tradeDate: dto.tradeDate,
        settlementDate: dto.settlementDate ?? null,
        units: dto.units,
        pricePerUnit: dto.pricePerUnit,
        fees: dto.fees ?? 0,
        notes: dto.notes ?? null,
      }),
    );
  }

  async applyTemplateBuy(portfolioId: string, dto: ApplyTemplateBuyDto): Promise<{
    templateId: string;
    templateCode: string;
    totalAmount: number;
    tradeDate: string;
    created: number;
    transactions: Transaction[];
  }> {
    const template = await this.templateRepo.findOne({
      where: { id: dto.templateId },
      relations: ['items', 'items.instrument'],
    });

    if (!template) throw new NotFoundException(`Template ${dto.templateId} not found`);
    if (!template.items?.length) {
      throw new BadRequestException('Template has no funds');
    }

    const weightSum = template.items.reduce((acc, item) => acc + Number(item.weight), 0);
    if (weightSum <= 0) {
      throw new BadRequestException('Template weights are invalid');
    }

    let allocated = 0;
    const values: Array<Partial<Transaction>> = [];

    for (let i = 0; i < template.items.length; i++) {
      const item = template.items[i];
      const nav = await this.navPrices.navOnDate(item.instrumentId, dto.tradeDate);
      if (!nav) {
        throw new BadRequestException(
          `No NAV found for ${item.instrument.name} on or before ${dto.tradeDate}`,
        );
      }

      const price = Number(nav.nav);
      if (price <= 0) {
        throw new BadRequestException(`Invalid NAV for ${item.instrument.name} on ${nav.date}`);
      }

      const amount = i === template.items.length - 1
        ? round6(dto.totalAmount - allocated)
        : round6((dto.totalAmount * Number(item.weight)) / weightSum);

      allocated += amount;

      const units = round6(amount / price);
      if (units <= 0) {
        throw new BadRequestException(
          `Amount for ${item.instrument.name} is too small for its NAV (${price})`,
        );
      }

      values.push({
        portfolioId,
        instrumentId: item.instrumentId,
        type: TransactionType.BUY,
        tradeDate: dto.tradeDate,
        settlementDate: dto.settlementDate ?? null,
        units,
        pricePerUnit: round6(price),
        fees: 0,
        notes: dto.notes
          ? `${dto.notes} [template: ${template.code}]`
          : `Template buy: ${template.code}`,
      });
    }

    const transactions = await this.repo.manager.transaction(async (em) => {
      const created = await em.save(Transaction, em.create(Transaction, values));
      return em.find(Transaction, {
        where: { id: In(created.map((t) => t.id)) },
        order: { tradeDate: 'DESC', createdAt: 'DESC' },
        relations: ['instrument'],
      });
    });

    return {
      templateId: template.id,
      templateCode: template.code,
      totalAmount: round6(dto.totalAmount),
      tradeDate: dto.tradeDate,
      created: transactions.length,
      transactions,
    };
  }

  async update(
    portfolioId: string,
    txnId: string,
    dto: Partial<CreateTransactionDto>,
  ): Promise<Transaction> {
    const txn = await this.repo.findOne({ where: { id: txnId, portfolioId } });
    if (!txn) throw new NotFoundException(`Transaction ${txnId} not found`);

    if (dto.instrumentId !== undefined) txn.instrumentId = dto.instrumentId;
    if (dto.type !== undefined) txn.type = dto.type;
    if (dto.tradeDate !== undefined) txn.tradeDate = dto.tradeDate;
    if (dto.settlementDate !== undefined) txn.settlementDate = dto.settlementDate;
    if (dto.units !== undefined) txn.units = dto.units;
    if (dto.pricePerUnit !== undefined) txn.pricePerUnit = dto.pricePerUnit;
    if (dto.fees !== undefined) txn.fees = dto.fees;
    if (dto.notes !== undefined) txn.notes = dto.notes;

    return this.repo.save(txn);
  }

  async remove(portfolioId: string, txnId: string): Promise<void> {
    const txn = await this.repo.findOne({ where: { id: txnId, portfolioId } });
    if (!txn) throw new NotFoundException(`Transaction ${txnId} not found`);
    await this.repo.remove(txn);
  }

  /** Remove all transactions for a portfolio (clear demo data). */
  async clearAll(portfolioId: string): Promise<{ deleted: number }> {
    const result = await this.repo.delete({ portfolioId });
    return { deleted: result.affected ?? 0 };
  }
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
