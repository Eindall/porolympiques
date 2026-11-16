import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type {
  NewSuggestion,
  Suggestion,
  SuggestionChanges,
  SuggestionDetail,
  SuggestionFilters,
  SuggestionRepository,
  SuggestionVoteValue,
} from '@porolympiques/domain';
import { DataSource, Repository } from 'typeorm';
import { isUuid } from '../uuid';
import { SuggestionVoteEntity } from './suggestion-vote.entity';
import { SuggestionEntity } from './suggestion.entity';

/** Une ligne de la requête des suggestions : la suggestion, son auteur et ses votes. */
interface SuggestionRow {
  id: string;
  author_id: string;
  title: string;
  description: string;
  category: Suggestion['category'];
  status: Suggestion['status'];
  created_at: Date;
  updated_at: Date;
  author_pseudo: string;
  upvotes: number;
  downvotes: number;
  my_vote: SuggestionVoteValue | null;
}

const SUGGESTIONS_QUERY = `
  SELECT s.id, s.author_id, s.title, s.description, s.category, s.status, s.created_at, s.updated_at,
         p.pseudo AS author_pseudo,
         (SELECT count(*) FROM suggestion_votes v WHERE v.suggestion_id = s.id AND v.value = 1)::int AS upvotes,
         (SELECT count(*) FROM suggestion_votes v WHERE v.suggestion_id = s.id AND v.value = -1)::int AS downvotes,
         (SELECT v.value FROM suggestion_votes v WHERE v.suggestion_id = s.id AND v.player_id = $1)::int AS my_vote
    FROM suggestions s
    JOIN players p ON p.id = s.author_id
   WHERE ($2::text IS NULL OR s.category = $2)
     AND ($3::text IS NULL OR s.status = $3)
     AND ($4::uuid IS NULL OR s.id = $4)`;

function toDetail(row: SuggestionRow): SuggestionDetail {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: { id: row.author_id, pseudo: row.author_pseudo },
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    myVote: row.my_vote === 1 || row.my_vote === -1 ? row.my_vote : null,
  };
}

@Injectable()
export class TypeOrmSuggestionRepository implements SuggestionRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SuggestionEntity) private readonly suggestions: Repository<SuggestionEntity>,
    @InjectRepository(SuggestionVoteEntity) private readonly votes: Repository<SuggestionVoteEntity>,
  ) {}

  async list(viewerId: string, filters: SuggestionFilters): Promise<SuggestionDetail[]> {
    return this.query(viewerId, filters, null);
  }

  async find(id: string, viewerId: string): Promise<SuggestionDetail | null> {
    if (!isUuid(id)) return null;
    const [suggestion] = await this.query(viewerId, {}, id);
    return suggestion ?? null;
  }

  async create(suggestion: NewSuggestion): Promise<Suggestion> {
    const row = await this.suggestions.save(this.suggestions.create(suggestion));
    return {
      id: row.id,
      authorId: row.authorId,
      title: row.title,
      description: row.description,
      category: row.category,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async update(id: string, changes: SuggestionChanges): Promise<void> {
    await this.suggestions.update({ id }, changes);
  }

  async delete(id: string): Promise<void> {
    await this.suggestions.delete({ id });
  }

  async setVote(suggestionId: string, playerId: string, value: SuggestionVoteValue | null): Promise<void> {
    if (value === null) await this.votes.delete({ suggestionId, playerId });
    else await this.votes.upsert({ suggestionId, playerId, value }, ['suggestionId', 'playerId']);
  }

  private async query(viewerId: string, filters: SuggestionFilters, id: string | null): Promise<SuggestionDetail[]> {
    const rows: SuggestionRow[] = await this.dataSource.query(SUGGESTIONS_QUERY, [viewerId, filters.category ?? null, filters.status ?? null, id]);
    return rows.map(toDetail);
  }
}
