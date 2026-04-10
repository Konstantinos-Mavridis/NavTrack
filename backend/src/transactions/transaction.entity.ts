import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Portfolio } from '../portfolios/portfolio.entity';
import { Instrument } from '../instruments/instrument.entity';

export enum TransactionType {
  BUY               = 'BUY',
  SELL              = 'SELL',
  SWITCH            = 'SWITCH',
  DIVIDEND_REINVEST = 'DIVIDEND_REINVEST',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Portfolio, (p) => p.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio: Portfolio;

  @Column({ name: 'portfolio_id' })
  portfolioId: string;

  @ManyToOne(() => Instrument, (i) => i.transactions, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instrument_id' })
  instrument: Instrument;

  @Column({ name: 'instrument_id' })
  instrumentId: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'date', name: 'trade_date' })
  tradeDate: string;

  @Column({ type: 'date', name: 'settlement_date', nullable: true })
  settlementDate: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  units: number;

  @Column({ type: 'numeric', precision: 18, scale: 6, name: 'price_per_unit' })
  pricePerUnit: number;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 0 })
  fees: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
