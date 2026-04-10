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
}

@Entity('instruments')
export class Instrument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'char', length: 12, unique: true })
  isin: string;

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
