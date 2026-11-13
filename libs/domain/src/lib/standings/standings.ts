import type { EventStatus, EventType } from '../events/event';
import type { Season } from '../seasons/season';

/** Un event de la saison, tel que le calcul du classement en a besoin. */
export interface StandingsEvent {
  id: string;
  /** Libellé affiché (jeu et format). */
  label: string;
  type: EventType;
  coefficient: number;
  status: EventStatus;
  /** Validation d'un side par l'admin (ignorée pour un main). */
  validated: boolean;
  endDate: Date;
}

/** Une place finale. `place` vide : inscrit mais non classé. */
export interface StandingsResult {
  eventId: string;
  playerId: string;
  place: number | null;
}

export interface StandingsPlayer {
  id: string;
  pseudo: string;
  avatarUrl: string;
  active: boolean;
}

export interface StandingsInput {
  season: Pick<Season, 'scoringScale' | 'mainQuota' | 'sideQuota'>;
  events: readonly StandingsEvent[];
  results: readonly StandingsResult[];
  players: readonly StandingsPlayer[];
}

/**
 * - `counted` : dans les quotas, compte dans le score ;
 * - `discarded` : hors quotas, sert au départage (affiché en grisé) ;
 * - `unranked` : inscrit mais non classé, zéro point.
 */
export type ScoredResultStatus = 'counted' | 'discarded' | 'unranked';

export interface ScoredResult {
  eventId: string;
  label: string;
  type: EventType;
  endDate: Date;
  place: number | null;
  points: number;
  status: ScoredResultStatus;
}

export interface StandingsEntry {
  /** Rang partagé en cas d'égalité parfaite (1, 2, 2, 4). */
  rank: number;
  player: StandingsPlayer;
  score: number;
  /** 1res places en main et en side compté. */
  wins: number;
  /** Résultats retenus pour la saison, du plus ancien au plus récent. */
  results: ScoredResult[];
}
