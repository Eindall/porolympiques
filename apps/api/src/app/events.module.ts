import { Global, Logger, Module } from '@nestjs/common';
import {
  AnnouncementsService,
  EVENT_ANNOUNCER,
  EVENT_REPOSITORY,
  type EventAnnouncer,
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
  StandingsService,
} from '@porolympiques/domain';

/**
 * Câblage des saisons, des events et du choix du jeu : services du domaine (classes TypeScript pures) avec leurs
 * ports. Global : l'API et le bot les partagent (commandes `/event` et `/join`, messages d'event).
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
      // Messages d'event sur Discord : le port EVENT_ANNOUNCER est fourni par le bot.
      provide: AnnouncementsService,
      inject: [EVENT_REPOSITORY, StandingsService, EVENT_ANNOUNCER],
      useFactory: (events: EventRepository, standings: StandingsService, announcer: EventAnnouncer) => {
        const logger = new Logger('Annonces');
        return new AnnouncementsService(events, standings, announcer, (message) => logger.error(message));
      },
    },
    {
      provide: EventsService,
      inject: [EVENT_REPOSITORY, SEASON_REPOSITORY, PLAYER_REPOSITORY, IDEA_REPOSITORY, IdeasService, AnnouncementsService],
      useFactory: (
        events: EventRepository,
        seasons: SeasonRepository,
        players: PlayerRepository,
        ideas: IdeaRepository,
        ideasService: IdeasService,
        announcements: AnnouncementsService,
      ) => new EventsService(events, seasons, players, ideas, ideasService, () => new Date(), announcements),
    },
    {
      provide: GameChoiceService,
      inject: [EVENT_REPOSITORY, IDEA_REPOSITORY],
      useFactory: (events: EventRepository, ideas: IdeaRepository) => new GameChoiceService(events, ideas),
    },
  ],
  exports: [SeasonsService, EventsService, GameChoiceService, AnnouncementsService],
})
export class EventsModule {}
