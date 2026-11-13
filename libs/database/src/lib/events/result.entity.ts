import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { PlayerEntity } from '../players/player.entity';
import { EventEntity } from './event.entity';

/**
 * La place finale d'un joueur dans un event. On stocke la place, jamais les points.
 * Place non unique (ex æquo), vide si le joueur n'est pas classé.
 */
@Entity('results')
@Unique('results_event_player', ['eventId', 'playerId'])
@Check('results_place_check', `"place" >= 1`)
@Index(['playerId'])
export class ResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @ManyToOne(() => EventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: EventEntity;

  @Column({ name: 'player_id', type: 'uuid' })
  playerId!: string;

  @ManyToOne(() => PlayerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player?: PlayerEntity;

  @Column({ type: 'smallint', nullable: true })
  place!: number | null;
}
