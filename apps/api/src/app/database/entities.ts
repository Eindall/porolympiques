import type { DataSourceOptions } from 'typeorm';

/**
 * Liste explicite des entités (pas de glob : le bundle webpack n'a pas de système de fichiers).
 * Remplie à partir de la phase 2 (`Player`).
 */
export const ENTITIES: NonNullable<DataSourceOptions['entities']> = [];
