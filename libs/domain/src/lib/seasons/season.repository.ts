import type { Season } from './season';

/** Port de lecture des saisons (implémenté par la lib `database`). */
export interface SeasonRepository {
  findById(id: string): Promise<Season | null>;
  /** La saison en cours (`status = active`), s'il y en a une. */
  findActive(): Promise<Season | null>;
}

export const SEASON_REPOSITORY = Symbol('SeasonRepository');
