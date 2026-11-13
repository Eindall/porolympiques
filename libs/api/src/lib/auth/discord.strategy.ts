import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type VerifyCallback } from 'passport-oauth2';

const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const ME_URL = 'https://discord.com/api/users/@me';

/** Ce que l'OAuth apporte : l'identifiant Discord. Pseudo et avatar viennent de la fiche de membre, lue par le bot. */
export interface DiscordIdentity {
  discordId: string;
}

/**
 * Stratégie Passport pour Discord (OAuth2 « authorization code », scope `identify` seulement : pas d'e-mail).
 * Le `state` anti-CSRF est géré par OAuthGuard, sans session serveur.
 */
@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  constructor(config: ConfigService) {
    super({
      authorizationURL: AUTHORIZE_URL,
      tokenURL: TOKEN_URL,
      clientID: config.getOrThrow<string>('DISCORD_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('DISCORD_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('DISCORD_REDIRECT_URI'),
      scope: ['identify'],
    });
  }

  /** `prompt=none` : Discord ne redemande pas l'accord si l'app est déjà autorisée avec le même scope. */
  override authorizationParams(): Record<string, string> {
    return { prompt: 'none' };
  }

  /** Appelé par passport-oauth2 après l'échange du code. */
  override userProfile(accessToken: string, done: (err?: Error | null, profile?: unknown) => void): void {
    fetch(ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'Porolympiques (https://github.com/Eindall/porolympiques, 1.0)' },
    })
      .then(async (response) => {
        // Pas de corps de réponse dans l'erreur : il pourrait contenir des données personnelles.
        if (!response.ok) throw new Error(`discord_profile_failed: HTTP ${response.status}`);
        return (await response.json()) as { id: string };
      })
      .then((me) => done(null, me))
      .catch((error: unknown) => done(error instanceof Error ? error : new Error('discord_profile_failed')));
  }

  /** Le résultat devient `req.user`. */
  validate(_accessToken: string, _refreshToken: string, me: { id: string }, done: VerifyCallback): void {
    const identity: DiscordIdentity = { discordId: me.id };
    done(null, identity);
  }
}
