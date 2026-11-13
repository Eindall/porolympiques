import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** Réglages HTTP communs au démarrage réel (main.ts) et aux tests d'intégration. */
export function configureApp(app: NestExpressApplication): void {
  // Derrière nginx puis Caddy : on fait confiance à X-Forwarded-* (IP réelle, https).
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
}
