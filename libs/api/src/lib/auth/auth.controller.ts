import { Controller, Get, HttpCode, Inject, Logger, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { GUILD_DIRECTORY, type GuildDirectory, PlayersService } from '@porolympiques/domain';
import type { AuthErrorCode } from '@porolympiques/shared';
import type { Request, Response } from 'express';
import type { DiscordIdentity } from './discord.strategy';
import { DiscordOAuthGuard } from './oauth.guard';
import { Public } from './public.decorator';
import { SESSION_COOKIE } from './session.constants';
import { SessionService } from './session.service';

@Controller('auth')
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly session: SessionService,
    private readonly players: PlayersService,
    @Inject(GUILD_DIRECTORY) private readonly directory: GuildDirectory,
  ) {}

  /** Départ du flux : le garde redirige vers Discord (le corps n'est jamais exécuté). */
  @Get('discord')
  @UseGuards(DiscordOAuthGuard)
  login(): void {
    // Redirection assurée par DiscordOAuthGuard.
  }

  /**
   * Retour de Discord : le garde a vérifié le state et échangé le code. On vérifie alors la présence sur le serveur
   * (par le bot), puis on ouvre la session.
   */
  @Get('discord/callback')
  @UseGuards(DiscordOAuthGuard)
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    const { discordId } = req.user as DiscordIdentity;
    const fail = (code: AuthErrorCode) => res.redirect(`${appUrl}/login?error=${code}`);

    try {
      const result = await this.players.signIn(discordId, await this.directory.findMember(discordId));
      if (result.kind === 'not_member') return fail('not_member');
      await this.session.start(res, result.player.id, req.get('user-agent'));
      res.redirect(`${appUrl}/`);
    } catch (error) {
      this.logger.error(`Connexion impossible : ${error instanceof Error ? error.message : String(error)}`);
      fail('discord');
    }
  }

  /** Déconnexion réelle : la session est révoquée en base, pas seulement effacée du navigateur. */
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.session.logout(req.cookies?.[SESSION_COOKIE], res);
  }
}
