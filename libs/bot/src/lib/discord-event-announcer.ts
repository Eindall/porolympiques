import { Inject, Injectable, Logger } from '@nestjs/common';
import type { EventAnnouncement, EventAnnouncer, ResultsAnnouncement } from '@porolympiques/domain';
import { type Client, DiscordAPIError, type Message, RESTJSONErrorCodes, type SendableChannels } from 'discord.js';
import { BotConfig } from './bot-config';
import { DISCORD_CLIENT } from './discord-client';
import { type BotMessage, announcementMessage, resultsMessage } from './messages';

/** Publie les messages d'event dans le salon des annonces (`DISCORD_ANNOUNCEMENTS_CHANNEL_ID`). */
@Injectable()
export class DiscordEventAnnouncer implements EventAnnouncer {
  private readonly logger = new Logger('Annonces');

  constructor(
    @Inject(DISCORD_CLIENT) private readonly client: Client,
    private readonly config: BotConfig,
  ) {}

  isReady(): boolean {
    return this.client.isReady() && this.config.announcementsChannelId !== null;
  }

  async postAnnouncement(announcement: EventAnnouncement): Promise<string> {
    const message = await this.send(announcementMessage(announcement, this.config.appUrl, true), true);
    this.logger.log(`Annonce postée : ${announcement.event.game.name} — ${announcement.event.format.name}`);
    return message.id;
  }

  editAnnouncement(messageId: string, announcement: EventAnnouncement): Promise<boolean> {
    // Sans `content` : le texte d'origine (et sa mention) reste, sans notifier à nouveau.
    return this.edit(messageId, announcementMessage(announcement, this.config.appUrl, false));
  }

  async postResults(results: ResultsAnnouncement): Promise<string> {
    const message = await this.send(resultsMessage(results, this.config.appUrl), false);
    this.logger.log(`Résultats postés : ${results.event.game.name} — ${results.event.format.name}`);
    return message.id;
  }

  editResults(messageId: string, results: ResultsAnnouncement): Promise<boolean> {
    return this.edit(messageId, resultsMessage(results, this.config.appUrl));
  }

  private async channel(): Promise<SendableChannels> {
    const channel = await this.client.channels.fetch(this.config.announcementsChannelId as string);
    if (!channel?.isSendable()) throw new Error('Le salon des annonces est introuvable, ou le bot ne peut pas y écrire.');
    // Garde-fou : une instance (dev ou prod) ne poste jamais hors de son serveur, même avec un mauvais identifiant de salon.
    if (!('guildId' in channel) || channel.guildId !== this.config.guildId) {
      throw new Error('Le salon des annonces n’appartient pas au serveur DISCORD_GUILD_ID : rien n’est posté.');
    }
    return channel;
  }

  private async send(message: BotMessage, mention: boolean): Promise<Message> {
    return (await this.channel()).send({ ...message, allowedMentions: { parse: mention ? ['everyone'] : [] } });
  }

  /** Faux si le message a été supprimé : le domaine en repostera un. */
  private async edit(messageId: string, message: BotMessage): Promise<boolean> {
    const channel = await this.channel();
    if (!('messages' in channel)) return false;
    try {
      const existing = await channel.messages.fetch(messageId);
      await existing.edit({ embeds: message.embeds, components: message.components, allowedMentions: { parse: [] } });
      return true;
    } catch (error) {
      if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage) return false;
      throw error;
    }
  }
}
