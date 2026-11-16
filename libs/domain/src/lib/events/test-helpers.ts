import type { FormatStatus } from '../catalog/catalog';
import type { Format } from '../ideas/idea';
import type { InMemoryGames, InMemoryIdeas } from '../ideas/test-helpers';
import type { InMemoryPlayers } from '../players/test-helpers';
import type { NewSeason, Season, SeasonChanges } from '../seasons/season';
import type { SeasonRepository } from '../seasons/season.repository';
import {
  type Event,
  type EventChanges,
  type EventResult,
  type EventSummary,
  type NewEvent,
  OPEN_EVENT_STATUSES,
  type Team,
} from './event';
import type { EventRepository } from './event.repository';

/** Faux ports en mémoire, pour les tests du domaine uniquement. */
export class InMemorySeasons implements SeasonRepository {
  rows = new Map<string, Season>();
  private next = 1;

  constructor(initial: Season[] = []) {
    for (const season of initial) this.rows.set(season.id, season);
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findActive() {
    return [...this.rows.values()].find((season) => season.status === 'active') ?? null;
  }
  async list() {
    return [...this.rows.values()];
  }
  async create(season: NewSeason) {
    const created: Season = { ...season, id: `s-new-${this.next++}`, status: 'upcoming' };
    this.rows.set(created.id, created);
    return created;
  }
  async update(id: string, changes: SeasonChanges) {
    const updated = { ...(this.rows.get(id) as Season), ...changes };
    this.rows.set(id, updated);
    return updated;
  }
}

export class InMemoryEvents implements EventRepository {
  rows = new Map<string, Event>();
  registrationRows: { eventId: string; playerId: string; teamId: string | null }[] = [];
  teamRows = new Map<string, Team>();
  resultRows = new Map<string, EventResult[]>();
  private next = 1;

  constructor(
    private readonly games: InMemoryGames,
    private readonly ideas: InMemoryIdeas,
    private readonly players: InMemoryPlayers,
  ) {}

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findSummary(id: string) {
    const event = this.rows.get(id);
    return event ? this.summary(event) : null;
  }
  async listBySeason(seasonId: string) {
    return [...this.rows.values()].filter((event) => event.seasonId === seasonId).map((event) => this.summary(event));
  }
  async listOpen() {
    return [...this.rows.values()].filter((event) => OPEN_EVENT_STATUSES.includes(event.status)).map((event) => this.summary(event));
  }
  async create(event: NewEvent) {
    const created: Event = {
      ...event,
      id: `e-${this.next}`,
      status: 'registration',
      validated: false,
      finishedAt: null,
      createdAt: new Date(2026, 0, this.next),
    };
    this.next++;
    this.rows.set(created.id, created);
    return created;
  }
  async update(id: string, changes: EventChanges) {
    this.rows.set(id, { ...(this.rows.get(id) as Event), ...changes });
  }

  async registrations(eventId: string) {
    return this.registrationRows
      .filter((row) => row.eventId === eventId)
      .map(({ playerId, teamId }) => {
        const player = this.players.rows.get(playerId);
        return { playerId, teamId, pseudo: player?.pseudo ?? playerId, avatarUrl: player?.avatarUrl ?? '' };
      });
  }
  async addRegistration(eventId: string, playerId: string) {
    if (this.registrationRows.some((row) => row.eventId === eventId && row.playerId === playerId)) return false;
    this.registrationRows.push({ eventId, playerId, teamId: null });
    return true;
  }
  async removeRegistration(eventId: string, playerId: string) {
    const before = this.registrationRows.length;
    this.registrationRows = this.registrationRows.filter((row) => !(row.eventId === eventId && row.playerId === playerId));
    this.resultRows.set(eventId, (this.resultRows.get(eventId) ?? []).filter((result) => result.playerId !== playerId));
    return this.registrationRows.length < before;
  }
  async setTeam(eventId: string, playerId: string, teamId: string | null) {
    for (const row of this.registrationRows) if (row.eventId === eventId && row.playerId === playerId) row.teamId = teamId;
  }

