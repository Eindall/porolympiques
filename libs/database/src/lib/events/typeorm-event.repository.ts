import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  type Event,
  type EventChanges,
  type EventRepository,
  type EventResult,
  type EventSummary,
  type FormatStatus,
  type NewEvent,
  OPEN_EVENT_STATUSES,
  type Registration,
  type Team,
} from '@porolympiques/domain';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { FormatEntity } from '../catalog/format.entity';
import { VoteEntity } from '../catalog/vote.entity';
import { isUuid } from '../uuid';
import { EventEntity } from './event.entity';
import { RegistrationEntity } from './registration.entity';
import { ResultEntity } from './result.entity';
import { TeamEntity } from './team.entity';

/** Verrou des choix de jeu : deux choix simultanés passent l'un après l'autre. */
const CHOICE_LOCK = `SELECT pg_advisory_xact_lock(hashtext('porolympiques:game-choice'))`;

const OPEN = OPEN_EVENT_STATUSES.map((status) => `'${status}'`).join(', ');

const PENDING_CHOICE = `
  SELECT f.id FROM formats f
   WHERE f.status = 'selected'
     AND NOT EXISTS (SELECT 1 FROM events e WHERE e.format_id = f.id AND e.status IN (${OPEN}))
   ORDER BY f.updated_at
   LIMIT 1`;

