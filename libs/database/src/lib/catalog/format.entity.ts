import type { FormatStatus, PlayMode, TeamMode } from '@porolympiques/domain';
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
import { GameEntity } from './game.entity';

/** Un format d'un jeu : l'unité upvotée dans la boîte à idées et choisie pour un event. */
@Entity('formats')
@Check('formats_team_mode_check', `"team_mode" IN ('solo', 'team')`)
@Check('formats_play_mode_check', `"play_mode" IN ('async', 'live')`)
@Check('formats_status_check', `"status" IN ('proposed', 'selected')`)
@Index(['gameId'])
export class FormatEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'game_id', type: 'uuid' })
  gameId!: string;

  @ManyToOne(() => GameEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'game_id' })
  game?: GameEntity;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ name: 'team_mode', type: 'varchar', length: 16 })
  teamMode!: TeamMode;

  @Column({ name: 'play_mode', type: 'varchar', length: 16 })
  playMode!: PlayMode;

  @Column({ type: 'varchar', length: 16, default: 'proposed' })
  status!: FormatStatus;

  /** Vide pour un format créé par l'admin avec un side event, sans auteur identifié. */
  @Column({ name: 'suggested_by', type: 'uuid', nullable: true })
  suggestedById!: string | null;

  @ManyToOne(() => PlayerEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'suggested_by' })
  suggestedBy?: PlayerEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
