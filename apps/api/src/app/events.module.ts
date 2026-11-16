import { Global, Module } from '@nestjs/common';
import {
  EVENT_REPOSITORY,
  type EventRepository,
  EventsService,
  GameChoiceService,
  IDEA_REPOSITORY,
  type IdeaRepository,
  IdeasService,
  PLAYER_REPOSITORY,
  type PlayerRepository,
  SEASON_REPOSITORY,
  type SeasonRepository,
  SeasonsService,
} from '@porolympiques/domain';

/**
 * Câblage des saisons, des events et du choix du jeu : services du domaine (classes TypeScript pures) avec leurs
 * ports. Global : l'API les sert maintenant, le bot les utilisera pour `/event` et `/join`.
 */
@Global()
@Module({
  providers: [
    {
      provide: SeasonsService,
      inject: [SEASON_REPOSITORY],
      useFactory: (seasons: SeasonRepository) => new SeasonsService(seasons),
    },
    {
      provide: EventsService,
      inject: [EVENT_REPOSITORY, SEASON_REPOSITORY, PLAYER_REPOSITORY, IDEA_REPOSITORY, IdeasService],
      useFactory: (events: EventRepository, seasons: SeasonRepository, players: PlayerRepository, ideas: IdeaRepository, ideasService: IdeasService) =>
        new EventsService(events, seasons, players, ideas, ideasService),
    },
    {
      provide: GameChoiceService,
      inject: [EVENT_REPOSITORY, IDEA_REPOSITORY],
      useFactory: (events: EventRepository, ideas: IdeaRepository) => new GameChoiceService(events, ideas),
    },
  ],
  exports: [SeasonsService, EventsService, GameChoiceService],
})
export class EventsModule {}
