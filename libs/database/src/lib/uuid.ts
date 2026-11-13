const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Évite qu'un identifiant mal formé fasse planter la requête Postgres (colonne uuid). */
export const isUuid = (value: string) => UUID.test(value);
