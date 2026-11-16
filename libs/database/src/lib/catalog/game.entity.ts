import type { GameSource, PriceTier } from '@porolympiques/domain';
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

/**
 * Un jeu, du catalogue (IGDB) ou saisi librement. Sert aussi de cache local du catalogue.
 * La tranche de prix reste vide tant que personne n'a suggéré de format pour ce jeu.
 */
@Entity('games')
@Check('games_source_check', `"source" IN ('igdb', 'custom')`)
@Check('games_price_tier_check', `"price_tier" IN ('free', 'lt10', '10to30', 'gt30')`)
// Un jeu du catalogue a toujours son identifiant externe, un jeu saisi librement n'en a jamais.
@Check('games_external_id_check', `("source" = 'custom') = ("external_id" IS NULL)`)
@Index('games_source_external_id', ['source', 'externalId'], { unique: true, where: `"external_id" IS NOT NULL` })
@Index('games_search_name', ['searchName'])
export class GameEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  source!: GameSource;

  @Column({ name: 'external_id', type: 'varchar', length: 64, nullable: true })
  externalId!: string | null;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  /** Nom normalisé (`normalizeName` : minuscules, sans accents), pour la recherche et les doublons. */
  @Column({ name: 'search_name', type: 'varchar', length: 200 })
  searchName!: string;

  @Column({ name: 'cover_url', type: 'varchar', length: 512, nullable: true })
  coverUrl!: string | null;

  @Column({ name: 'price_tier', type: 'varchar', length: 16, nullable: true })
  priceTier!: PriceTier | null;

  /** Joueur qui a enregistré le jeu : pour un jeu saisi librement, il gère son nom et son image avec l'admin. */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById!: string | null;

  @ManyToOne(() => PlayerEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy?: PlayerEntity;

  /** Image envoyée pour un jeu saisi librement : nom du fichier dans le dossier des envois. */
  @Column({ name: 'cover_file', type: 'varchar', length: 64, nullable: true })
  coverFile!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
