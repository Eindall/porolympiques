export const PRICE_TIERS = ['free', 'lt10', '10to30', 'gt30'] as const;
export const TEAM_MODES = ['solo', 'team'] as const;
export const PLAY_MODES = ['async', 'live'] as const;

export type PriceTierDto = (typeof PRICE_TIERS)[number];
export type TeamModeDto = (typeof TEAM_MODES)[number];
export type PlayModeDto = (typeof PLAY_MODES)[number];
export type GameSourceDto = 'igdb' | 'custom';
export type FormatStatusDto = 'proposed' | 'selected';

/** Libellés français, partagés par les pages et (plus tard) le bot. */
export const PRICE_TIER_LABELS: Record<PriceTierDto, string> = {
  free: 'Gratuit',
  lt10: 'Moins de 10 €',
  '10to30': '10 à 30 €',
  gt30: 'Plus de 30 €',
};
export const TEAM_MODE_LABELS: Record<TeamModeDto, string> = { solo: 'Solo', team: 'Équipe' };
export const PLAY_MODE_LABELS: Record<PlayModeDto, string> = { async: 'Asynchrone', live: 'Live' };

/** Image d'un jeu saisi librement : 2 Mo au plus, PNG, JPEG ou WebP (vérifié aussi côté serveur, sur le contenu). */
export const COVER_MAX_BYTES = 2 * 1024 * 1024;
export const COVER_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Un jeu proposé par l'autocomplete : déjà enregistré (`gameId`) ou seulement présent dans le catalogue. */
export interface GameSearchResultDto {
  gameId: string | null;
  source: GameSourceDto;
  externalId: string | null;
  name: string;
  coverUrl: string | null;
  year: number | null;
  priceTier: PriceTierDto | null;
}

/** Réponse de `GET /api/catalog/games?q=`. */
export interface GameSearchDto {
  results: GameSearchResultDto[];
  /** Faux si le catalogue n'a pas répondu : seuls les jeux déjà enregistrés sont proposés. */
  catalogAvailable: boolean;
}

export interface GameDto {
  id: string;
  source: GameSourceDto;
  name: string;
  /** Jaquette IGDB, ou image envoyée (servie par l'API). */
  coverUrl: string | null;
  priceTier: PriceTierDto | null;
  /** Le joueur connecté peut renommer ce jeu et changer son image (jeu saisi librement, par son créateur ou l'admin). */
  canEdit: boolean;
}

/** Une idée de la boîte à idées : un format d'un jeu. */
export interface IdeaDto {
  id: string;
  game: GameDto;
  name: string;
  description: string;
  teamMode: TeamModeDto;
  playMode: PlayModeDto;
  /** `selected` : retenu pour un event, votes gelés. */
  status: FormatStatusDto;
  suggestedBy: { id: string; pseudo: string } | null;
  votes: number;
  votedByMe: boolean;
  /** « Joué N fois ». */
  playedCount: number;
  /** ISO 8601, UTC. */
  createdAt: string;
  /** Le joueur connecté peut modifier ce format : l'admin, ou l'auteur tant qu'il n'est pas retenu. */
  canEdit: boolean;
}

export type GameChoiceDto =
  | { kind: 'existing'; gameId: string }
  | { kind: 'catalog'; externalId: string }
  | { kind: 'custom'; name: string };

/** Corps de `POST /api/ideas`. */
export interface SuggestIdeaRequest {
  game: GameChoiceDto;
  /** Obligatoire seulement si le jeu n'a pas encore de tranche de prix. */
  priceTier?: PriceTierDto | null;
  name: string;
  description?: string;
  teamMode: TeamModeDto;
  playMode: PlayModeDto;
}

/** Corps de `PATCH /api/ideas/:id` (auteur ou admin ; `priceTier` réservé à l'admin). */
export interface UpdateIdeaRequest {
  name?: string;
  description?: string;
  teamMode?: TeamModeDto;
  playMode?: PlayModeDto;
  priceTier?: PriceTierDto;
  /** Seulement pour un jeu saisi librement. */
  gameName?: string;
}

export type IdeaErrorCodeDto =
  | 'not_found'
  | 'forbidden'
  | 'invalid'
  | 'price_tier_required'
  | 'duplicate'
  | 'votes_frozen'
  | 'in_use'
  | 'catalog_unavailable'
  | 'file_too_large'
  | 'unsupported_file';

/** Corps d'une erreur de la boîte à idées : `message` est en français, prêt à afficher. */
export interface IdeaErrorDto {
  statusCode: number;
  code: IdeaErrorCodeDto;
  message: string;
}
