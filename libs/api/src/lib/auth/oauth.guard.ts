import { type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { AuthErrorCode } from '@porolympiques/shared';
import type { Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { OAuthStateService } from './oauth-state.service';
import { OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE_MS } from './session.constants';
import { SessionService } from './session.service';

/**
 * Garde Passport du flux Discord, avec un `state` anti-CSRF aléatoire gardé dans un cookie signé.
 * - Départ : génère le state, le pose en cookie et l'envoie à Discord.
 * - Retour : vérifie que le state renvoyé est celui du cookie, puis laisse Passport échanger le code.
 * En cas d'échec, renvoie sur /login?error=… (jamais d'erreur JSON brute).
 */
@Injectable()
export class DiscordOAuthGuard extends AuthGuard('discord') {
  private readonly logger = new Logger('DiscordOAuthGuard');

  constructor(
    private readonly config: ConfigService,
    private readonly session: SessionService,
    private readonly oauthState: OAuthStateService,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { pendingState?: string }>();
    const res = http.getResponse<Response>();

    if (this.isCallback(req)) {
      const expected = await this.oauthState.verify(req.cookies?.[OAUTH_STATE_COOKIE]);
      res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
      const received = typeof req.query['state'] === 'string' ? req.query['state'] : undefined;
      if (!expected || !received || !this.safeEqual(received, expected)) return this.fail(res, 'state');
      // Sans `code` (refus chez Discord), passport-oauth2 relancerait le flux : on s'arrête ici.
      if (typeof req.query['code'] !== 'string') {
        this.logger.warn(`Retour sans code : error=${String(req.query['error'])}`);
        return this.fail(res, 'discord');
      }
    } else {
      const state = randomBytes(24).toString('hex');
      req.pendingState = state;
      res.cookie(OAUTH_STATE_COOKIE, await this.oauthState.sign(state), this.session.cookieOptions(OAUTH_STATE_MAX_AGE_MS));
    }

    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      this.logger.warn(`Échec de l'authentification : ${error instanceof Error ? error.message : JSON.stringify(error)}`);
      return this.fail(res, 'discord');
    }
  }

  override getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    const req = context.switchToHttp().getRequest<Request & { pendingState?: string }>();
    return this.isCallback(req) ? {} : { state: req.pendingState };
  }

  private isCallback(req: Request): boolean {
    return req.path.endsWith('/callback');
  }

  private fail(res: Response, code: AuthErrorCode): boolean {
    res.redirect(`${this.config.getOrThrow<string>('APP_URL')}/login?error=${code}`);
    return false;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}
