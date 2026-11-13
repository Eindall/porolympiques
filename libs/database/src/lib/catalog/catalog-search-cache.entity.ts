import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Cache des recherches dans le catalogue externe (IGDB), par requête normalisée. Expire après quelques heures. */
@Entity('catalog_search_cache')
export class CatalogSearchCacheEntity {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  query!: string;

  @Column({ type: 'jsonb' })
  results!: unknown;

  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt!: Date;
}
