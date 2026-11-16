import type { PlayerRefDto } from './events';

export const SUGGESTION_CATEGORIES = ['format', 'site', 'bot', 'process'] as const;
export const SUGGESTION_STATUSES = ['proposed', 'planned', 'done'] as const;

export type SuggestionCategoryDto = (typeof SUGGESTION_CATEGORIES)[number];
/** `planned` : dans la roadmap. */
export type SuggestionStatusDto = (typeof SUGGESTION_STATUSES)[number];
export type SuggestionVoteDto = 1 | -1;

export const SUGGESTION_TITLE_MAX = 150;
export const SUGGESTION_DESCRIPTION_MAX = 2000;

export const SUGGESTION_CATEGORY_LABELS: Record<SuggestionCategoryDto, string> = {
  format: 'Format',
  site: 'Site',
  bot: 'Bot',
  process: 'Organisation',
};
export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatusDto, string> = {
  proposed: 'Proposée',
  planned: 'Dans la roadmap',
  done: 'Livrée',
};

/** Une suggestion d'amélioration, vue par le joueur connecté. Dates en ISO 8601, UTC. */
export interface SuggestionDto {
  id: string;
  title: string;
  description: string;
  category: SuggestionCategoryDto;
  status: SuggestionStatusDto;
  author: PlayerRefDto;
  upvotes: number;
  downvotes: number;
  /** Pour moins contre. */
  score: number;
  myVote: SuggestionVoteDto | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
  canVote: boolean;
}

/** Réponse de `GET /api/suggestions/roadmap`. */
export interface RoadmapDto {
  /** Dans la roadmap, par score. */
  planned: SuggestionDto[];
  /** Livrées, les plus récentes d'abord. */
  done: SuggestionDto[];
}

/** Corps de `POST /api/suggestions` ; `PATCH /api/suggestions/:id` accepte les mêmes champs, tous facultatifs. */
export interface SuggestionRequest {
  title: string;
  description?: string;
  category: SuggestionCategoryDto;
}

export type SuggestionErrorCodeDto = 'not_found' | 'forbidden' | 'invalid' | 'votes_frozen';

export interface SuggestionErrorDto {
  statusCode: number;
  code: SuggestionErrorCodeDto;
  message: string;
}
