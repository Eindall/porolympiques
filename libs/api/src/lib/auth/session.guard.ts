import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Player, PlayersService } from '@porolympiques/domain';
import type { Request, Response } from 'express';
import { IS_PUBLIC } from './public.decorator';
import { SESSION_COOKIE } from './session.constants';
import { SessionService } from './session.service';

export type AuthenticatedRequest = Request & { player: Player; sessionId: string };

/**
 * Le mur, appliqué à toutes les routes (garde global) sauf celles marquées `@Public()`.
 * À chaque requête : session valide en base, et joueur toujours actif. Un joueur parti du serveur
 * est refusé dès la requête suivante, et la session présentée est révoquée.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly players: PlayersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const res = http.getResponse<Response>();
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException();

    const auth = await this.sessions.authenticate(token);
    if (!auth) {
      this.sessions.clearCookie(res);
      throw new UnauthorizedException();
    }

    const player = await this.players.findById(auth.playerId);
    if (!player?.active) {
      await this.sessions.revoke(auth.sessionId, auth.playerId);
      this.sessions.clearCookie(res);
      throw new UnauthorizedException();
    }

    req.player = player;
    req.sessionId = auth.sessionId;
    // Session prolongée : on réémet le cookie, sinon le navigateur le supprimerait à l'ancienne échéance.
    if (auth.renewedUntil) this.sessions.setCookie(res, token, auth.renewedUntil);
    return true;
  }
}
