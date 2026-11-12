import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

/** Routes HTTP de l'API. Les contrôleurs restent fins : les règles métier vivent dans `@porolympiques/domain`. */
@Module({
  controllers: [HealthController],
})
export class ApiModule {}
