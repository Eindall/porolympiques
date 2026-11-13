import type { SuggestionVoteValue } from '@porolympiques/domain';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { PlayerEntity } from '../players/player.entity';
import { SuggestionEntity } from './suggestion.entity';

/** Le vote d'un joueur sur une suggestion : pour (+1) ou contre (-1), modifiable. */
@Entity('suggestion_votes')
@Check('suggestion_votes_value_check', `"value" IN (1, -1)`)
@Index(['playerId'])
export class SuggestionVoteEntity {
  @PrimaryColumn({ name: 'suggestion_id', type: 'uuid' })
  suggestionId!: string;

  @PrimaryColumn({ name: 'player_id', type: 'uuid' })
  playerId!: string;

  @ManyToOne(() => SuggestionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'suggestion_id' })
  suggestion?: SuggestionEntity;

  @ManyToOne(() => PlayerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player?: PlayerEntity;

  @Column({ type: 'smallint' })
  value!: SuggestionVoteValue;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