  async teams(eventId: string) {
    return [...this.teamRows.values()].filter((team) => team.eventId === eventId);
  }
  async findTeam(id: string) {
    return this.teamRows.get(id) ?? null;
  }
  async createTeam(eventId: string, name: string) {
    const team = { id: `t-${this.next++}`, eventId, name };
    this.teamRows.set(team.id, team);
    return team;
  }
  async renameTeam(id: string, name: string) {
    this.teamRows.set(id, { ...(this.teamRows.get(id) as Team), name });
  }
  async deleteTeam(id: string) {
    this.teamRows.delete(id);
    for (const row of this.registrationRows) if (row.teamId === id) row.teamId = null;
  }

  async results(eventId: string) {
    return this.resultRows.get(eventId) ?? [];
  }
  async saveResults(eventId: string, results: EventResult[], close: { finishedAt: Date; formatId: string } | null) {
    this.resultRows.set(eventId, results);
    if (!close) return;
    await this.rows.set(eventId, { ...(this.rows.get(eventId) as Event), status: 'finished', finishedAt: close.finishedAt });
    for (const vote of [...this.ideas.votes]) if (vote.endsWith(`/${close.formatId}`)) this.ideas.votes.delete(vote);
    await this.setFormatStatus(close.formatId, 'proposed');
  }

  async openEventIdsOfFormat(formatId: string) {
    return [...this.rows.values()]
      .filter((event) => event.formatId === formatId && OPEN_EVENT_STATUSES.includes(event.status))
      .map((event) => event.id);
  }
  async setFormatStatus(formatId: string, status: FormatStatus) {
    this.ideas.formats.set(formatId, { ...(this.ideas.formats.get(formatId) as Format), status });
  }
  async lastFinishedMain() {
    const finished = [...this.rows.values()].filter((event) => event.type === 'main' && event.status === 'finished');
    return finished.sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0))[0] ?? null;
  }
  async openMain() {
    const open = [...this.rows.values()].filter((event) => event.type === 'main' && OPEN_EVENT_STATUSES.includes(event.status));
    const first = open.sort((a, b) => a.announceDate.getTime() - b.announceDate.getTime())[0];
    return first ? this.summary(first) : null;
  }
  async pendingChoiceId() {
    for (const format of this.ideas.formats.values()) {
      if (format.status === 'selected' && (await this.openEventIdsOfFormat(format.id)).length === 0) return format.id;
    }
    return null;
  }
  async choose(formatId: string) {
    if ((await this.pendingChoiceId()) || this.ideas.formats.get(formatId)?.status !== 'proposed') return false;
    await this.setFormatStatus(formatId, 'selected');
    return true;
  }

  private summary(event: Event): EventSummary {
    const format = this.ideas.formats.get(event.formatId) as Format;
    const game = this.games.rows.get(format.gameId) as NonNullable<ReturnType<InMemoryGames['rows']['get']>>;
    const host = event.hostId ? this.players.rows.get(event.hostId) : undefined;
    return {
      ...event,
      format: {
        id: format.id,
        name: format.name,
        description: format.description,
        teamMode: format.teamMode,
        playMode: format.playMode,
        status: format.status,
      },
      game: { id: game.id, name: game.name, coverUrl: game.coverUrl, coverFile: game.coverFile },
      host: host ? { id: host.id, pseudo: host.pseudo } : null,
      registrationCount: this.registrationRows.filter((row) => row.eventId === event.id).length,
    };
  }
}

export const season = (overrides: Partial<Season> = {}): Season => ({
  id: 's-1',
  name: 'Saison 1',
  startDate: new Date('2026-01-01T00:00:00Z'),
  endDate: new Date('2026-07-01T00:00:00Z'),
  scoringScale: { 1: 24, 2: 18, 3: 14, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2 },
  mainQuota: 3,
  sideQuota: 2,
  status: 'active',
  ...overrides,
});
