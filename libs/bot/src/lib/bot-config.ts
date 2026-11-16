import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Réglages du bot, lus dans l'environnement. */
@Injectable()
export class BotConfig {
  readonly guildId: string;
  readonly appUrl: string;
  /** Vide : pas d'annonces (les commandes marchent quand même). */
  readonly announcementsChannelId: string | null;
  /** `DISCORD_BOT_INTERACTIONS=off` : le bot ignore les commandes et boutons (dev branché sur le bot de prod). */
  readonly interactionsEnabled: boolean;

  constructor(config: ConfigService) {
    this.guildId = config.getOrThrow<string>('DISCORD_GUILD_ID');
    this.appUrl = config.getOrThrow<string>('APP_URL');
    this.announcementsChannelId = config.get<string>('DISCORD_ANNOUNCEMENTS_CHANNEL_ID') || null;
    this.interactionsEnabled = config.get<string>('DISCORD_BOT_INTERACTIONS') !== 'off';
  }
}
