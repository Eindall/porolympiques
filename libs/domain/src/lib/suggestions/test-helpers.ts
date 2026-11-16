import type { InMemoryPlayers } from '../players/test-helpers';
import type { NewSuggestion, Suggestion, SuggestionChanges, SuggestionDetail, SuggestionFilters, SuggestionVoteValue } from './suggestion';
import type { SuggestionRepository } from './suggestion.repository';

/** Faux port en mémoire, pour les tests du domaine uniquement. L'horloge avance d'une minute à chaque écriture. */
export class InMemorySuggestions implements SuggestionRepository {
  rows = new Map<string, Suggestion>();
  /** `suggestionId/playerId` → vote. */
  votes = new Map<string, SuggestionVoteValue>();
  private next = 1;
  private clock = new Date('2026-03-01T12:00:00Z').getTime();

  constructor(private readonly players: InMemoryPlayers) {}

  async list(viewerId: string, filters: SuggestionFilters) {
    return [...this.rows.values()]
      .filter((row) => (!filters.category || row.category === filters.category) && (!filters.status || row.status === filters.status))
      .map((row) => this.detail(row, viewerId));
  }
  async find(id: string, viewerId: string) {
    const row = this.rows.get(id);
    return row ? this.detail(row, viewerId) : null;
  }
  async create(suggestion: NewSuggestion) {
    const now = this.tick();
    const created: Suggestion = { ...suggestion, id: `sg-${this.next++}`, status: 'proposed', createdAt: now, updatedAt: now };
    this.rows.set(created.id, created);
    return created;
  }
  async update(id: string, changes: SuggestionChanges) {
    this.rows.set(id, { ...(this.rows.get(id) as Suggestion), ...changes, updatedAt: this.tick() });
  }
  async delete(id: string) {
    this.rows.delete(id);
    for (const key of [...this.votes.keys()]) if (key.startsWith(`${id}/`)) this.votes.delete(key);
  }
  async setVote(suggestionId: string, playerId: string, value: SuggestionVoteValue | null) {
    if (value === null) this.votes.delete(`${suggestionId}/${playerId}`);
    else this.votes.set(`${suggestionId}/${playerId}`, value);
  }

  private tick(): Date {
    this.clock += 60_000;
    return new Date(this.clock);
  }

  private detail(row: Suggestion, viewerId: string): SuggestionDetail {
    const votes = [...this.votes.entries()].filter(([key]) => key.startsWith(`${row.id}/`)).map(([, value]) => value);
    return {
      ...row,
      author: { id: row.authorId, pseudo: this.players.rows.get(row.authorId)?.pseudo ?? row.authorId },
      upvotes: votes.filter((value) => value === 1).length,
      downvotes: votes.filter((value) => value === -1).length,
      myVote: this.votes.get(`${row.id}/${viewerId}`) ?? null,
    };
  }
}
