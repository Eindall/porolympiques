import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PLAYER_REPOSITORY, SESSION_STORE } from '@porolympiques/domain';
import { PlayerEntity } from './players/player.entity';
import { TypeOrmPlayerRepository } from './players/typeorm-player.repository';
import { AuthSessionEntity } from './sessions/auth-session.entity';
import { TypeOrmSessionStore } from './sessions/typeorm-session.store';

/**
 * Persistance : implémente les ports du domaine avec TypeORM. Globale, pour que l'API et le bot reçoivent
 * les ports sans importer cette lib (la connexion elle-même est configurée par l'app).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PlayerEntity, AuthSessionEntity])],
  providers: [
    { provide: PLAYER_REPOSITORY, useClass: TypeOrmPlayerRepository },
    { provide: SESSION_STORE, useClass: TypeOrmSessionStore },
  ],
  exports: [PLAYER_REPOSITORY, SESSION_STORE],
})
export class DatabaseModule {}
