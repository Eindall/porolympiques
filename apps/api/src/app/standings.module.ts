import { Global, Module } from '@nestjs/common';
import {
  SEASON_REPOSITORY,
  type SeasonRepository,
  STANDINGS_READER,
  type StandingsReader,
  StandingsService,
} from '@porolympiques/domain';

/**
 * Câblage du service de domaine du classement (classe TypeScript pure) avec ses ports.
 * Global : l'API le sert maintenant, le bot l'utilisera pour `/leaderboard`.
 */
@Global()
@Module({
  providers: [
    {
      provide: StandingsService,
      inject: [SEASON_REPOSITORY, STANDINGS_READER],
      useFactory: (seasons: SeasonRepository, reader: StandingsReader) => new StandingsService(seasons, reader),
    },
  ],
  exports: [StandingsService],
})
export class StandingsModule {}
