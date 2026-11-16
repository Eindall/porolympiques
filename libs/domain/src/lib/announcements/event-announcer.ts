import type { EventSummary } from '../events/event';
import type { Season } from '../seasons/season';
import type { StandingsEntry } from '../standings/standings';

/** L'annonce d'un event, telle que le bot la met en forme. */
export interface EventAnnouncement {
  event: EventSummary;
  registrationOpen: boolean;
}

/** Une ligne des résultats d'un event : un joueur, ou une équipe avec ses membres. */
export interface ResultLine {
  place: number;
  label: string;
  /** Membres d'une équipe ; vide en solo. */
  members: string[];
}

/** Le message de clôture : places de l'event, puis le haut du classement de sa saison. */
export interface ResultsAnnouncement {
  event: EventSummary;
  /** Classés, par place (ex æquo à la suite). */
  lines: ResultLine[];
  /** Nombre d'inscrits (ou d'équipes) non classés. */
  unranked: number;
  season: Season | null;
  /** Haut du classement de la saison après cet event, ex æquo compris. */
  standings: StandingsEntry[];
}

/**
 * Port de publication des messages d'event (implémenté par le bot Discord). Les `edit…` renvoient faux si le
 * message n'existe plus (supprimé à la main) : le domaine en reposte alors un nouveau.
 */
export interface EventAnnouncer {
  /** Faux tant que le bot n'est pas connecté, ou sans salon d'annonces configuré : rien n'est publié. */
  isReady(): boolean;
  postAnnouncement(announcement: EventAnnouncement): Promise<string>;
  editAnnouncement(messageId: string, announcement: EventAnnouncement): Promise<boolean>;
  postResults(results: ResultsAnnouncement): Promise<string>;
  editResults(messageId: string, results: ResultsAnnouncement): Promise<boolean>;
}

export const EVENT_ANNOUNCER = Symbol('EventAnnouncer');

/** Identifiant de message réservé aux events créés avant le bot : ils restent sans annonce ni résultats. */
export const SILENT_MESSAGE_ID = '-';

/** Prévenu après chaque changement d'un event (création, inscription, résultats…). Ne lève jamais. */
export interface EventObserver {
  eventChanged(eventId: string): Promise<void>;
}

export const NO_EVENT_OBSERVER: EventObserver = { eventChanged: async () => undefined };
