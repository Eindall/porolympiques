import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { CLEANUP_INTERVAL_MS } from './session.constants';
import { SessionService } from './session.service';

/** Supprime régulièrement les sessions périmées : au démarrage, puis toutes les 6 h. */
@Injectable()
export class SessionCleanupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SessionCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly sessions: SessionService) {}

  onApplicationBootstrap(): void {
    if (process.env['NODE_ENV'] === 'test') return;
    void this.run();
    this.timer = setInterval(() => void this.run(), CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async run(): Promise<number> {
    try {
      const deleted = await this.sessions.deleteStale();
      if (deleted > 0) this.logger.log(`${deleted} session(s) périmée(s) supprimée(s)`);
      return deleted;
    } catch (error) {
      this.logger.error(`Nettoyage des sessions impossible : ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
}
