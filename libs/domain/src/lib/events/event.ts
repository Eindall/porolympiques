import type { FormatStatus, PlayMode, TeamMode } from '../catalog/catalog';
import type { Game } from '../catalog/game';

export type EventType = 'main' | 'side';
export type EventStatus = 'announced' | 'registration' | 'in_progress' | 'finished' | 'cancelled';

/** Coefficient par défaut d'un event, selon son type : un side compte moitié moins qu'un main. */
export const DEFAULT_COEFFICIENT: Readonly<Record<EventType, number>> = { main: 1, side: 0.5 };

/** Un side event ne compte au classement que s'il réunit au moins ce nombre de joueurs classés. */
export const MIN_RANKED_PLAYERS_FOR_SIDE = 4;

/** Un side doit être annoncé au moins ce nombre de jours avant d'être joué. */
export const SIDE_NOTICE_DAYS = 7;

/** Statuts d'un event pas encore joué jusqu'au bout : son format est retenu. */
export const OPEN_EVENT_STATUSES: readonly EventStatus[] = ['announced', 'registration', 'in_progress'];

/** Un main ou un side event d'une saison, joué sur un format. */
export interface Event {
  id: string;
  seasonId: string;
  formatId: string;
  type: EventType;
  coefficient: number;
  status: EventStatus;
  rules: string;
  announceDate: Date;
  registrationEnd: Date;
  endDate: Date;
  /** Seulement pour un event joué en live. */
  liveDate: Date | null;
  hostId: string | null;
  challongeUrl: string | null;
  /** Validation d'un side par l'admin (sans effet sur un main). */
  validated: boolean;
  /** Date de clôture (saisie des places) : point de départ du délai de choix du jeu suivant. */
  finishedAt: Date | null;
  createdAt: Date;
}

export type NewEvent = Omit<Event, 'id' | 'status' | 'validated' | 'finishedAt' | 'createdAt'>;

/** Champs que l'admin modifie librement. */
export type EventDetailsChanges = Partial<
  Pick<Event, 'rules' | 'announceDate' | 'registrationEnd' | 'endDate' | 'liveDate' | 'hostId' | 'challongeUrl' | 'coefficient'>
>;

export type EventChanges = EventDetailsChanges & Partial<Pick<Event, 'status' | 'validated' | 'formatId'>>;

/** Une équipe d'un event par équipe. */
export interface Team {
  id: string;
  eventId: string;
  name: string;
}

/** Un inscrit, avec son équipe éventuelle. */
export interface Registration {
  playerId: string;
  pseudo: string;
  avatarUrl: string;
  teamId: string | null;
}

/** Une place finale. `place` vide : inscrit mais non classé. */
export interface EventResult {
  playerId: string;
  place: number | null;
}

/** Un event avec ce qu'il faut pour l'afficher dans une liste. */
export interface EventSummary extends Event {
  format: { id: string; name: string; description: string; teamMode: TeamMode; playMode: PlayMode; status: FormatStatus };
  game: Pick<Game, 'id' | 'name' | 'coverUrl' | 'coverFile'>;
  host: { id: string; pseudo: string } | null;
  registrationCount: number;
}

/** Un event complet : inscrits, équipes et résultats. */
export interface EventDetail extends EventSummary {
  teams: Team[];
  registrations: Registration[];
  results: EventResult[];
}

/** Un event tel qu'un joueur le voit, avec ce qu'il peut en faire. */
export interface EventView extends EventDetail {
  registrationOpen: boolean;
  registeredByMe: boolean;
  /** Avertissements avant de valider un side (vides pour un main). */
  sideWarnings: string[];
}
