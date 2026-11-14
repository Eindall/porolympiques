/**
 * Variables d'environnement requises. Le démarrage échoue immédiatement, avec un message clair,
 * si l'une d'elles manque ou est invalide, plutôt que de planter plus tard.
 */
const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'APP_URL',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_REDIRECT_URI',
  'DISCORD_BOT_TOKEN',
  'DISCORD_GUILD_ID',
  'DISCORD_ADMIN_IDS',
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET',
] as const;

const SNOWFLAKE = /^\d{17,20}$/;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  }
  if (String(config['JWT_SECRET']).length < 32) {
    throw new Error('JWT_SECRET doit faire au moins 32 caractères (ex. `openssl rand -hex 32`).');
  }
  const appUrl = String(config['APP_URL']);
  if (!/^https?:\/\/[^/]+(\/.*[^/])?$/.test(appUrl)) {
    throw new Error(`APP_URL doit être une URL http(s) sans slash final : ${appUrl}`);
  }
  if (!SNOWFLAKE.test(String(config['DISCORD_GUILD_ID']))) {
    throw new Error('DISCORD_GUILD_ID doit être un identifiant Discord (nombre de 17 à 20 chiffres).');
  }
  parseAdminIds(String(config['DISCORD_ADMIN_IDS']));
  return config;
}

/** `DISCORD_ADMIN_IDS` : identifiants Discord séparés par des virgules (au moins un). */
export function parseAdminIds(value: string): Set<string> {
  const ids = value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const invalid = ids.filter((id) => !SNOWFLAKE.test(id));
  if (ids.length === 0 || invalid.length > 0) {
    throw new Error(
      `DISCORD_ADMIN_IDS doit lister des identifiants Discord séparés par des virgules${invalid.length ? ` (invalides : ${invalid.join(', ')})` : ''}.`,
    );
  }
  return new Set(ids);
}
