/** Une session ouverte sur un appareil. Son `id` est le `jti` du jeton du cookie. */
export interface StoredSession {
  id: string;
  playerId: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Port de persistance des sessions (implémenté par la lib `database`). */
export interface SessionStore {
  create(input: { playerId: string; userAgent: string | null; now: Date; expiresAt: Date }): Promise<StoredSession>;
  findById(id: string): Promise<StoredSession | null>;
  /**
   * Repousse l'expiration (`now + idleTtlMs`, plafonnée à `createdAt + absoluteMaxMs`), seulement si la dernière
   * utilisation date d'au moins `minIntervalMs`. Renvoie la nouvelle échéance, ou `null` si rien n'a changé.
   */
  touch(id: string, now: Date, rules: { idleTtlMs: number; absoluteMaxMs: number; minIntervalMs: number }): Promise<Date | null>;
  revoke(id: string, playerId: string, now: Date): Promise<void>;
  revokeAllForPlayer(playerId: string, now: Date): Promise<number>;
  /** Garde les `max` sessions actives les plus récentes du joueur et révoque les autres. */
  revokeBeyondLimit(playerId: string, max: number, now: Date): Promise<void>;
  /** Supprime les sessions expirées, et celles révoquées avant `revokedBefore`. */
  deleteStale(now: Date, revokedBefore: Date): Promise<number>;
}

export const SESSION_STORE = Symbol('SessionStore');
