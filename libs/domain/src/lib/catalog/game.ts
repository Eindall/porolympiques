import type { GameSource, PriceTier } from './catalog';

/** Un jeu enregistré : du catalogue (déjà suggéré au moins une fois) ou saisi librement. */
export interface Game {
  id: string;
  source: GameSource;
  /** Identifiant dans le catalogue externe ; vide pour un jeu saisi librement. */
  externalId: string | null;
  name: string;
  coverUrl: string | null;
  /** Fixée par le premier qui suggère un format pour ce jeu, corrigeable par l'admin. */
  priceTier: PriceTier | null;
  /** Joueur qui a enregistré le jeu. Pour un jeu saisi librement, lui (et l'admin) gère son nom et son image. */
  createdById: string | null;
  /** Image envoyée pour un jeu saisi librement : nom du fichier dans le stockage. */
  coverFile: string | null;
}

export type NewGame = Omit<Game, 'id' | 'coverFile'>;
export type GameChanges = Partial<Pick<Game, 'name' | 'priceTier' | 'coverFile'>>;

/** Un jeu tel que le catalogue externe le décrit (pas forcément enregistré chez nous). */
export interface CatalogGame {
  externalId: string;
  name: string;
  coverUrl: string | null;
  /** Année de première sortie. */
  year: number | null;
}

/** Un résultat d'autocomplete : un jeu déjà enregistré (`gameId`), ou un jeu du catalogue pas encore suggéré. */
export interface GameSearchResult {
  gameId: string | null;
  source: GameSource;
  externalId: string | null;
  name: string;
  coverUrl: string | null;
  year: number | null;
  priceTier: PriceTier | null;
  /** Image envoyée (jeu saisi librement déjà enregistré). */
  coverFile: string | null;
}
