import type { Format, FormatChanges, Idea, IdeaFilters, NewFormat } from './idea';

/** Port de persistance des formats et de leurs votes (implémenté par la lib `database`). */
export interface IdeaRepository {
  /** Les idées qui passent les filtres, vues par `viewerId` (pour `votedByMe`). Ordre quelconque. */
  list(viewerId: string, filters: IdeaFilters): Promise<Idea[]>;
  findIdea(id: string, viewerId: string): Promise<Idea | null>;
  findFormat(id: string): Promise<Format | null>;
  formatsOfGame(gameId: string): Promise<Format[]>;
  /** Crée le format et le vote de son auteur, ensemble. */
  createWithVote(format: NewFormat, voterId: string): Promise<Format>;
  updateFormat(id: string, changes: FormatChanges): Promise<void>;
  deleteFormat(id: string): Promise<void>;
  /** Vrai si un event (quel que soit son statut) est joué sur ce format. */
  isUsedByEvent(formatId: string): Promise<boolean>;
  /** Sans effet si le vote existe déjà. */
  addVote(playerId: string, formatId: string): Promise<void>;
  /** Sans effet s'il n'y a pas de vote. */
  removeVote(playerId: string, formatId: string): Promise<void>;
}

export const IDEA_REPOSITORY = Symbol('IdeaRepository');
