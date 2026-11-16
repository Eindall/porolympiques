import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { GUILD_DIRECTORY, type GuildDirectory } from '@porolympiques/domain';
import type { HealthStatus } from '@porolympiques/shared';
import { DataSource } from 'typeorm';
import { Public } from '../auth/public.decorator';

/**
 * Route publique, par exception à la règle « tout derrière l'authentification » (avec le flux de connexion) :
 * le healthcheck Docker et le script de déploiement l'appellent sans session.
 * Elle ne renvoie rien d'autre que l'état : elle échoue si la base ne répond pas, et signale (sans échouer) un
 * bot déconnecté de Discord, pour que la supervision le voie sans bloquer un déploiement pendant une panne de Discord.
 */
@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(GUILD_DIRECTORY) private readonly guild: Pick<GuildDirectory, 'isConnected'>,
  ) {}

  @Get()
  async check(): Promise<HealthStatus> {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', discord: this.guild.isConnected() ? 'up' : 'down' };
  }
}
