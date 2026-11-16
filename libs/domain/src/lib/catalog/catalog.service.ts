import type { CatalogSearchCache } from './catalog-search-cache';
import type { CatalogGame, GameSearchResult } from './game';
import type { GameCatalog } from './game-catalog';
import type { GameRepository } from './game.repository';
import { normalizeName } from './normalize';

/** Nombre de résultats renvoyés par l'autocomplete. */
export const SEARCH_LIMIT = 10;
/** Longueur minimale d'une recherche (normalisée). */
export const SEARCH_MIN_LENGTH = 2;
/** Durée de vie d'une recherche en cache. */
export const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface GameSearch {
  results: GameSearchResult[];
  /** Faux si le catalogue externe n'a pas répondu : seuls les jeux enregistrés sont proposés. */
  catalogAvailable: boolean;
}

/**
 * Autocomplete des jeux. Les jeux déjà enregistrés passent d'abord, puis le cache de recherche (ou, s'il est
 * absent ou périmé, le catalogue externe) complète, sans doublon.
 */
export class CatalogService {
  constructor(
    private readonly games: GameRepository,
    private readonly catalog: GameCatalog,
    private readonly cache: CatalogSearchCache,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async search(query: string): Promise<GameSearch> {
    const normalized = normalizeName(query);
    if (normalized.length < SEARCH_MIN_LENGTH) return { results: [], catalogAvailable: true };

    const local = await this.games.searchByName(normalized, SEARCH_LIMIT);
    const { games: remote, available } = await this.searchCatalog(normalized);

    const known = new Set(local.filter((game) => game.externalId).map((game) => `${game.source}:${game.externalId}`));
    const results: GameSearchResult[] = [
      ...local.map(({ id, source, externalId, name, coverUrl, priceTier, coverFile }) => ({
        gameId: id,
        source,
        externalId,
        name,
        coverUrl,
        year: null,
        priceTier,
        coverFile,
      })),
      ...remote
        .filter((game) => !known.has(`igdb:${game.externalId}`))
        .map(({ externalId, name, coverUrl, year }) => ({
          gameId: null,
          source: 'igdb' as const,
          externalId,
          name,
          coverUrl,
          year,
          priceTier: null,
          coverFile: null,
        })),
    ];
    return { results: results.slice(0, SEARCH_LIMIT), catalogAvailable: available };
  }

  /** Un jeu du catalogue externe par son identifiant (pour l'enregistrer quand on y suggère un format). */
  findInCatalog(externalId: string): Promise<CatalogGame | null> {
    return this.catalog.findById(externalId);
  }

  private async searchCatalog(query: string): Promise<{ games: CatalogGame[]; available: boolean }> {
    const cached = await this.cache.get(query);
    const now = this.clock();
    if (cached && now.getTime() - cached.fetchedAt.getTime() < SEARCH_CACHE_TTL_MS) {
      return { games: cached.results, available: true };
    }
    try {
      const games = await this.catalog.search(query);
      await this.cache.put(query, { results: games, fetchedAt: now });
      return { games, available: true };
    } catch {
      // Catalogue injoignable : un cache périmé vaut mieux que rien, et la saisie libre reste possible.
      return { games: cached?.results ?? [], available: false };
    }
  }
}
