import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { AllocationTemplate } from './allocation-template.entity';
import { Instrument } from '../instruments/instrument.entity';

@Entity('allocation_template_items')
export class AllocationTemplateItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AllocationTemplate, (template) => template.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: AllocationTemplate;

  @Column({ name: 'template_id' })
  templateId: string;

  @ManyToOne(() => Instrument, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instrument_id' })
  instrument: Instrument;

  @Column({ name: 'instrument_id' })
  instrumentId: string;

  @Column({ type: 'numeric', precision: 9, scale: 4 })
  weight: number;
}
