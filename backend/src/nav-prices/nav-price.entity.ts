import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Instrument } from '../instruments/instrument.entity';

export enum NavSource {
  MANUAL   = 'MANUAL',
  FT       = 'FT',
  EUROBANK = 'EUROBANK',
  YAHOO    = 'YAHOO',
  OTHER    = 'OTHER',
}

@Entity('nav_prices')
@Index(['instrument', 'date'])
export class NavPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Instrument, (i) => i.navPrices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instrument_id' })
  instrument: Instrument;

  @Column({ name: 'instrument_id' })
  instrumentId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  nav: number;

  @Column({ type: 'enum', enum: NavSource, default: NavSource.MANUAL })
  source: NavSource;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
