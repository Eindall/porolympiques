import type { DataSourceOptions } from 'typeorm';
import { Players1794566338671 } from './1794566338671-Players';
import { SeasonsEventsCatalog1794594331257 } from './1794594331257-SeasonsEventsCatalog';
import { GameSearchName1794595906591 } from './1794595906591-GameSearchName';
import { GameCover1794597246854 } from './1794597246854-GameCover';

/** Liste explicite des migrations, dans l'ordre. À compléter à chaque `migration:generate`. */
export const MIGRATIONS: NonNullable<DataSourceOptions['migrations']> = [
  Players1794566338671,
  SeasonsEventsCatalog1794594331257,
  GameSearchName1794595906591,
  GameCover1794597246854,
];
