import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth/auth.controller';
import { DiscordStrategy } from './auth/discord.strategy';
import { DiscordOAuthGuard } from './auth/oauth.guard';
import { OAuthStateService } from './auth/oauth-state.service';
import { SESSION_ABSOLUTE_MAX_MS } from './auth/session.constants';
import { SessionCleanupService } from './auth/session-cleanup.service';
import { SessionGuard } from './auth/session.guard';
import { SessionService } from './auth/session.service';
import { HealthController } from './health/health.controller';
import { MeController } from './players/me.controller';

/**
 * Routes HTTP de l'API. Les contrôleurs restent fins : les règles métier vivent dans `@porolympiques/domain`.
 * Toutes les routes sont derrière SessionGuard (garde global), sauf celles marquées `@Public()`.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: SESSION_ABSOLUTE_MAX_MS / 1000 },
      }),
    }),
  ],
  controllers: [HealthController, AuthController, MeController],
  providers: [
    SessionService,
    SessionCleanupService,
    OAuthStateService,
    DiscordStrategy,
    DiscordOAuthGuard,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class ApiModule {}
