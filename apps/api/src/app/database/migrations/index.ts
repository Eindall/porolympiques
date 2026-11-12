import type { DataSourceOptions } from 'typeorm';

/** Liste explicite des migrations, dans l'ordre. À compléter à chaque `migration:generate`. */
export const MIGRATIONS: NonNullable<DataSourceOptions['migrations']> = [];
