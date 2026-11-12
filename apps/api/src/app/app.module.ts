// TypeORM charge le driver PostgreSQL dynamiquement : sans cet import, Nx ne le voit pas et l'omet du
// package.json de production (le conteneur planterait au démarrage avec « Postgres package has not been found »).
import 'pg';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiModule } from '@porolympiques/api';
import { BotModule } from '@porolympiques/bot';
import { validateEnv } from './config/env';
import { ENTITIES } from './database/entities';
import { MIGRATIONS } from './database/migrations';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Limite globale : 100 requêtes par minute et par IP. Désactivée sous Jest (NODE_ENV=test).
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }], skipIf: () => process.env['NODE_ENV'] === 'test' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        uuidExtension: 'pgcrypto' as const,
        entities: ENTITIES,
        migrations: MIGRATIONS,
        // Les migrations s'appliquent au démarrage. `synchronize` reste désactivé, en dev comme en prod.
        migrationsRun: true,
        synchronize: false,
      }),
    }),
    ApiModule,
    BotModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
