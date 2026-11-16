import type { IdeaInput, IdeasService } from '../ideas/ideas.service';
import type { IdeaRepository } from '../ideas/idea.repository';
import { cleanName } from '../catalog/normalize';
import type { PlayerRepository } from '../players/player.repository';
import type { SeasonRepository } from '../seasons/season.repository';
import { type Actor, assertAdmin } from '../seasons/seasons.service';
import {
  DEFAULT_COEFFICIENT,
  type Event,
  type EventDetail,
  type EventDetailsChanges,
  type EventResult,
  type EventSummary,
  type EventType,
  type EventView,
  MIN_RANKED_PLAYERS_FOR_SIDE,
  OPEN_EVENT_STATUSES,
  SIDE_NOTICE_DAYS,
  type Team,
} from './event';
import { EventError } from './event-error';
import type { EventRepository } from './event.repository';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PLACE = 999;

/** Le format d'un event : un format existant, ou un nouveau, suggéré au nom de l'hôte (side event). */
export type EventFormatChoice = { kind: 'existing'; formatId: string } | { kind: 'new'; idea: IdeaInput };

export interface EventInput {
  seasonId: string;
  type: EventType;
  format: EventFormatChoice;
  /** 1 pour un main, 0,5 pour un side par défaut. */
  coefficient?: number;
  rules?: string;
  announceDate: Date;
  registrationEnd: Date;
  endDate: Date;
  liveDate?: Date | null;
  hostId?: string | null;
  challongeUrl?: string | null;
}

/** Places finales : une par joueur (event solo) ou une par équipe (event par équipe). Les absents sont non classés. */
export interface ResultsInput {
  players?: { playerId: string; place: number | null }[];
  teams?: { teamId: string; place: number | null }[];
}

export const isOpen = (event: Pick<Event, 'status'>) => OPEN_EVENT_STATUSES.includes(event.status);

/** Inscriptions ouvertes : de la création de l'event jusqu'à `registrationEnd`, tant qu'il n'a pas commencé. */
export function registrationOpen(event: Pick<Event, 'status' | 'registrationEnd'>, now: Date): boolean {
  return (event.status === 'announced' || event.status === 'registration') && now.getTime() < event.registrationEnd.getTime();
}

/**
 * Ce qui empêcherait un side de compter, ou de respecter le règlement : moins de 4 classés une fois joué,
 * annonce moins d'une semaine avant la date de jeu (live, sinon fin de l'event). L'admin valide en connaissance de cause.
 */
export function sideWarnings(event: Pick<Event, 'type' | 'status' | 'announceDate' | 'endDate' | 'liveDate'>, results: EventResult[]): string[] {
  if (event.type !== 'side') return [];
  const warnings: string[] = [];
  const ranked = results.filter((result) => result.place !== null).length;
  if (event.status === 'finished' && ranked < MIN_RANKED_PLAYERS_FOR_SIDE) {
    warnings.push(`Moins de ${MIN_RANKED_PLAYERS_FOR_SIDE} joueurs classés : ce side ne comptera pas au classement.`);
  }
  const playedAt = (event.liveDate ?? event.endDate).getTime();
  if (playedAt - event.announceDate.getTime() < SIDE_NOTICE_DAYS * DAY_MS) {
    warnings.push('Annoncé moins d’une semaine avant d’être joué.');
  }
  return warnings;
}

/**
 * Résultats à enregistrer : une ligne par inscrit. En équipe, chaque membre prend la place de son équipe ;
 * un inscrit sans place (ou sans équipe classée) est non classé. Les ex æquo sont permis.
 */
export function resultsFor(
  teamMode: boolean,
  registrations: { playerId: string; teamId: string | null }[],
  teams: Team[],
  input: ResultsInput,
): EventResult[] {
  const places = new Map<string, number | null>();
  const entries = teamMode ? (input.teams ?? []) : (input.players ?? []);
  if (teamMode ? input.players?.length : input.teams?.length) {
    throw new EventError('invalid', teamMode ? 'Event par équipe : saisis une place par équipe.' : 'Event solo : saisis une place par joueur.');
  }
  const known = new Set(teamMode ? teams.map((team) => team.id) : registrations.map((registration) => registration.playerId));
  for (const entry of entries) {
    const id = 'teamId' in entry ? entry.teamId : entry.playerId;
    if (!known.has(id)) {
      throw new EventError('invalid', teamMode ? 'Équipe inconnue pour cet event.' : 'Un des joueurs n’est pas inscrit à cet event.');
    }
    if (places.has(id)) throw new EventError('invalid', 'Une même place saisie deux fois pour le même participant.');
    if (entry.place !== null && (!Number.isInteger(entry.place) || entry.place < 1 || entry.place > MAX_PLACE)) {
      throw new EventError('invalid', 'Une place est un nombre entier à partir de 1.');
    }
    places.set(id, entry.place);
  }
  return registrations.map(({ playerId, teamId }) => ({
    playerId,
    place: (teamMode ? (teamId ? places.get(teamId) : null) : places.get(playerId)) ?? null,
  }));
}

