import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PlayerEntity } from '../players/player.entity';

/**
 * Une session ouverte (un appareil connecté). Son `id` est le `jti` du JWT du cookie : le jeton ne vaut que
 * tant que cette ligne existe, n'est pas révoquée et n'a pas expiré.
 */
@Entity('auth_sessions')
@Index(['playerId'])
@Index(['expiresAt'])
export class AuthSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'player_id', type: 'uuid' })
  playerId!: string;

  @ManyToOne(() => PlayerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player?: PlayerEntity;

  @Column({ name: 'user_agent', type: 'varchar', length: 256, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz' })
  lastUsedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
