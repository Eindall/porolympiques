import type { ScoringScale, SeasonStatus } from '@porolympiques/domain';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Une saison. Le barème est stocké avec elle : on peut l'ajuster sans ressaisir de résultat. */
@Entity('seasons')
@Check('seasons_status_check', `"status" IN ('upcoming', 'active', 'finished')`)
@Check('seasons_quotas_check', `"main_quota" >= 0 AND "side_quota" >= 0`)
@Check('seasons_dates_check', `"end_date" > "start_date"`)
// Une seule saison active à la fois.
@Index('seasons_single_active', ['status'], { unique: true, where: `"status" = 'active'` })
export class SeasonEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate!: Date;

  @Column({ name: 'scoring_scale', type: 'jsonb' })
  scoringScale!: ScoringScale;

  @Column({ name: 'main_quota', type: 'smallint', default: 3 })
  mainQuota!: number;

  @Column({ name: 'side_quota', type: 'smallint', default: 2 })
  sideQuota!: number;

  @Column({ type: 'varchar', length: 16, default: 'upcoming' })
  status!: SeasonStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
