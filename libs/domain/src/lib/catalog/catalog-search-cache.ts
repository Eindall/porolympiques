import type { CatalogGame } from './game';

export interface CachedSearch {
  results: CatalogGame[];
  fetchedAt: Date;
}

/** Port du cache des recherches dans le catalogue externe, par requête normalisée (implémenté par `database`). */
export interface CatalogSearchCache {
  get(query: string): Promise<CachedSearch | null>;
  put(query: string, search: CachedSearch): Promise<void>;
}

export const CATALOG_SEARCH_CACHE = Symbol('CatalogSearchCache');
