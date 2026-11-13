import type { SuggestionCategory, SuggestionStatus } from '@porolympiques/domain';
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
import { PlayerEntity } from '../players/player.entity';

/** Une amélioration proposée par un joueur. `planned` : dans la roadmap. */
@Entity('suggestions')
@Check('suggestions_category_check', `"category" IN ('format', 'site', 'bot', 'process')`)
@Check('suggestions_status_check', `"status" IN ('proposed', 'planned', 'done')`)
@Index(['authorId'])
export class SuggestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => PlayerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author?: PlayerEntity;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 16 })
  category!: SuggestionCategory;

  @Column({ type: 'varchar', length: 16, default: 'proposed' })
  status!: SuggestionStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
