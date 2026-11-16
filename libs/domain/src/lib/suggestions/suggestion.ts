export const SUGGESTION_CATEGORIES = ['format', 'site', 'bot', 'process'] as const;
export const SUGGESTION_STATUSES = ['proposed', 'planned', 'done'] as const;

export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

/** `planned` : dans la roadmap. */
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/** Vote pour (+1) ou contre (-1). Le score d'une suggestion est la somme des votes. */
export type SuggestionVoteValue = 1 | -1;

export const SUGGESTION_TITLE_MAX = 150;
export const SUGGESTION_DESCRIPTION_MAX = 2000;

/** Une amélioration proposée par un joueur. */
export interface Suggestion {
  id: string;
  authorId: string;
  title: string;
  description: string;
  category: SuggestionCategory;
  status: SuggestionStatus;
  createdAt: Date;
  /** Dernière modification du texte ou du statut (pas des votes) : sert d'ordre pour les livrées. */
  updatedAt: Date;
}

export type NewSuggestion = Pick<Suggestion, 'authorId' | 'title' | 'description' | 'category'>;
export type SuggestionChanges = Partial<Pick<Suggestion, 'title' | 'description' | 'category' | 'status'>>;

/** Une suggestion avec son auteur et ses votes, vue par un joueur. */
export interface SuggestionDetail extends Suggestion {
  author: { id: string; pseudo: string };
  upvotes: number;
  downvotes: number;
  /** Le vote du joueur qui consulte. */
  myVote: SuggestionVoteValue | null;
}

/** Ce que le joueur qui consulte peut faire. */
export interface SuggestionView extends SuggestionDetail {
  score: number;
  canEdit: boolean;
  canDelete: boolean;
  canVote: boolean;
}

export interface SuggestionFilters {
  category?: SuggestionCategory;
  status?: SuggestionStatus;
}
