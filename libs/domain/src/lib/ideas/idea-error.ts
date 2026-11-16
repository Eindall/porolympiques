export type IdeaErrorCode =
  /** Idée ou jeu introuvable. */
  | 'not_found'
  /** Réservé à l'admin. */
  | 'forbidden'
  /** Saisie invalide (nom vide…). */
  | 'invalid'
  /** Le jeu n'a pas encore de tranche de prix : il faut la choisir. */
  | 'price_tier_required'
  /** Un format de ce nom existe déjà pour ce jeu. */
  | 'duplicate'
  /** Format retenu pour un event : votes gelés. */
  | 'votes_frozen'
  /** Format joué ou prévu dans un event : suppression impossible. */
  | 'in_use'
  /** Le catalogue externe n'a pas répondu. */
  | 'catalog_unavailable'
  /** Image de plus de 2 Mo. */
  | 'file_too_large'
  /** Fichier qui n'est ni un PNG, ni un JPEG, ni un WebP. */
  | 'unsupported_file';

/** Refus d'une règle de la boîte à idées, avec un message en français prêt à afficher. */
export class IdeaError extends Error {
  constructor(
    readonly code: IdeaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'IdeaError';
  }
}
