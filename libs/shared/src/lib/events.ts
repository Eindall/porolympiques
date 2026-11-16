import type { IdeaDto, PlayModeDto, SuggestIdeaRequest, TeamModeDto } from './ideas';
import type { EventTypeDto, SeasonStatusDto } from './standings';

export type EventStatusDto = 'announced' | 'registration' | 'in_progress' | 'finished' | 'cancelled';

export const EVENT_TYPE_LABELS: Record<EventTypeDto, string> = { main: 'Main event', side: 'Side event' };
export const EVENT_STATUS_LABELS: Record<EventStatusDto, string> = {
  announced: 'Annoncé',
  registration: 'Inscriptions',
  in_progress: 'En cours',
  finished: 'Terminé',
  cancelled: 'Annulé',
};
export const SEASON_STATUS_LABELS: Record<SeasonStatusDto, string> = { upcoming: 'À venir', active: 'En cours', finished: 'Terminée' };

/** Une saison complète. Dates en ISO 8601, UTC. */
export interface SeasonDto {
  id: string;
  name: string;
  status: SeasonStatusDto;
  startDate: string;
  endDate: string;
  /** Place → points pour un main ; la dernière place vaut pour toutes les suivantes. */
  scoringScale: Record<string, number>;
  mainQuota: number;
  sideQuota: number;
}

/** Corps de `POST /api/admin/seasons` ; `PATCH` accepte les mêmes champs, tous facultatifs. */
export interface SeasonRequest {
  name: string;
  startDate: string;
  endDate: string;
  scoringScale?: Record<string, number>;
  mainQuota?: number;
  sideQuota?: number;
}

export interface PlayerRefDto {
  id: string;
  pseudo: string;
}

/** Un joueur du serveur, pour les listes de choix de l'admin. */
export interface PlayerDto extends PlayerRefDto {
  avatarUrl: string;
  active: boolean;
}

/** Un event dans une liste. Dates en ISO 8601, UTC. */
export interface EventSummaryDto {
  id: string;
  seasonId: string;
  type: EventTypeDto;
  status: EventStatusDto;
  coefficient: number;
  validated: boolean;
  rules: string;
  announceDate: string;
  registrationEnd: string;
  endDate: string;
  liveDate: string | null;
  finishedAt: string | null;
  challongeUrl: string | null;
  host: PlayerRefDto | null;
  format: { id: string; name: string; description: string; teamMode: TeamModeDto; playMode: PlayModeDto };
  game: { id: string; name: string; coverUrl: string | null };
  registrationCount: number;
}

export interface EventDto extends EventSummaryDto {
  teams: { id: string; name: string }[];
  registrations: { playerId: string; pseudo: string; avatarUrl: string; teamId: string | null }[];
  results: { playerId: string; place: number | null }[];
  registrationOpen: boolean;
  registeredByMe: boolean;
  /** Ce qui empêcherait un side de compter ou de respecter le règlement (vide pour un main). */
  sideWarnings: string[];
}

/** Le format d'un event : un format existant, ou un nouveau (side event, suggéré au nom de l'hôte). */
export type EventFormatRequest = { kind: 'existing'; formatId: string } | { kind: 'new'; idea: SuggestIdeaRequest };

/** Corps de `POST /api/admin/events`. */
export interface CreateEventRequest {
  seasonId: string;
  type: EventTypeDto;
  format: EventFormatRequest;
  coefficient?: number;
  rules?: string;
  announceDate: string;
  registrationEnd: string;
  endDate: string;
  liveDate?: string | null;
  hostId?: string | null;
  challongeUrl?: string | null;
}

/** Corps de `PATCH /api/admin/events/:id`. */
export type UpdateEventRequest = Partial<Omit<CreateEventRequest, 'seasonId' | 'type' | 'format'>>;

/** Corps de `PUT /api/admin/events/:id/results` : une place par joueur, ou par équipe. Les absents sont non classés. */
export interface ResultsRequest {
  players?: { playerId: string; place: number | null }[];
  teams?: { teamId: string; place: number | null }[];
}

export type NextGameStatusDto = 'scheduled' | 'chosen' | 'open' | 'default';

/** `GET /api/game-choice` : où en est le choix du jeu du prochain main. */
export interface NextGameDto {
  status: NextGameStatusDto;
  nextMain: EventSummaryDto | null;
  lastMain: { id: string; finishedAt: string | null } | null;
  choosers: PlayerRefDto[];
  deadline: string | null;
  candidates: IdeaDto[];
  pick: IdeaDto | null;
  canChoose: boolean;
}

export type EventErrorCodeDto = 'not_found' | 'forbidden' | 'invalid' | 'closed' | 'conflict';

export interface EventErrorDto {
  statusCode: number;
  code: EventErrorCodeDto;
  message: string;
}
