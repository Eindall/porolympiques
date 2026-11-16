import { Global, Module } from '@nestjs/common';
import {
  EVENT_REPOSITORY,
  type EventRepository,
  HomeService,
  HonoursService,
  PLAYER_REPOSITORY,
  type PlayerRepository,
  SEASON_REPOSITORY,
  type SeasonRepository,
  STANDINGS_READER,
  type StandingsReader,
  StandingsService,
} from '@porolympiques/domain';

/**
 * Câblage des services de domaine du classement, des médailles et de l'accueil (classes TypeScript pures) avec
 * leurs ports. Global : l'API les sert maintenant, le bot les utilisera pour `/leaderboard` et `/profile`.
 */
@Global()
@Module({
  providers: [
    {
      provide: StandingsService,
      inject: [SEASON_REPOSITORY, STANDINGS_READER],
      useFactory: (seasons: SeasonRepository, reader: StandingsReader) => new StandingsService(seasons, reader),
    },
    {
      provide: HonoursService,
      inject: [SEASON_REPOSITORY, STANDINGS_READER, PLAYER_REPOSITORY],
      useFactory: (seasons: SeasonRepository, reader: StandingsReader, players: PlayerRepository) =>
        new HonoursService(seasons, reader, players),
    },
    {
      provide: HomeService,
      inject: [EVENT_REPOSITORY, StandingsService],
      useFactory: (events: EventRepository, standings: StandingsService) => new HomeService(events, standings),
    },
  ],
  exports: [StandingsService, HonoursService, HomeService],
})
export class StandingsModule {}
