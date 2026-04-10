import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { Portfolio } from './portfolio.entity';
import { Instrument } from '../instruments/instrument.entity';

@Entity('portfolio_positions')
@Unique(['portfolio', 'instrument'])
export class PortfolioPosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Portfolio, (p) => p.positions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio: Portfolio;

  @Column({ name: 'portfolio_id' })
  portfolioId: string;

  @ManyToOne(() => Instrument, (i) => i.positions, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instrument_id' })
  instrument: Instrument;

  @Column({ name: 'instrument_id' })
  instrumentId: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 0 })
  units: number;

  @Column({ name: 'cost_basis_per_unit', type: 'numeric', precision: 18, scale: 6, nullable: true })
  costBasisPerUnit: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
