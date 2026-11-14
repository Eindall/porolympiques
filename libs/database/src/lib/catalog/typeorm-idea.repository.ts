import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { Format, FormatChanges, Idea, IdeaFilters, IdeaRepository, NewFormat } from '@porolympiques/domain';
import { DataSource, Repository } from 'typeorm';
import { EventEntity } from '../events/event.entity';
import { isUuid } from '../uuid';
import { FormatEntity } from './format.entity';
import { VoteEntity } from './vote.entity';

function toFormat(row: FormatEntity): Format {
  return {
    id: row.id,
    gameId: row.gameId,
    name: row.name,
    description: row.description,
    teamMode: row.teamMode,
    playMode: row.playMode,
    status: row.status,
    suggestedById: row.suggestedById,
    createdAt: row.createdAt,
  };
}

/** Une ligne de la requête des idées : le format, son jeu, son auteur et ses compteurs. */
interface IdeaRow {
  id: string;
  game_id: string;
  name: string;
  description: string;
  team_mode: Idea['teamMode'];
  play_mode: Idea['playMode'];
  status: Idea['status'];
  suggested_by: string | null;
  created_at: Date;
  game_source: Idea['game']['source'];
  game_external_id: string | null;
  game_name: string;
  game_cover_url: string | null;
  game_price_tier: Idea['game']['priceTier'];
  game_created_by: string | null;
  game_cover_file: string | null;
  author_pseudo: string | null;
  votes: number;
  voted_by_me: boolean;
  played_count: number;
}

const IDEAS_QUERY = `
  SELECT f.id, f.game_id, f.name, f.description, f.team_mode, f.play_mode, f.status, f.suggested_by, f.created_at,
         g.source AS game_source, g.external_id AS game_external_id, g.name AS game_name,
         g.cover_url AS game_cover_url, g.price_tier AS game_price_tier,
         g.created_by AS game_created_by, g.cover_file AS game_cover_file,
         p.pseudo AS author_pseudo,
         (SELECT count(*) FROM votes v WHERE v.format_id = f.id)::int AS votes,
         EXISTS (SELECT 1 FROM votes v WHERE v.format_id = f.id AND v.player_id = $1) AS voted_by_me,
         (SELECT count(*) FROM events e WHERE e.format_id = f.id AND e.status = 'finished')::int AS played_count
    FROM formats f
    JOIN games g ON g.id = f.game_id
    LEFT JOIN players p ON p.id = f.suggested_by
   WHERE ($2::uuid IS NULL OR f.game_id = $2)
     AND ($3::text IS NULL OR g.price_tier = $3)
     AND ($4::text IS NULL OR f.team_mode = $4)
     AND ($5::text IS NULL OR f.play_mode = $5)
     AND ($6::uuid IS NULL OR f.id = $6)`;

function toIdea(row: IdeaRow): Idea {
  return {
    id: row.id,
    gameId: row.game_id,
    name: row.name,
    description: row.description,
    teamMode: row.team_mode,
    playMode: row.play_mode,
    status: row.status,
    suggestedById: row.suggested_by,
    createdAt: row.created_at,
    game: {
      id: row.game_id,
      source: row.game_source,
      externalId: row.game_external_id,
      name: row.game_name,
      coverUrl: row.game_cover_url,
      priceTier: row.game_price_tier,
      createdById: row.game_created_by,
      coverFile: row.game_cover_file,
    },
    suggestedBy: row.suggested_by && row.author_pseudo ? { id: row.suggested_by, pseudo: row.author_pseudo } : null,
    votes: row.votes,
    votedByMe: row.voted_by_me,
    playedCount: row.played_count,
  };
}

@Injectable()
export class TypeOrmIdeaRepository implements IdeaRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(FormatEntity) private readonly formats: Repository<FormatEntity>,
    @InjectRepository(VoteEntity) private readonly votes: Repository<VoteEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
  ) {}

  async list(viewerId: string, filters: IdeaFilters): Promise<Idea[]> {
    if (filters.gameId !== undefined && !isUuid(filters.gameId)) return [];
    return this.query(viewerId, filters, null);
  }

  async findIdea(id: string, viewerId: string): Promise<Idea | null> {
    if (!isUuid(id)) return null;
    const [idea] = await this.query(viewerId, {}, id);
    return idea ?? null;
  }

  async findFormat(id: string): Promise<Format | null> {
    if (!isUuid(id)) return null;
    const row = await this.formats.findOneBy({ id });
    return row ? toFormat(row) : null;
  }

  async formatsOfGame(gameId: string): Promise<Format[]> {
    return (await this.formats.findBy({ gameId })).map(toFormat);
  }

  async createWithVote(format: NewFormat, voterId: string): Promise<Format> {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager.save(manager.create(FormatEntity, format));
      await manager.insert(VoteEntity, { playerId: voterId, formatId: row.id });
      return toFormat(row);
    });
  }

  async updateFormat(id: string, changes: FormatChanges): Promise<void> {
    await this.formats.update({ id }, changes);
  }

  async deleteFormat(id: string): Promise<void> {
    await this.formats.delete({ id });
  }

  async isUsedByEvent(formatId: string): Promise<boolean> {
    return this.events.existsBy({ formatId });
  }

  async addVote(playerId: string, formatId: string): Promise<void> {
    await this.votes.createQueryBuilder().insert().values({ playerId, formatId }).orIgnore().execute();
  }

  async removeVote(playerId: string, formatId: string): Promise<void> {
    await this.votes.delete({ playerId, formatId });
  }

  private async query(viewerId: string, filters: IdeaFilters, formatId: string | null): Promise<Idea[]> {
    const rows: IdeaRow[] = await this.dataSource.query(IDEAS_QUERY, [
      viewerId,
      filters.gameId ?? null,
      filters.priceTier ?? null,
      filters.teamMode ?? null,
      filters.playMode ?? null,
      formatId,
    ]);
    return rows.map(toIdea);
  }
}
