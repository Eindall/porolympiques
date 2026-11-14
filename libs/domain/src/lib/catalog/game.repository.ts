import type { GameSource } from './catalog';
import type { Game, GameChanges, NewGame } from './game';

/** Port de persistance des jeux (implémenté par la lib `database`). */
export interface GameRepository {
  findById(id: string): Promise<Game | null>;
  findByExternalId(source: GameSource, externalId: string): Promise<Game | null>;
  /** Jeu saisi librement dont le nom normalisé (`normalizeName`) est exactement celui-ci. */
  findCustomByName(normalizedName: string): Promise<Game | null>;
  /** Jeux dont le nom normalisé contient la recherche, ceux qui commencent par elle d'abord. */
  searchByName(normalizedQuery: string, limit: number): Promise<Game[]>;
  create(game: NewGame): Promise<Game>;
  update(id: string, changes: GameChanges): Promise<Game>;
}

export const GAME_REPOSITORY = Symbol('GameRepository');
