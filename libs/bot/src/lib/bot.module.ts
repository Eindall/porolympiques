import { Global, Module } from '@nestjs/common';
import { GUILD_DIRECTORY } from '@porolympiques/domain';
import { DISCORD_CLIENT, createDiscordClient } from './discord-client';
import { DiscordGuildDirectory } from './discord-guild-directory';
import { MemberSyncListener } from './member-sync.listener';

/**
 * Bot Discord (discord.js), chargé dans le même backend que l'API. Global : il fournit le port `GuildDirectory`
 * à l'API sans qu'elle importe cette lib. Les annonces et commandes arriveront en phase 7.
 */
@Global()
@Module({
  providers: [
    { provide: DISCORD_CLIENT, useFactory: createDiscordClient },
    DiscordGuildDirectory,
    { provide: GUILD_DIRECTORY, useExisting: DiscordGuildDirectory },
    MemberSyncListener,
  ],
  exports: [GUILD_DIRECTORY],
})
export class BotModule {}
