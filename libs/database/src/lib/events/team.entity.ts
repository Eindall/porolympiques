import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { EventEntity } from './event.entity';

/** Une équipe d'un event par équipe, composée à la main par l'admin. */
@Entity('teams')
@Unique('teams_event_name', ['eventId', 'name'])
export class TeamEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @ManyToOne(() => EventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: EventEntity;

  @Column({ type: 'varchar', length: 100 })
  name!: string;
}
