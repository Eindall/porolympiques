/**
 * Variables d'environnement requises. Le démarrage échoue immédiatement, avec un message clair,
 * si l'une d'elles manque ou est invalide, plutôt que de planter plus tard.
 *
 * Phase 1 : seulement la base, le secret de session et l'URL publique. Les variables Discord et IGDB
 * (voir `.env.example`) deviendront obligatoires dans les phases qui s'en servent.
 */
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'APP_URL'] as const;

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
  return config;
}
