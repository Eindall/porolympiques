import type { FormatStatus } from '../catalog/catalog';
import type { Event, EventChanges, EventResult, EventSummary, NewEvent, Registration, Team } from './event';

/** Port de persistance des events, inscriptions, équipes et résultats (implémenté par la lib `database`). */
export interface EventRepository {
  findById(id: string): Promise<Event | null>;
  findSummary(id: string): Promise<EventSummary | null>;
  /** Les events d'une saison, ordre quelconque. */
  listBySeason(seasonId: string): Promise<EventSummary[]>;
  create(event: NewEvent): Promise<Event>;
  update(id: string, changes: EventChanges): Promise<void>;

  registrations(eventId: string): Promise<Registration[]>;
  /** Faux si le joueur était déjà inscrit. */
  addRegistration(eventId: string, playerId: string): Promise<boolean>;
  /** Faux si le joueur n'était pas inscrit. Efface aussi son résultat éventuel. */
  removeRegistration(eventId: string, playerId: string): Promise<boolean>;
  setTeam(eventId: string, playerId: string, teamId: string | null): Promise<void>;

  teams(eventId: string): Promise<Team[]>;
  findTeam(id: string): Promise<Team | null>;
  createTeam(eventId: string, name: string): Promise<Team>;
  renameTeam(id: string, name: string): Promise<void>;
  /** Les membres de l'équipe restent inscrits, sans équipe. */
  deleteTeam(id: string): Promise<void>;

  results(eventId: string): Promise<EventResult[]>;
  /**
   * Remplace tous les résultats de l'event, d'un seul bloc. Avec `close`, termine aussi l'event (statut
   * `finished`, date de clôture), efface les votes de son format et le repasse en `proposed`.
   */
  saveResults(eventId: string, results: EventResult[], close: { finishedAt: Date; formatId: string } | null): Promise<void>;

  /** Les events pas encore terminés ni annulés joués sur ce format. */
  openEventIdsOfFormat(formatId: string): Promise<string[]>;
  setFormatStatus(formatId: string, status: FormatStatus): Promise<void>;
  /** Le main terminé le plus récemment (date de clôture), toutes saisons confondues. */
  lastFinishedMain(): Promise<Event | null>;
  /** Un main pas encore terminé ni annulé, s'il y en a un (le plus proche). */
  openMain(): Promise<EventSummary | null>;
  /** Le format choisi pour le prochain main : retenu, sans event en cours. */
  pendingChoiceId(): Promise<string | null>;
  /**
   * Retient le format pour le prochain main, sauf si un choix est déjà en attente (`pendingChoiceId`) ou si le
   * format n'est plus proposé. Atomique : de deux choix simultanés, un seul passe. Vrai si le choix est enregistré.
   */
  choose(formatId: string): Promise<boolean>;
}

export const EVENT_REPOSITORY = Symbol('EventRepository');
