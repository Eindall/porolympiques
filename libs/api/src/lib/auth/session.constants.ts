export const SESSION_COOKIE = 'poro_session';
export const OAUTH_STATE_COOKIE = 'poro_oauth_state';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Une session expire après cette durée sans usage (expiration glissante : chaque usage la repousse). */
export const SESSION_IDLE_TTL_MS = 14 * DAY_MS;
/** Plafond absolu : passé cet âge, il faut repasser par Discord, même en venant tous les jours. */
export const SESSION_ABSOLUTE_MAX_MS = 60 * DAY_MS;
/** L'expiration n'est repoussée qu'au plus tous les… : évite une écriture en base par requête. */
export const SESSION_TOUCH_INTERVAL_MS = 10 * MINUTE_MS;
/** Sessions actives simultanées par joueur ; à la suivante, la plus ancienne est révoquée. */
export const MAX_ACTIVE_SESSIONS = 10;
/** Les sessions révoquées depuis plus longtemps sont supprimées par le nettoyage. */
export const REVOKED_RETENTION_MS = 7 * DAY_MS;
export const CLEANUP_INTERVAL_MS = 6 * HOUR_MS;
export const OAUTH_STATE_MAX_AGE_MS = 10 * MINUTE_MS;
