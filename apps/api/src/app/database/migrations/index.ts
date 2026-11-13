import type { DataSourceOptions } from 'typeorm';
import { Players1794566338671 } from './1794566338671-Players';
import { SeasonsEventsCatalog1794594331257 } from './1794594331257-SeasonsEventsCatalog';

/** Liste explicite des migrations, dans l'ordre. À compléter à chaque `migration:generate`. */
export const MIGRATIONS: NonNullable<DataSourceOptions['migrations']> = [
  Players1794566338671,
  SeasonsEventsCatalog1794594331257,
];
