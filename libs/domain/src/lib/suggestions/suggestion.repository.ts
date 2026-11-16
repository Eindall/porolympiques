import type { NewSuggestion, Suggestion, SuggestionChanges, SuggestionDetail, SuggestionFilters, SuggestionVoteValue } from './suggestion';

/** Port de persistance des suggestions et de leurs votes (implémenté par la lib `database`). */
export interface SuggestionRepository {
  /** Les suggestions qui passent les filtres, vues par `viewerId` (pour `myVote`). Ordre quelconque. */
  list(viewerId: string, filters: SuggestionFilters): Promise<SuggestionDetail[]>;
  find(id: string, viewerId: string): Promise<SuggestionDetail | null>;
  create(suggestion: NewSuggestion): Promise<Suggestion>;
  update(id: string, changes: SuggestionChanges): Promise<void>;
  /** Supprime aussi ses votes. */
  delete(id: string): Promise<void>;
  /** Pose ou change le vote du joueur ; `null` le retire (sans effet s'il n'y en a pas). */
  setVote(suggestionId: string, playerId: string, value: SuggestionVoteValue | null): Promise<void>;
}

export const SUGGESTION_REPOSITORY = Symbol('SuggestionRepository');
