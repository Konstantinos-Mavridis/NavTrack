// portfolio.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { PortfolioPosition } from './portfolio-position.entity';
import { Transaction } from '../transactions/transaction.entity';

@Entity('portfolios')
export class Portfolio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => PortfolioPosition, (p) => p.portfolio, { cascade: true })
  positions: PortfolioPosition[];

  @OneToMany(() => Transaction, (t) => t.portfolio)
  transactions: Transaction[];
}
