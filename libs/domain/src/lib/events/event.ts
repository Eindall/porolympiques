export type EventType = 'main' | 'side';
export type EventStatus = 'announced' | 'registration' | 'in_progress' | 'finished' | 'cancelled';

/** Coefficient par défaut d'un event, selon son type : un side compte moitié moins qu'un main. */
export const DEFAULT_COEFFICIENT: Readonly<Record<EventType, number>> = { main: 1, side: 0.5 };

/** Un side event ne compte au classement que s'il réunit au moins ce nombre de joueurs classés. */
export const MIN_RANKED_PLAYERS_FOR_SIDE = 4;
