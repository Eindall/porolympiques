import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CATALOG_SEARCH_CACHE,
  COVER_STORAGE,
  GAME_REPOSITORY,
  IDEA_REPOSITORY,
  PLAYER_REPOSITORY,
  SEASON_REPOSITORY,
  SESSION_STORE,
  STANDINGS_READER,
} from '@porolympiques/domain';
import { TypeOrmCatalogSearchCache } from './catalog/typeorm-catalog-search-cache';
import { TypeOrmGameRepository } from './catalog/typeorm-game.repository';
import { TypeOrmIdeaRepository } from './catalog/typeorm-idea.repository';
import { ENTITIES } from './entities';
import { DiskCoverStorage } from './files/disk-cover-storage';
import { TypeOrmPlayerRepository } from './players/typeorm-player.repository';
import { TypeOrmSeasonRepository } from './seasons/typeorm-season.repository';
import { TypeOrmSessionStore } from './sessions/typeorm-session.store';
import { TypeOrmStandingsReader } from './standings/typeorm-standings.reader';

/**
 * Persistance : implémente les ports du domaine avec TypeORM (et le disque pour les images). Globale, pour que l'API et le bot reçoivent
 * les ports sans importer cette lib (la connexion elle-même est configurée par l'app).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  providers: [
    { provide: PLAYER_REPOSITORY, useClass: TypeOrmPlayerRepository },
    { provide: SESSION_STORE, useClass: TypeOrmSessionStore },
    { provide: SEASON_REPOSITORY, useClass: TypeOrmSeasonRepository },
    { provide: STANDINGS_READER, useClass: TypeOrmStandingsReader },
    { provide: GAME_REPOSITORY, useClass: TypeOrmGameRepository },
    { provide: IDEA_REPOSITORY, useClass: TypeOrmIdeaRepository },
    { provide: CATALOG_SEARCH_CACHE, useClass: TypeOrmCatalogSearchCache },
    {
      // Images envoyées par les joueurs : `UPLOADS_DIR`, ou `data/uploads` (ignoré par git) en dev.
      provide: COVER_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new DiskCoverStorage(config.get<string>('UPLOADS_DIR') || 'data/uploads'),
    },
  ],
  exports: [
    PLAYER_REPOSITORY,
    SESSION_STORE,
    SEASON_REPOSITORY,
    STANDINGS_READER,
    GAME_REPOSITORY,
    IDEA_REPOSITORY,
    CATALOG_SEARCH_CACHE,
    COVER_STORAGE,
  ],
})
export class DatabaseModule {}
