import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { HealthStatus } from '@porolympiques/shared';
import { DataSource } from 'typeorm';
import { Public } from '../auth/public.decorator';

/**
 * Route publique, par exception à la règle « tout derrière l'authentification » (avec le flux de connexion) :
 * le healthcheck Docker et le script de déploiement l'appellent sans session.
 * Elle ne renvoie rien d'autre que l'état, et vérifie que la base répond.
 */
@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<HealthStatus> {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok' };
  }
}
