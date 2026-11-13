export type SeasonStatusDto = 'upcoming' | 'active' | 'finished';
export type EventTypeDto = 'main' | 'side';

/**
 * - `counted` : dans les quotas, compte dans le score ;
 * - `discarded` : hors quotas, sert au départage (affiché en grisé) ;
 * - `unranked` : inscrit mais non classé, zéro point.
 */
export type ScoredResultStatusDto = 'counted' | 'discarded' | 'unranked';

export interface SeasonSummaryDto {
  id: string;
  name: string;
  status: SeasonStatusDto;
  /** ISO 8601, UTC. */
  startDate: string;
  endDate: string;
  mainQuota: number;
  sideQuota: number;
}

export interface ScoredResultDto {
  eventId: string;
  /** Jeu et format. */
  label: string;
  type: EventTypeDto;
  /** ISO 8601, UTC. */
  endDate: string;
  place: number | null;
  points: number;
  status: ScoredResultStatusDto;
}

export interface StandingsEntryDto {
  /** Partagé en cas d'égalité parfaite (1, 2, 2, 4). */
  rank: number;
  player: { id: string; pseudo: string; avatarUrl: string; active: boolean };
  score: number;
  wins: number;
  /** Du plus ancien au plus récent. */
  results: ScoredResultDto[];
}

/** Réponse de `GET /api/seasons/:id/standings` et `GET /api/seasons/current/standings`. */
export interface SeasonStandingsDto {
  season: SeasonSummaryDto;
  entries: StandingsEntryDto[];
}