function toEvent(row: EventEntity): Event {
  return {
    id: row.id,
    seasonId: row.seasonId,
    formatId: row.formatId,
    type: row.type,
    coefficient: row.coefficient,
    status: row.status,
    rules: row.rules,
    announceDate: row.announceDate,
    registrationEnd: row.registrationEnd,
    endDate: row.endDate,
    liveDate: row.liveDate,
    hostId: row.hostId,
    challongeUrl: row.challongeUrl,
    validated: row.validated,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class TypeOrmEventRepository implements EventRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(RegistrationEntity) private readonly registrationRows: Repository<RegistrationEntity>,
    @InjectRepository(TeamEntity) private readonly teamRows: Repository<TeamEntity>,
    @InjectRepository(ResultEntity) private readonly resultRows: Repository<ResultEntity>,
    @InjectRepository(FormatEntity) private readonly formats: Repository<FormatEntity>,
  ) {}

  async findById(id: string): Promise<Event | null> {
    if (!isUuid(id)) return null;
    const row = await this.events.findOneBy({ id });
    return row ? toEvent(row) : null;
  }

  async findSummary(id: string): Promise<EventSummary | null> {
    if (!isUuid(id)) return null;
    const [summary] = await this.summaries({ id });
    return summary ?? null;
  }

  async listBySeason(seasonId: string): Promise<EventSummary[]> {
    if (!isUuid(seasonId)) return [];
    return this.summaries({ seasonId });
  }

  async create(event: NewEvent): Promise<Event> {
    return toEvent(await this.events.save(this.events.create({ ...event, status: 'registration', validated: false })));
  }

  async update(id: string, changes: EventChanges): Promise<void> {
    if (Object.keys(changes).length > 0) await this.events.update({ id }, changes);
  }

  async registrations(eventId: string): Promise<Registration[]> {
    const rows = await this.registrationRows.find({ where: { eventId }, relations: { player: true }, order: { createdAt: 'ASC' } });
    return rows.map((row) => ({
      playerId: row.playerId,
      pseudo: row.player?.pseudo ?? '',
      avatarUrl: row.player?.avatarUrl ?? '',
      teamId: row.teamId,
    }));
  }

  async addRegistration(eventId: string, playerId: string): Promise<boolean> {
    const result = await this.registrationRows.createQueryBuilder().insert().values({ eventId, playerId }).orIgnore().execute();
    // ON CONFLICT DO NOTHING : rien n'est renvoyé si le joueur était déjà inscrit.
    return (result.raw as unknown[]).length > 0;
  }

  async removeRegistration(eventId: string, playerId: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      await manager.delete(ResultEntity, { eventId, playerId });
      const { affected } = await manager.delete(RegistrationEntity, { eventId, playerId });
      return (affected ?? 0) > 0;
    });
  }

  async setTeam(eventId: string, playerId: string, teamId: string | null): Promise<void> {
    await this.registrationRows.update({ eventId, playerId }, { teamId });
  }

  async teams(eventId: string): Promise<Team[]> {
    const rows = await this.teamRows.find({ where: { eventId }, order: { name: 'ASC' } });
    return rows.map(({ id, name }) => ({ id, eventId, name }));
  }

  async findTeam(id: string): Promise<Team | null> {
    if (!isUuid(id)) return null;
    const row = await this.teamRows.findOneBy({ id });
    return row ? { id: row.id, eventId: row.eventId, name: row.name } : null;
  }

  async createTeam(eventId: string, name: string): Promise<Team> {
    const row = await this.teamRows.save(this.teamRows.create({ eventId, name }));
    return { id: row.id, eventId, name: row.name };
  }

  async renameTeam(id: string, name: string): Promise<void> {
    await this.teamRows.update({ id }, { name });
  }

  async deleteTeam(id: string): Promise<void> {
    await this.teamRows.delete({ id });
  }

  async results(eventId: string): Promise<EventResult[]> {
    const rows = await this.resultRows.find({ where: { eventId }, order: { place: { direction: 'ASC', nulls: 'LAST' } } });
    return rows.map(({ playerId, place }) => ({ playerId, place }));
  }

  async saveResults(eventId: string, results: EventResult[], close: { finishedAt: Date; formatId: string } | null): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ResultEntity, { eventId });
      if (results.length > 0) await manager.insert(ResultEntity, results.map((result) => ({ ...result, eventId })));
      if (!close) return;
      await manager.update(EventEntity, { id: eventId }, { status: 'finished', finishedAt: close.finishedAt });
      await manager.delete(VoteEntity, { formatId: close.formatId });
      await manager.update(FormatEntity, { id: close.formatId }, { status: 'proposed' });
    });
  }

  async openEventIdsOfFormat(formatId: string): Promise<string[]> {
    const rows = await this.events.find({ select: { id: true }, where: { formatId, status: In([...OPEN_EVENT_STATUSES]) } });
    return rows.map((row) => row.id);
  }

  async setFormatStatus(formatId: string, status: FormatStatus): Promise<void> {
    await this.formats.update({ id: formatId }, { status });
  }

  async lastFinishedMain(): Promise<Event | null> {
    const row = await this.events.findOne({
      where: { type: 'main', status: 'finished', finishedAt: Not(IsNull()) },
      order: { finishedAt: 'DESC' },
    });
    return row ? toEvent(row) : null;
  }

  async openMain(): Promise<EventSummary | null> {
    const [summary] = await this.summaries({ type: 'main', open: true });
    return summary ?? null;
  }

  async pendingChoiceId(): Promise<string | null> {
    const [row] = (await this.dataSource.query(PENDING_CHOICE)) as { id: string }[];
    return row?.id ?? null;
  }

  async choose(formatId: string): Promise<boolean> {
    if (!isUuid(formatId)) return false;
    return this.dataSource.transaction(async (manager) => {
      await manager.query(CHOICE_LOCK);
      if ((await manager.query(PENDING_CHOICE)).length > 0) return false;
      const { affected } = await manager.update(FormatEntity, { id: formatId, status: 'proposed' }, { status: 'selected' });
      return (affected ?? 0) > 0;
    });
  }

  /** Events avec leur format, leur jeu, leur hôte et le nombre d'inscrits. */
  private async summaries(filter: { id?: string; seasonId?: string; type?: 'main'; open?: boolean }): Promise<EventSummary[]> {
    const query = this.events
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.format', 'f')
      .innerJoinAndSelect('f.game', 'g')
      .leftJoinAndSelect('e.host', 'h')
      .orderBy('e.announceDate', 'ASC');
    if (filter.id) query.andWhere('e.id = :id', { id: filter.id });
    if (filter.seasonId) query.andWhere('e.season_id = :seasonId', { seasonId: filter.seasonId });
    if (filter.type) query.andWhere('e.type = :type', { type: filter.type });
    if (filter.open) query.andWhere('e.status IN (:...open)', { open: [...OPEN_EVENT_STATUSES] });
    const rows = await query.getMany();
    const counts = new Map<string, number>();
    if (rows.length > 0) {
      const raw: { event_id: string; count: number }[] = await this.registrationRows
        .createQueryBuilder('r')
        .select('r.event_id', 'event_id')
        .addSelect('count(*)::int', 'count')
        .where('r.event_id IN (:...ids)', { ids: rows.map((row) => row.id) })
        .groupBy('r.event_id')
        .getRawMany();
      for (const { event_id, count } of raw) counts.set(event_id, count);
    }
    return rows.map((row) => {
      const format = row.format as FormatEntity;
      const game = format.game as NonNullable<FormatEntity['game']>;
      return {
        ...toEvent(row),
        format: {
          id: format.id,
          name: format.name,
          description: format.description,
          teamMode: format.teamMode,
          playMode: format.playMode,
          status: format.status,
        },
        game: { id: game.id, name: game.name, coverUrl: game.coverUrl, coverFile: game.coverFile },
        host: row.host ? { id: row.host.id, pseudo: row.host.pseudo } : null,
        registrationCount: counts.get(row.id) ?? 0,
      };
    });
  }
}
