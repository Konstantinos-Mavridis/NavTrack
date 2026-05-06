import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { NavPrice } from '../nav-prices/nav-price.entity';
import { PortfolioPosition } from '../portfolios/portfolio-position.entity';
import { Transaction } from '../transactions/transaction.entity';

export enum AssetClass {
  EQUITY          = 'EQUITY',
  BOND            = 'BOND',
  HIGH_YIELD      = 'HIGH_YIELD',
  FUND_OF_FUNDS   = 'FUND_OF_FUNDS',
  ABSOLUTE_RETURN = 'ABSOLUTE_RETURN',
  CRYPTO          = 'CRYPTO',
}

@Entity('instruments')
export class Instrument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  /**
   * 12-character ISIN code. Null for crypto instruments, which are identified
   * by `ticker` instead (e.g. "BTC-USD").
   */
  @Column({ type: 'char', length: 12, unique: true, nullable: true })
  isin: string | null;

  /**
   * Direct Yahoo Finance ticker symbol. Required when `isin` is null (crypto).
   * Can also be set on ISIN-based instruments to skip the Yahoo ticker-resolution
   * step in the worker.
   * Examples: "BTC-USD", "ETH-USD", "SOL-USD"
   */
  @Column({ type: 'text', unique: true, nullable: true })
  ticker: string | null;

  @Column({ type: 'char', length: 3, default: 'EUR' })
  currency: string;

  @Column({ type: 'enum', enum: AssetClass, name: 'asset_class' })
  assetClass: AssetClass;

  @Column({ type: 'smallint', name: 'risk_level' })
  riskLevel: number;

  @Column({ type: 'text', array: true, name: 'data_sources', default: '{}' })
  dataSources: string[];

  @Column({ type: 'jsonb', name: 'external_ids', default: {} })
  externalIds: Record<string, string>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => NavPrice, (n) => n.instrument)
  navPrices: NavPrice[];

  @OneToMany(() => PortfolioPosition, (p) => p.instrument)
  positions: PortfolioPosition[];

  @OneToMany(() => Transaction, (t) => t.instrument)
  transactions: Transaction[];
}
