import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PLAYER_REPOSITORY,
  type PlayerRepository,
  PlayersService,
  SESSION_STORE,
  type SessionStore,
} from '@porolympiques/domain';
import { parseAdminIds } from './config/env';

/**
 * Câblage du service de domaine des joueurs (classe TypeScript pure) avec ses ports.
 * Global : l'API (connexion, mur) et le bot (synchro des membres) le reçoivent sans se connaître.
 */
@Global()
@Module({
  providers: [
    {
      provide: PlayersService,
      inject: [PLAYER_REPOSITORY, SESSION_STORE, ConfigService],
      useFactory: (players: PlayerRepository, sessions: SessionStore, config: ConfigService) =>
        new PlayersService(players, sessions, parseAdminIds(config.getOrThrow<string>('DISCORD_ADMIN_IDS'))),
    },
  ],
  exports: [PlayersService],
})
export class PlayersModule {}
