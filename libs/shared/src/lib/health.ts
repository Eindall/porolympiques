/** Réponse de `GET /api/health`, la seule route publique de l'API. */
export interface HealthStatus {
  status: 'ok';
  /** Le bot est connecté à Discord. Sans lui, les connexions au site échouent ; la route répond quand même 200. */
  discord: 'up' | 'down';
}
