import type { FormatStatus, PlayMode, PriceTier, TeamMode } from '../catalog/catalog';
import type { Game } from '../catalog/game';

/** Un format d'un jeu : l'idée qu'on upvote dans la boîte à idées. */
export interface Format {
  id: string;
  gameId: string;
  name: string;
  description: string;
  teamMode: TeamMode;
  playMode: PlayMode;
  status: FormatStatus;
  suggestedById: string | null;
  createdAt: Date;
}

export type NewFormat = Omit<Format, 'id' | 'status' | 'createdAt'>;
export type FormatChanges = Partial<Pick<Format, 'name' | 'description' | 'teamMode' | 'playMode'>>;

/** Une idée telle qu'un joueur la voit dans la liste. */
export interface Idea extends Format {
  game: Game;
  suggestedBy: { id: string; pseudo: string } | null;
  votes: number;
  /** Le joueur qui consulte a voté pour ce format. */
  votedByMe: boolean;
  /** Nombre d'events terminés joués sur ce format (« Joué N fois »). */
  playedCount: number;
}

/** Une idée, avec ce que le joueur qui la consulte a le droit d'en faire. */
export interface IdeaView extends Idea {
  /** Modifier le format : l'admin, ou l'auteur tant que le format n'est pas retenu. */
  canEdit: boolean;
  /** Renommer le jeu et changer son image : jeu saisi librement, par son créateur ou l'admin. */
  canEditGame: boolean;
}

export interface IdeaFilters {
  gameId?: string;
  priceTier?: PriceTier;
  teamMode?: TeamMode;
  playMode?: PlayMode;
}
