/**
 * Forme normalisée d'un nom ou d'une recherche : minuscules, sans accents, espaces réduits.
 * Sert de clé au cache de recherche et à la détection des doublons (« Pokémon » = « pokemon »).
 */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nom saisi par un joueur, nettoyé pour l'affichage : espaces réduits et retirés aux bords. */
export function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
