export type SuggestionErrorCode =
  /** Suggestion introuvable. */
  | 'not_found'
  /** Réservé à l'admin, ou à l'auteur tant que la suggestion est proposée. */
  | 'forbidden'
  /** Saisie invalide (titre vide…). */
  | 'invalid'
  /** Suggestion livrée : votes figés. */
  | 'votes_frozen';

/** Refus d'une règle des suggestions, avec un message en français prêt à afficher. */
export class SuggestionError extends Error {
  constructor(
    readonly code: SuggestionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SuggestionError';
  }
}
