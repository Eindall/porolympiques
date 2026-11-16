import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AnnouncementsService } from '@porolympiques/domain';
import { type Client, Events } from 'discord.js';
import { BotConfig } from './bot-config';
import { commandDefinitions } from './commands';
import { DISCORD_CLIENT } from './discord-client';
import { BotInteractions } from './interactions';

/** Passage des annonces : publie celles dont la date est arrivée, et suit la fin des inscriptions. */
export const ANNOUNCEMENTS_TICK_MS = 60_000;

/**
 * Au démarrage du bot : écoute des commandes et boutons, enregistrement des commandes sur le serveur, puis
 * passage des annonces chaque minute. Branché avant la connexion (lancée par MemberSyncListener) ; rien sous Jest.
 */
@Injectable()
export class BotStartup implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Bot');
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(DISCORD_CLIENT) private readonly client: Client,
    private readonly config: BotConfig,
    private readonly interactions: BotInteractions,
    private readonly announcements: AnnouncementsService,
  ) {}

  onModuleInit(): void {
    if (process.env['NODE_ENV'] === 'test') return;
    if (this.config.interactionsEnabled) this.interactions.listen();
    this.client.once(Events.ClientReady, async (client) => {
      if (this.config.interactionsEnabled) {
        try {
          const guild = await client.guilds.fetch(this.config.guildId);
          await guild.commands.set(commandDefinitions());
          this.logger.log('Commandes enregistrées sur le serveur');
        } catch (error) {
          this.logger.error(`Enregistrement des commandes impossible : ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        this.logger.warn('DISCORD_BOT_INTERACTIONS=off : commandes et boutons ignorés par cette instance.');
      }
      if (!this.config.announcementsChannelId) {
        this.logger.warn('DISCORD_ANNOUNCEMENTS_CHANNEL_ID est vide : aucune annonce ne sera postée.');
        return;
      }
      void this.announcements.tick();
      this.timer = setInterval(() => void this.announcements.tick(), ANNOUNCEMENTS_TICK_MS);
      this.timer.unref();
    });
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.announcements.settled();
  }
}
