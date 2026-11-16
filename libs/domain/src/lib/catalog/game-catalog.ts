import type { CatalogGame } from './game';

/**
 * Port du catalogue de jeux externe (implémenté par la lib `igdb`). Une autre source pourra s'y brancher
 * sans toucher au domaine. Les deux méthodes peuvent échouer (réseau, quota) : l'appelant s'en protège.
 */
export interface GameCatalog {
  search(query: string): Promise<CatalogGame[]>;
  findById(externalId: string): Promise<CatalogGame | null>;
}

export const GAME_CATALOG = Symbol('GameCatalog');
