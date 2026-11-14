import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { CachedSearch, CatalogGame, CatalogSearchCache } from '@porolympiques/domain';
import { Repository } from 'typeorm';
import { CatalogSearchCacheEntity } from './catalog-search-cache.entity';

@Injectable()
export class TypeOrmCatalogSearchCache implements CatalogSearchCache {
  constructor(@InjectRepository(CatalogSearchCacheEntity) private readonly rows: Repository<CatalogSearchCacheEntity>) {}

  async get(query: string): Promise<CachedSearch | null> {
    const row = await this.rows.findOneBy({ query: query.slice(0, 200) });
    return row ? { results: row.results as CatalogGame[], fetchedAt: row.fetchedAt } : null;
  }

  async put(query: string, search: CachedSearch): Promise<void> {
    await this.rows.upsert({ query: query.slice(0, 200), results: search.results, fetchedAt: search.fetchedAt }, ['query']);
  }
}
