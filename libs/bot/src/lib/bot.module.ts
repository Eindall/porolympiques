import { Global, Module } from '@nestjs/common';
import { EVENT_ANNOUNCER, GUILD_DIRECTORY } from '@porolympiques/domain';
import { BotConfig } from './bot-config';
import { BotStartup } from './bot-startup';
import { DISCORD_CLIENT, createDiscordClient } from './discord-client';
import { DiscordEventAnnouncer } from './discord-event-announcer';
import { DiscordGuildDirectory } from './discord-guild-directory';
import { BotInteractions } from './interactions';
import { MemberSyncListener } from './member-sync.listener';

/**
 * Bot Discord (discord.js), chargé dans le même backend que l'API. Global : il fournit à l'API et au domaine les
 * ports `GuildDirectory` (présence sur le serveur) et `EventAnnouncer` (messages d'event), sans qu'ils importent
 * cette lib. Il sert aussi les commandes (`/leaderboard`, `/event`, `/join`, `/list-games`, `/add-game`, `/profile`).
 */
@Global()
@Module({
  providers: [
    BotConfig,
    { provide: DISCORD_CLIENT, useFactory: createDiscordClient },
    DiscordGuildDirectory,
    { provide: GUILD_DIRECTORY, useExisting: DiscordGuildDirectory },
    DiscordEventAnnouncer,
    { provide: EVENT_ANNOUNCER, useExisting: DiscordEventAnnouncer },
    BotInteractions,
    BotStartup,
    MemberSyncListener,
  ],
  exports: [GUILD_DIRECTORY, EVENT_ANNOUNCER],
})
export class BotModule {}
