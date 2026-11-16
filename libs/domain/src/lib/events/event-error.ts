export type EventErrorCode =
  /** Saison, event, équipe, joueur ou format introuvable. */
  | 'not_found'
  /** Réservé à l'admin, ou au vainqueur pour le choix du jeu. */
  | 'forbidden'
  /** Saisie invalide (dates dans le désordre, place négative…). */
  | 'invalid'
  /** Inscriptions fermées, event terminé ou annulé, délai de choix passé. */
  | 'closed'
  /** Déjà inscrit, saison déjà active, format déjà retenu, jeu déjà choisi… */
  | 'conflict';

/** Refus d'une règle des saisons et des events, avec un message en français prêt à afficher. */
export class EventError extends Error {
  constructor(
    readonly code: EventErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EventError';
  }
}
