import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PLAYER_REPOSITORY, SEASON_REPOSITORY, SESSION_STORE, STANDINGS_READER } from '@porolympiques/domain';
import { ENTITIES } from './entities';
import { TypeOrmPlayerRepository } from './players/typeorm-player.repository';
import { TypeOrmSeasonRepository } from './seasons/typeorm-season.repository';
import { TypeOrmSessionStore } from './sessions/typeorm-session.store';
import { TypeOrmStandingsReader } from './standings/typeorm-standings.reader';

/**
 * Persistance : implémente les ports du domaine avec TypeORM. Globale, pour que l'API et le bot reçoivent
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
  ],
  exports: [PLAYER_REPOSITORY, SESSION_STORE, SEASON_REPOSITORY, STANDINGS_READER],
})
export class DatabaseModule {}
