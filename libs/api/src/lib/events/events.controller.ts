import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Put, UseFilters } from '@nestjs/common';
import {
  type EventFormatChoice,
  type EventSummary,
  type EventView,
  EventsService,
  type GameChoiceState,
  GameChoiceService,
  PLAYER_REPOSITORY,
  type Player,
  type PlayerRepository,
  type Season,
  SeasonsService,
  timelineOf,
  withRights,
} from '@porolympiques/domain';
import type { EventDto, EventSummaryDto, NextGameDto, PlayerDto, SeasonDto } from '@porolympiques/shared';
import { CurrentPlayer } from '../auth/current-player.decorator';
import { IdeaErrorFilter } from '../ideas/idea-error.filter';
import { coverUrlOf, toIdeaDto, toIdeaInput } from '../ideas/ideas.controller';
import { EventErrorFilter } from './event-error.filter';
import {
  ChangeFormatBody,
  ChooseGameBody,
  CreateEventBody,
  type EventFormatBody,
  ResultsBody,
  SeasonBody,
  TeamAssignmentBody,
  TeamBody,
  UpdateEventBody,
  UpdateSeasonBody,
  ValidationBody,
} from './events.dto';

const iso = (date: Date | null) => (date ? date.toISOString() : null);
const toDate = (value: string | null | undefined) => (value === undefined ? undefined : value === null ? null : new Date(value));

function toSeasonDto(season: Season): SeasonDto {
  return {
    id: season.id,
    name: season.name,
    status: season.status,
    startDate: season.startDate.toISOString(),
    endDate: season.endDate.toISOString(),
    scoringScale: { ...season.scoringScale },
    mainQuota: season.mainQuota,
    sideQuota: season.sideQuota,
  };
}

export function toEventSummaryDto(event: EventSummary): EventSummaryDto {
  return {
    id: event.id,
    seasonId: event.seasonId,
    type: event.type,
    status: event.status,
    coefficient: event.coefficient,
    validated: event.validated,
    rules: event.rules,
    announceDate: event.announceDate.toISOString(),
    registrationEnd: event.registrationEnd.toISOString(),
    endDate: event.endDate.toISOString(),
    liveDate: iso(event.liveDate),
    finishedAt: iso(event.finishedAt),
    challongeUrl: event.challongeUrl,
    host: event.host,
    format: {
      id: event.format.id,
      name: event.format.name,
      description: event.format.description,
      teamMode: event.format.teamMode,
      playMode: event.format.playMode,
    },
    game: { id: event.game.id, name: event.game.name, coverUrl: coverUrlOf(event.game) },
    registrationCount: event.registrationCount,
    timeline: timelineOf(event, new Date()),
  };
}

function toEventDto(event: EventView): EventDto {
  return {
    ...toEventSummaryDto(event),
    teams: event.teams.map(({ id, name }) => ({ id, name })),
    registrations: event.registrations,
    results: event.results,
    registrationOpen: event.registrationOpen,
    registeredByMe: event.registeredByMe,
    sideWarnings: event.sideWarnings,
  };
}

function toNextGameDto(state: GameChoiceState, viewer: Player): NextGameDto {
  return {
    status: state.status,
    nextMain: state.nextMain ? toEventSummaryDto(state.nextMain) : null,
    lastMain: state.lastMain ? { id: state.lastMain.id, finishedAt: iso(state.lastMain.finishedAt) } : null,
    choosers: state.choosers,
    deadline: iso(state.deadline),
    candidates: state.candidates.map((idea) => toIdeaDto(withRights(idea, viewer))),
    pick: state.pick ? toIdeaDto(withRights(state.pick, viewer)) : null,
    canChoose: state.canChoose,
  };
}

function toFormatChoice(body: EventFormatBody): EventFormatChoice {
  return body.kind === 'existing'
    ? { kind: 'existing', formatId: body.formatId as string }
    : { kind: 'new', idea: toIdeaInput(body.idea as NonNullable<EventFormatBody['idea']>) };
}

@Controller('seasons')
@UseFilters(EventErrorFilter)
export class SeasonsController {
  constructor(
    private readonly seasons: SeasonsService,
    private readonly events: EventsService,
  ) {}

  @Get()
  async list(): Promise<SeasonDto[]> {
    return (await this.seasons.list()).map(toSeasonDto);
  }

  @Get(':id/events')
  async seasonEvents(@Param('id', new ParseUUIDPipe()) id: string): Promise<EventSummaryDto[]> {
    return (await this.events.listBySeason(id)).map(toEventSummaryDto);
  }
}

@Controller('events')
@UseFilters(EventErrorFilter)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get(':id')
  async detail(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<EventDto> {
    return toEventDto(await this.events.detail(player, id));
  }

  /** Inscription du joueur connecté. Pas de désinscription : seul l'admin retire un inscrit. */
  @Post(':id/registrations')
  @HttpCode(200)
  async register(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<EventDto> {
    return toEventDto(await this.events.register(player, id));
  }
}

@Controller('game-choice')
@UseFilters(EventErrorFilter)
export class GameChoiceController {
  constructor(private readonly choice: GameChoiceService) {}

  @Get()
  async state(@CurrentPlayer() player: Player): Promise<NextGameDto> {
    return toNextGameDto(await this.choice.state(player), player);
  }

  /** Choix du vainqueur du dernier main (le domaine vérifie qui peut choisir). */
  @Put()
  async choose(@CurrentPlayer() player: Player, @Body() { formatId }: ChooseGameBody): Promise<NextGameDto> {
    return toNextGameDto(await this.choice.choose(player, formatId), player);
  }
}

@Controller('players')
export class PlayersController {
  constructor(@Inject(PLAYER_REPOSITORY) private readonly players: PlayerRepository) {}

  /** Les joueurs, pour les listes de choix (hôte, inscription par l'admin). */
  @Get()
  async list(): Promise<PlayerDto[]> {
    return (await this.players.findAll())
      .map(({ id, pseudo, avatarUrl, active }) => ({ id, pseudo, avatarUrl, active }))
      .sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));
  }
}

