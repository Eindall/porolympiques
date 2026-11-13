import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlayersService } from '@porolympiques/domain';
import { type Client, Events, type GuildMember as DiscordGuildMember, type PartialGuildMember } from 'discord.js';
import { DISCORD_CLIENT } from './discord-client';
import { DiscordGuildDirectory } from './discord-guild-directory';
import { toGuildMember } from './to-guild-member';

/** Resynchronisation complète régulière, en plus du démarrage : rattrape un événement manqué pendant une coupure. */
export const FULL_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Connecte le bot et tient la table des joueurs à jour : synchro complète au démarrage puis toutes les 6 h,
 * et suivi des arrivées, départs et changements de profil. Le bot ne se connecte pas sous Jest (NODE_ENV=test).
 */
@Injectable()
export class MemberSyncListener implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Bot');
  private readonly guildId: string;
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(DISCORD_CLIENT) private readonly client: Client,
    private readonly directory: DiscordGuildDirectory,
    private readonly players: PlayersService,
    private readonly config: ConfigService,
  ) {
    this.guildId = config.getOrThrow<string>('DISCORD_GUILD_ID');
  }

  async onApplicationBootstrap(): Promise<void> {
    if (process.env['NODE_ENV'] === 'test') return;

    this.client.once(Events.ClientReady, (client) => {
      this.logger.log(`Connecté en tant que ${client.user.tag}`);
      void this.fullSync();
      this.timer = setInterval(() => void this.fullSync(), FULL_SYNC_INTERVAL_MS);
      this.timer.unref();
    });
    this.client.on(Events.GuildMemberAdd, (member) => this.onPresent(member));
    this.client.on(Events.GuildMemberUpdate, (_old, member) => this.onPresent(member));
    this.client.on(Events.GuildMemberRemove, (member) => this.onLeft(member));
    this.client.on(Events.Error, (error) => this.logger.error(`Erreur du client Discord : ${error.message}`));

    // Pas d'await sur la connexion complète : l'API démarre même si Discord est lent ou indisponible.
    this.client.login(this.config.getOrThrow<string>('DISCORD_BOT_TOKEN')).catch((error: unknown) => {
      this.logger.error(`Connexion du bot impossible : ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.client.destroy();
  }

  async fullSync(): Promise<void> {
    try {
      const report = await this.players.syncMembers(await this.directory.listMembers());
      this.logger.log(
        `Synchro des membres : ${report.created} créé(s), ${report.updated} mis à jour, ${report.deactivated} désactivé(s)`,
      );
    } catch (error) {
      this.logger.error(`Synchro des membres impossible : ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private onPresent(member: DiscordGuildMember): void {
    if (member.guild.id !== this.guildId) return;
    this.players.memberPresent(toGuildMember(member)).catch((error: unknown) => this.logFailure('arrivée', error));
  }

  private onLeft(member: DiscordGuildMember | PartialGuildMember): void {
    if (member.guild.id !== this.guildId) return;
    this.players.memberLeft(member.id).catch((error: unknown) => this.logFailure('départ', error));
  }

  private logFailure(what: string, error: unknown): void {
    this.logger.error(`Suivi d'un ${what} impossible : ${error instanceof Error ? error.message : String(error)}`);
  }
}