/**
 * Les events d'une saison, de la création à la clôture. L'admin crée, modifie, démarre, annule et clôt les
 * events, compose les équipes et saisit les places. Un joueur s'inscrit tant que les inscriptions sont ouvertes,
 * sans pouvoir se désinscrire. Le format d'un event ouvert est retenu (votes gelés) ; la clôture efface ses votes
 * et le repasse en proposé.
 */
export class EventsService {
  constructor(
    private readonly events: EventRepository,
    private readonly seasons: SeasonRepository,
    private readonly players: PlayerRepository,
    private readonly ideas: IdeaRepository,
    private readonly ideasService: IdeasService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listBySeason(seasonId: string): Promise<EventSummary[]> {
    return (await this.events.listBySeason(seasonId)).sort(
      (a, b) => a.announceDate.getTime() - b.announceDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  async detail(viewer: Actor, id: string): Promise<EventView> {
    const summary = await this.events.findSummary(id);
    if (!summary) throw notFound();
    const [teams, registrations, results] = await Promise.all([
      this.events.teams(id),
      this.events.registrations(id),
      this.events.results(id),
    ]);
    const detail: EventDetail = { ...summary, teams, registrations, results };
    return {
      ...detail,
      registrationOpen: registrationOpen(summary, this.now()),
      registeredByMe: registrations.some((registration) => registration.playerId === viewer.id),
      sideWarnings: sideWarnings(summary, results),
    };
  }

  async create(actor: Actor, input: EventInput): Promise<EventView> {
    assertAdmin(actor);
    const season = await this.seasons.findById(input.seasonId);
    if (!season) throw new EventError('not_found', 'Saison introuvable.');
    if (season.status === 'finished') throw new EventError('closed', 'Cette saison est terminée.');
    const hostId = input.hostId ?? null;
    if (hostId) await this.assertPlayer(hostId);

    const details = checkDetails({
      coefficient: input.coefficient ?? DEFAULT_COEFFICIENT[input.type],
      rules: input.rules ?? '',
      announceDate: input.announceDate,
      registrationEnd: input.registrationEnd,
      endDate: input.endDate,
      liveDate: input.liveDate ?? null,
      hostId,
      challongeUrl: input.challongeUrl ?? null,
    });
    const formatId = await this.resolveFormat(input.format, hostId ?? actor.id, null);
    const event = await this.events.create({ ...details, seasonId: season.id, type: input.type, formatId });
    await this.events.setFormatStatus(formatId, 'selected');
    return this.detail(actor, event.id);
  }

  /** Règles, dates, hôte, lien Challonge, coefficient. Possible même après la clôture : le classement se recalcule. */
  async update(actor: Actor, id: string, changes: EventDetailsChanges): Promise<EventView> {
    assertAdmin(actor);
    const event = await this.find(id);
    if (changes.hostId) await this.assertPlayer(changes.hostId);
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)) as EventDetailsChanges;
    checkDetails({ ...event, ...defined });
    if (defined.rules !== undefined) defined.rules = defined.rules.trim();
    await this.events.update(id, defined);
    return this.detail(actor, id);
  }

  /** Change le jeu d'un event pas encore joué : l'ancien format redevient proposé (votes dégelés), le nouveau est retenu. */
  async changeFormat(actor: Actor, id: string, choice: EventFormatChoice): Promise<EventView> {
    assertAdmin(actor);
    const event = await this.openEvent(id);
    const formatId = await this.resolveFormat(choice, event.hostId ?? actor.id, event.id);
    if (formatId === event.formatId) return this.detail(actor, id);
    await this.events.update(id, { formatId });
    await this.events.setFormatStatus(formatId, 'selected');
    await this.releaseFormat(event.formatId);
    return this.detail(actor, id);
  }

  /** Fin des inscriptions, début des matchs. */
  async start(actor: Actor, id: string): Promise<EventView> {
    assertAdmin(actor);
    const event = await this.openEvent(id);
    if (event.status === 'in_progress') return this.detail(actor, id);
    await this.events.update(id, { status: 'in_progress' });
    return this.detail(actor, id);
  }

  /** Annulation : le format redevient proposé et garde ses votes. */
  async cancel(actor: Actor, id: string): Promise<EventView> {
    assertAdmin(actor);
    const event = await this.openEvent(id);
    await this.events.update(id, { status: 'cancelled' });
    await this.releaseFormat(event.formatId);
    return this.detail(actor, id);
  }

  async register(player: Actor, id: string): Promise<EventView> {
    const event = await this.find(id);
    if (!registrationOpen(event, this.now())) throw new EventError('closed', 'Les inscriptions à cet event sont fermées.');
    await this.assertPlayer(player.id);
    if (!(await this.events.addRegistration(id, player.id))) throw new EventError('conflict', 'Tu es déjà inscrit à cet event.');
    return this.detail(player, id);
  }

  /** L'admin inscrit un joueur, même après la fin des inscriptions, tant que l'event n'est pas clos. */
  async addRegistration(actor: Actor, id: string, playerId: string): Promise<EventView> {
    assertAdmin(actor);
    await this.openEvent(id);
    await this.assertPlayer(playerId);
    if (!(await this.events.addRegistration(id, playerId))) throw new EventError('conflict', 'Ce joueur est déjà inscrit.');
    return this.detail(actor, id);
  }

  async removeRegistration(actor: Actor, id: string, playerId: string): Promise<EventView> {
    assertAdmin(actor);
    await this.openEvent(id);
    if (!(await this.events.removeRegistration(id, playerId))) throw new EventError('not_found', 'Ce joueur n’est pas inscrit.');
    return this.detail(actor, id);
  }

  async createTeam(actor: Actor, id: string, name: string): Promise<EventView> {
    assertAdmin(actor);
    const event = await this.openTeamEvent(id);
    const teamName = await this.teamName(event.id, name, null);
    await this.events.createTeam(event.id, teamName);
    return this.detail(actor, id);
  }

  async renameTeam(actor: Actor, id: string, teamId: string, name: string): Promise<EventView> {
    assertAdmin(actor);
    await this.openTeamEvent(id);
    await this.teamOf(id, teamId);
    await this.events.renameTeam(teamId, await this.teamName(id, name, teamId));
    return this.detail(actor, id);
  }

  async deleteTeam(actor: Actor, id: string, teamId: string): Promise<EventView> {
    assertAdmin(actor);
    await this.openTeamEvent(id);
    await this.teamOf(id, teamId);
    await this.events.deleteTeam(teamId);
    return this.detail(actor, id);
  }

  /** Range un inscrit dans une équipe, ou l'en sort (`null`). */
  async assignTeam(actor: Actor, id: string, playerId: string, teamId: string | null): Promise<EventView> {
    assertAdmin(actor);
    await this.openTeamEvent(id);
    if (teamId) await this.teamOf(id, teamId);
    const registrations = await this.events.registrations(id);
    if (!registrations.some((registration) => registration.playerId === playerId)) {
      throw new EventError('not_found', 'Ce joueur n’est pas inscrit.');
    }
    await this.events.setTeam(id, playerId, teamId);
    return this.detail(actor, id);
  }

  /**
   * Saisie des places finales. La première saisie clôt l'event : ses votes sont effacés et son format repasse en
   * proposé. Une saisie suivante corrige seulement les places (les votes reçus depuis restent).
   */
  async saveResults(actor: Actor, id: string, input: ResultsInput): Promise<EventView> {
    assertAdmin(actor);
    const summary = await this.events.findSummary(id);
    if (!summary) throw notFound();
    if (summary.status === 'cancelled') throw new EventError('closed', 'Cet event est annulé.');
    const [registrations, teams] = await Promise.all([this.events.registrations(id), this.events.teams(id)]);
    const results = resultsFor(summary.format.teamMode === 'team', registrations, teams, input);
    const close = summary.status === 'finished' ? null : { finishedAt: this.now(), formatId: summary.formatId };
    await this.events.saveResults(id, results, close);
    return this.detail(actor, id);
  }

  /** Validation d'un side par l'admin. Les avertissements (`sideWarnings`) n'empêchent pas de valider. */
  async validate(actor: Actor, id: string, validated: boolean): Promise<EventView> {
    assertAdmin(actor);
    const event = await this.find(id);
    if (event.type !== 'side') throw new EventError('invalid', 'Seul un side event se valide.');
    await this.events.update(id, { validated });
    return this.detail(actor, id);
  }

  private async resolveFormat(choice: EventFormatChoice, suggestedById: string, eventId: string | null): Promise<string> {
    if (choice.kind === 'new') {
      const idea = await this.ideasService.suggest({ id: suggestedById, role: 'player' }, choice.idea);
      return idea.id;
    }
    const format = await this.ideas.findFormat(choice.formatId);
    if (!format) throw new EventError('not_found', 'Format introuvable.');
    const others = (await this.events.openEventIdsOfFormat(format.id)).filter((other) => other !== eventId);
    if (others.length > 0) throw new EventError('conflict', 'Ce format est déjà retenu pour un autre event en cours.');
    return format.id;
  }

  /** Le format d'un event qui n'est plus joué redevient proposé, sauf s'il sert encore à un autre event. */
  private async releaseFormat(formatId: string): Promise<void> {
    if ((await this.events.openEventIdsOfFormat(formatId)).length === 0) await this.events.setFormatStatus(formatId, 'proposed');
  }

  private async teamName(eventId: string, name: string, exceptTeamId: string | null): Promise<string> {
    const cleaned = cleanName(name);
    if (!cleaned) throw new EventError('invalid', 'Le nom de l’équipe est obligatoire.');
    const teams = await this.events.teams(eventId);
    if (teams.some((team) => team.id !== exceptTeamId && team.name.toLowerCase() === cleaned.toLowerCase())) {
      throw new EventError('conflict', 'Une équipe porte déjà ce nom.');
    }
    return cleaned;
  }

  private async teamOf(eventId: string, teamId: string): Promise<Team> {
    const team = await this.events.findTeam(teamId);
    if (!team || team.eventId !== eventId) throw new EventError('not_found', 'Équipe introuvable.');
    return team;
  }

  private async assertPlayer(playerId: string): Promise<void> {
    const player = await this.players.findById(playerId);
    if (!player) throw new EventError('not_found', 'Joueur introuvable.');
    if (!player.active) throw new EventError('invalid', `${player.pseudo} n’est plus sur le serveur.`);
  }

  private async find(id: string): Promise<Event> {
    const event = await this.events.findById(id);
    if (!event) throw notFound();
    return event;
  }

  private async openEvent(id: string): Promise<Event> {
    const event = await this.find(id);
    if (!isOpen(event)) throw new EventError('closed', event.status === 'finished' ? 'Cet event est terminé.' : 'Cet event est annulé.');
    return event;
  }

  private async openTeamEvent(id: string): Promise<Event> {
    const summary = await this.events.findSummary(id);
    if (!summary) throw notFound();
    if (!isOpen(summary)) throw new EventError('closed', 'Cet event est terminé ou annulé.');
    if (summary.format.teamMode !== 'team') throw new EventError('invalid', 'Cet event se joue en solo.');
    return summary;
  }
}

/** Vérifie les dates et le coefficient d'un event ; renvoie les champs nettoyés. */
function checkDetails<T extends Required<Omit<EventDetailsChanges, 'hostId'>> & Pick<Event, 'hostId'>>(details: T): T {
  const { announceDate, registrationEnd, endDate, liveDate, coefficient, challongeUrl } = details;
  if (registrationEnd.getTime() < announceDate.getTime()) {
    throw new EventError('invalid', 'Les inscriptions ne peuvent pas finir avant l’annonce.');
  }
  if (endDate.getTime() < registrationEnd.getTime()) {
    throw new EventError('invalid', 'L’event ne peut pas finir avant la fin des inscriptions.');
  }
  if (liveDate && (liveDate.getTime() < announceDate.getTime() || liveDate.getTime() > endDate.getTime())) {
    throw new EventError('invalid', 'La date du live doit tomber entre l’annonce et la fin de l’event.');
  }
  if (!(coefficient > 0 && coefficient <= 10)) throw new EventError('invalid', 'Le coefficient doit être compris entre 0 et 10.');
  if (challongeUrl !== null && !/^https:\/\/\S+$/.test(challongeUrl)) {
    throw new EventError('invalid', 'Le lien Challonge doit commencer par https://.');
  }
  return { ...details, rules: details.rules.trim() };
}

function notFound(): EventError {
  return new EventError('not_found', 'Event introuvable.');
}
