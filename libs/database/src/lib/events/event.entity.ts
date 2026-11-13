import type { EventStatus, EventType } from '@porolympiques/domain';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FormatEntity } from '../catalog/format.entity';
import { numericTransformer } from '../numeric.transformer';
import { PlayerEntity } from '../players/player.entity';
import { SeasonEntity } from '../seasons/season.entity';

/** Un main ou un side event d'une saison, joué sur un format (obligatoire, même pour un side). */
@Entity('events')
@Check('events_type_check', `"type" IN ('main', 'side')`)
@Check('events_status_check', `"status" IN ('announced', 'registration', 'in_progress', 'finished', 'cancelled')`)
@Check('events_coefficient_check', `"coefficient" > 0`)
@Index(['seasonId'])
@Index(['formatId'])
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'season_id', type: 'uuid' })
  seasonId!: string;

  @ManyToOne(() => SeasonEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'season_id' })
  season?: SeasonEntity;

  @Column({ name: 'format_id', type: 'uuid' })
  formatId!: string;

  @ManyToOne(() => FormatEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'format_id' })
  format?: FormatEntity;

  @Column({ type: 'varchar', length: 16 })
  type!: EventType;

  /** 1 pour un main, 0,5 pour un side par défaut. */
  @Column({ type: 'numeric', precision: 4, scale: 2, transformer: numericTransformer })
  coefficient!: number;

  @Column({ type: 'varchar', length: 16, default: 'announced' })
  status!: EventStatus;

  @Column({ type: 'text', default: '' })
  rules!: string;

  @Column({ name: 'announce_date', type: 'timestamptz' })
  announceDate!: Date;

  @Column({ name: 'registration_end', type: 'timestamptz' })
  registrationEnd!: Date;

  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate!: Date;

  /** Seulement pour un event joué en live. */
  @Column({ name: 'live_date', type: 'timestamptz', nullable: true })
  liveDate!: Date | null;

  @Column({ name: 'host_id', type: 'uuid', nullable: true })
  hostId!: string | null;

  @ManyToOne(() => PlayerEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'host_id' })
  host?: PlayerEntity;

  @Column({ name: 'challonge_url', type: 'varchar', length: 512, nullable: true })
  challongeUrl!: string | null;

  /** Validation d'un side par l'admin (sans effet sur un main). */
  @Column({ type: 'boolean', default: false })
  validated!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
