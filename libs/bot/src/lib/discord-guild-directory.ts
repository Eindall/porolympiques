import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GuildDirectory, GuildMember } from '@porolympiques/domain';
import { type Client, DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import { DISCORD_CLIENT } from './discord-client';
import { toGuildMember } from './to-guild-member';

/** Annuaire du serveur, lu par le bot. Chaque appel interroge Discord (pas de cache) : la présence fait foi. */
@Injectable()
export class DiscordGuildDirectory implements GuildDirectory {
  private readonly guildId: string;

  constructor(
    @Inject(DISCORD_CLIENT) private readonly client: Client,
    config: ConfigService,
  ) {
    this.guildId = config.getOrThrow<string>('DISCORD_GUILD_ID');
  }

  async findMember(discordId: string): Promise<GuildMember | null> {
    const guild = await this.client.guilds.fetch(this.guildId);
    try {
      return toGuildMember(await guild.members.fetch({ user: discordId, force: true }));
    } catch (error) {
      if (error instanceof DiscordAPIError && (error.code === RESTJSONErrorCodes.UnknownMember || error.code === RESTJSONErrorCodes.UnknownUser)) {
        return null;
      }
      throw error;
    }
  }

  /** Tous les membres du serveur (bots compris : le domaine les écarte). */
  async listMembers(): Promise<GuildMember[]> {
    const guild = await this.client.guilds.fetch(this.guildId);
    const members = await guild.members.fetch();
    return [...members.values()].map(toGuildMember);
  }
}