/** Page admin. Chaque action vérifie le rôle dans le domaine : un joueur reçoit 403. */
@Controller('admin')
@UseFilters(EventErrorFilter, IdeaErrorFilter)
export class AdminController {
  constructor(
    private readonly seasons: SeasonsService,
    private readonly events: EventsService,
  ) {}

  @Post('seasons')
  async createSeason(@CurrentPlayer() player: Player, @Body() body: SeasonBody): Promise<SeasonDto> {
    return toSeasonDto(
      await this.seasons.create(player, { ...body, startDate: new Date(body.startDate), endDate: new Date(body.endDate) }),
    );
  }

  @Patch('seasons/:id')
  async updateSeason(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateSeasonBody,
  ): Promise<SeasonDto> {
    return toSeasonDto(
      await this.seasons.update(player, id, {
        ...body,
        startDate: toDate(body.startDate) ?? undefined,
        endDate: toDate(body.endDate) ?? undefined,
      }),
    );
  }

  @Post('seasons/:id/start')
  @HttpCode(200)
  async startSeason(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<SeasonDto> {
    return toSeasonDto(await this.seasons.start(player, id));
  }

  @Post('seasons/:id/finish')
  @HttpCode(200)
  async finishSeason(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<SeasonDto> {
    return toSeasonDto(await this.seasons.finish(player, id));
  }

  @Post('events')
  async createEvent(@CurrentPlayer() player: Player, @Body() body: CreateEventBody): Promise<EventDto> {
    return toEventDto(
      await this.events.create(player, {
        seasonId: body.seasonId,
        type: body.type,
        format: toFormatChoice(body.format),
        coefficient: body.coefficient,
        rules: body.rules,
        announceDate: new Date(body.announceDate),
        registrationEnd: new Date(body.registrationEnd),
        endDate: new Date(body.endDate),
        liveDate: toDate(body.liveDate) ?? null,
        hostId: body.hostId ?? null,
        challongeUrl: body.challongeUrl || null,
      }),
    );
  }

  @Patch('events/:id')
  async updateEvent(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateEventBody,
  ): Promise<EventDto> {
    return toEventDto(
      await this.events.update(player, id, {
        coefficient: body.coefficient,
        rules: body.rules,
        announceDate: toDate(body.announceDate) ?? undefined,
        registrationEnd: toDate(body.registrationEnd) ?? undefined,
        endDate: toDate(body.endDate) ?? undefined,
        liveDate: toDate(body.liveDate),
        hostId: body.hostId,
        challongeUrl: body.challongeUrl === undefined ? undefined : body.challongeUrl || null,
      }),
    );
  }

  /** Changement du jeu d'un event pas encore joué. */
  @Put('events/:id/format')
  async changeFormat(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ChangeFormatBody,
  ): Promise<EventDto> {
    return toEventDto(await this.events.changeFormat(player, id, toFormatChoice(body.format)));
  }

  @Post('events/:id/start')
  @HttpCode(200)
  async startEvent(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<EventDto> {
    return toEventDto(await this.events.start(player, id));
  }

  @Post('events/:id/cancel')
  @HttpCode(200)
  async cancelEvent(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<EventDto> {
    return toEventDto(await this.events.cancel(player, id));
  }

  @Put('events/:id/registrations/:playerId')
  async addRegistration(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('playerId', new ParseUUIDPipe()) playerId: string,
  ): Promise<EventDto> {
    return toEventDto(await this.events.addRegistration(player, id, playerId));
  }

  @Delete('events/:id/registrations/:playerId')
  async removeRegistration(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('playerId', new ParseUUIDPipe()) playerId: string,
  ): Promise<EventDto> {
    return toEventDto(await this.events.removeRegistration(player, id, playerId));
  }

  @Put('events/:id/registrations/:playerId/team')
  async assignTeam(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('playerId', new ParseUUIDPipe()) playerId: string,
    @Body() { teamId }: TeamAssignmentBody,
  ): Promise<EventDto> {
    return toEventDto(await this.events.assignTeam(player, id, playerId, teamId));
  }

  @Post('events/:id/teams')
  async createTeam(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string, @Body() { name }: TeamBody): Promise<EventDto> {
    return toEventDto(await this.events.createTeam(player, id, name));
  }

  @Patch('events/:id/teams/:teamId')
  async renameTeam(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Body() { name }: TeamBody,
  ): Promise<EventDto> {
    return toEventDto(await this.events.renameTeam(player, id, teamId, name));
  }

  @Delete('events/:id/teams/:teamId')
  async deleteTeam(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
  ): Promise<EventDto> {
    return toEventDto(await this.events.deleteTeam(player, id, teamId));
  }

  /** Places finales : la première saisie clôt l'event, les suivantes corrigent. */
  @Put('events/:id/results')
  async saveResults(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: ResultsBody): Promise<EventDto> {
    return toEventDto(await this.events.saveResults(player, id, body));
  }

  @Put('events/:id/validated')
  async validate(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() { validated }: ValidationBody,
  ): Promise<EventDto> {
    return toEventDto(await this.events.validate(player, id, validated));
  }
}
