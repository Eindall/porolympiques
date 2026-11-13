import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { PlayerEntity } from '../players/player.entity';
import { EventEntity } from './event.entity';
import { TeamEntity } from './team.entity';

/** L'inscription d'un joueur à un event, avec son équipe pour un event par équipe. */
@Entity('registrations')
@Unique('registrations_event_player', ['eventId', 'playerId'])
@Index(['playerId'])
export class RegistrationEntity {
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

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId!: string | null;

  @ManyToOne(() => TeamEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'team_id' })
  team?: TeamEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
