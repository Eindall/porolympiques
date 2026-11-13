import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SESSION_STORE, type SessionStore, type StoredSession } from '@porolympiques/domain';
import type { CookieOptions, Response } from 'express';
import {
  MAX_ACTIVE_SESSIONS,
  REVOKED_RETENTION_MS,
  SESSION_ABSOLUTE_MAX_MS,
  SESSION_COOKIE,
  SESSION_IDLE_TTL_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from './session.constants';

interface SessionPayload {
  sub?: string;
  jti?: string;
  purpose?: string;
}

/** Résultat d'une authentification réussie. `renewedUntil` : la session vient d'être prolongée (cookie à réémettre). */
export interface Authenticated {
  playerId: string;
  sessionId: string;
  renewedUntil: Date | null;
}

/**
 * Sessions : un JWT signé dans un cookie httpOnly, dont le `jti` désigne une ligne de `auth_sessions`.
 * Cette ligne fait foi : elle peut être révoquée (déconnexion, départ du serveur) et expire de façon glissante.
 */
@Injectable()
export class SessionService {
  private readonly secureCookies: boolean;

  constructor(
    private readonly jwt: JwtService,
    @Inject(SESSION_STORE) private readonly store: SessionStore,
    config: ConfigService,
  ) {
    // Cookie `Secure` dès que le site est servi en https (production), sans variable de plus.
    this.secureCookies = config.getOrThrow<string>('APP_URL').startsWith('https://');
  }

  /** Ouvre une session : crée la ligne, signe le jeton, pose le cookie. */
  async start(res: Response, playerId: string, userAgent?: string): Promise<StoredSession> {
    const { token, session } = await this.issue(playerId, userAgent);
    this.setCookie(res, token, session.expiresAt);
    return session;
  }

  /** Crée une session et son jeton, sans toucher à la réponse HTTP. */
  async issue(playerId: string, userAgent?: string, now = new Date()): Promise<{ token: string; session: StoredSession }> {
    const session = await this.store.create({
      playerId,
      userAgent: userAgent ?? null,
      now,
      expiresAt: new Date(now.getTime() + SESSION_IDLE_TTL_MS),
    });
    await this.store.revokeBeyondLimit(playerId, MAX_ACTIVE_SESSIONS, now);
    // Le JWT expire au plafond absolu ; l'expiration glissante, plus courte, est dans la ligne.
    const token = await this.jwt.signAsync(
      { sub: playerId, purpose: 'session' },
      { jwtid: session.id, expiresIn: SESSION_ABSOLUTE_MAX_MS / 1000 },
    );
    return { token, session };
  }

  /** Valide un jeton : signature, puis session active en base. `null` si le jeton ne vaut rien. */
  async authenticate(token: string, now = new Date()): Promise<Authenticated | null> {
    const payload = await this.verify(token);
    if (!payload?.sub || !payload.jti || payload.purpose !== 'session') return null;

    const session = await this.store.findById(payload.jti);
    if (!session || session.playerId !== payload.sub || session.revokedAt || session.expiresAt <= now) return null;

    const renewedUntil =
      now.getTime() - session.lastUsedAt.getTime() >= SESSION_TOUCH_INTERVAL_MS
        ? await this.store.touch(session.id, now, {
            idleTtlMs: SESSION_IDLE_TTL_MS,
            absoluteMaxMs: SESSION_ABSOLUTE_MAX_MS,
            minIntervalMs: SESSION_TOUCH_INTERVAL_MS,
          })
        : null;
    return { playerId: session.playerId, sessionId: session.id, renewedUntil };
  }

  /** Déconnexion : révoque la session du cookie (même expirée côté JWT) et efface le cookie. Sans erreur si invalide. */
  async logout(token: string | undefined, res: Response): Promise<void> {
    const payload = token ? await this.verify(token, true) : null;
    if (payload?.jti && payload.sub && payload.purpose === 'session') {
      await this.store.revoke(payload.jti, payload.sub, new Date());
    }
    this.clearCookie(res);
  }

  revoke(sessionId: string, playerId: string): Promise<void> {
    return this.store.revoke(sessionId, playerId, new Date());
  }

  deleteStale(now = new Date()): Promise<number> {
    return this.store.deleteStale(now, new Date(now.getTime() - REVOKED_RETENTION_MS));
  }

  setCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, token, this.cookieOptions(Math.max(0, expiresAt.getTime() - Date.now())));
  }

  clearCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  cookieOptions(maxAge: number): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: this.secureCookies, path: '/', maxAge };
  }

  private async verify(token: string, ignoreExpiration = false): Promise<SessionPayload | null> {
    try {
      return await this.jwt.verifyAsync<SessionPayload>(token, { ignoreExpiration });
    } catch {
      return null;
    }
  }
}
