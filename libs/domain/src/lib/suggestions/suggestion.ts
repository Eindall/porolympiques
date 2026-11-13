export type SuggestionCategory = 'format' | 'site' | 'bot' | 'process';

/** `planned` : dans la roadmap. */
export type SuggestionStatus = 'proposed' | 'planned' | 'done';

/** Vote pour (+1) ou contre (-1). Le score d'une suggestion est la somme des votes. */
export type SuggestionVoteValue = 1 | -1;
