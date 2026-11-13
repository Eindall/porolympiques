export type SeasonStatus = 'upcoming' | 'active' | 'finished';

/**
 * Barème d'une saison : place → points pour un main (coefficient 1). Les places vont de 1 à N sans trou,
 * et la dernière place listée vaut pour toutes les suivantes (« 9 et plus »).
 */
export type ScoringScale = Readonly<Record<string, number>>;

/** Barème des specs : 24, 18, 14, 12, 10, 8, 6, 4, puis 2 points à partir de la 9e place. */
export const DEFAULT_SCORING_SCALE: ScoringScale = { 1: 24, 2: 18, 3: 14, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2 };
export const DEFAULT_MAIN_QUOTA = 3;
export const DEFAULT_SIDE_QUOTA = 2;

/** Une saison de 6 mois. Une seule est active à la fois. */
export interface Season {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  scoringScale: ScoringScale;
  /** Nombre de meilleurs résultats en main comptés au classement. */
  mainQuota: number;
  /** Nombre de meilleurs résultats en side comptés au classement. */
  sideQuota: number;
  status: SeasonStatus;
}
