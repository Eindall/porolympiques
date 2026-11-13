import type { ValueTransformer } from 'typeorm';

/** Le driver pg renvoie les colonnes `numeric` en chaîne (pour ne rien perdre en précision) : on les relit en nombre. */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
