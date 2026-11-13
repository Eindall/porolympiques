import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { PlayerEntity } from '../players/player.entity';
import { FormatEntity } from './format.entity';

/** Un upvote d'un joueur pour un format. Supprimé à la clôture de l'event qui joue ce format. */
@Entity('votes')
@Index(['formatId'])
export class VoteEntity {
  @PrimaryColumn({ name: 'player_id', type: 'uuid' })
  playerId!: string;

  @PrimaryColumn({ name: 'format_id', type: 'uuid' })
  formatId!: string;

  @ManyToOne(() => PlayerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player?: PlayerEntity;

  @ManyToOne(() => FormatEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'format_id' })
  format?: FormatEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
