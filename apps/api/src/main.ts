import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import morgan from 'morgan';
import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Journal des requêtes : coloré en dev, format Apache standard en production (logs de conteneur).
  app.use(morgan(process.env['NODE_ENV'] === 'production' ? 'combined' : 'dev'));
  configureApp(app);

  const port = process.env['PORT'] || 3000;
  await app.listen(port);
  Logger.log(`API démarrée sur http://localhost:${port}/api`);
}

bootstrap();
