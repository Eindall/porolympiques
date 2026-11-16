import type { NewSeason, Season, SeasonChanges } from './season';

/** Port de persistance des saisons (implémenté par la lib `database`). */
export interface SeasonRepository {
  findById(id: string): Promise<Season | null>;
  /** La saison en cours (`status = active`), s'il y en a une. */
  findActive(): Promise<Season | null>;
  /** Toutes les saisons, ordre quelconque. */
  list(): Promise<Season[]>;
  create(season: NewSeason): Promise<Season>;
  update(id: string, changes: SeasonChanges): Promise<Season>;
}

export const SEASON_REPOSITORY = Symbol('SeasonRepository');
