import type { PlayerRole } from '@porolympiques/domain';
import { Check, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Un joueur : membre (actuel ou passé) du serveur Discord. Seuls l'identifiant, le pseudo et l'avatar sont gardés. */
@Entity('players')
@Check('players_role_check', `"role" IN ('admin', 'player')`)
export class PlayerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'discord_id', type: 'varchar', length: 32, unique: true })
  discordId!: string;

  @Column({ type: 'varchar', length: 100 })
  pseudo!: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 512 })
  avatarUrl!: string;

  @Column({ type: 'varchar', length: 16, default: 'player' })
  role!: PlayerRole;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
