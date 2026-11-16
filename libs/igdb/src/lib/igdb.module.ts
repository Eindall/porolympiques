import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GAME_CATALOG } from '@porolympiques/domain';
import { IgdbGameCatalog } from './igdb-game-catalog';

/** Fournit le port `GameCatalog` avec l'adapter IGDB, à partir des identifiants Twitch de la configuration. */
@Global()
@Module({
  providers: [
    {
      provide: GAME_CATALOG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new IgdbGameCatalog({
          clientId: config.getOrThrow<string>('TWITCH_CLIENT_ID'),
          clientSecret: config.getOrThrow<string>('TWITCH_CLIENT_SECRET'),
        }),
    },
  ],
  exports: [GAME_CATALOG],
})
export class IgdbModule {}
