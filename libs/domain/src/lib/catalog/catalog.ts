/** Origine d'un jeu : le catalogue IGDB, ou une saisie libre pour les idées hors catalogue. */
export type GameSource = 'igdb' | 'custom';

/** Tranche de prix, choisie à la main par celui qui suggère. */
export type PriceTier = 'free' | 'lt10' | '10to30' | 'gt30';

export type TeamMode = 'solo' | 'team';
export type PlayMode = 'async' | 'live';

/** Un format repasse en `proposed` une fois joué. « Joué N fois » se calcule à partir des events terminés. */
export type FormatStatus = 'proposed' | 'selected';
