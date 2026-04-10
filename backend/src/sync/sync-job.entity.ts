import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Instrument } from '../instruments/instrument.entity';

export enum SyncStatus {
  PENDING  = 'PENDING',
  RUNNING  = 'RUNNING',
  SUCCESS  = 'SUCCESS',
  PARTIAL  = 'PARTIAL',
  FAILED   = 'FAILED',
}

@Entity('sync_jobs')
export class SyncJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Instrument, { nullable: true, onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'instrument_id' })
  instrument: Instrument | null;

  @Column({ name: 'instrument_id', nullable: true })
  instrumentId: string | null;

  @Column({ type: 'enum', enum: SyncStatus, default: SyncStatus.PENDING })
  status: SyncStatus;

  @Column({ type: 'text', default: 'YAHOO' })
  source: string;

  @Column({ type: 'date', name: 'from_date', nullable: true })
  fromDate: string | null;

  @Column({ type: 'date', name: 'to_date', nullable: true })
  toDate: string | null;

  @Column({ name: 'records_fetched', default: 0 })
  recordsFetched: number;

  @Column({ name: 'records_upserted', default: 0 })
  recordsUpserted: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'triggered_by', default: 'API' })
  triggeredBy: string;
}
