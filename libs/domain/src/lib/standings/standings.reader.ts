import type { StandingsEvent, StandingsPlayer, StandingsResult } from './standings';

/** Tout ce qu'il faut pour classer une saison : ses events, leurs résultats et les joueurs concernés. */
export interface SeasonResults {
  events: StandingsEvent[];
  results: StandingsResult[];
  players: StandingsPlayer[];
}

/** Port de lecture des résultats d'une saison (implémenté par la lib `database`). */
export interface StandingsReader {
  loadSeasonResults(seasonId: string): Promise<SeasonResults>;
}

export const STANDINGS_READER = Symbol('StandingsReader');
