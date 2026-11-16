import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { HomeService, HonoursService } from '@porolympiques/domain';
import type { HallOfFameDto, HomeDto, PlayerRecordDto } from '@porolympiques/shared';
import { toEventSummaryDto } from '../events/events.controller';
import { toEntryDto, toScoredResultDto, toSeasonSummaryDto } from './standings.controller';

/** Page joueur, palmarès et accueil : tout est recalculé à partir des places. */
@Controller()
export class HonoursController {
  constructor(
    private readonly honours: HonoursService,
    private readonly homeService: HomeService,
  ) {}

  @Get('players/:id')
  async player(@Param('id', new ParseUUIDPipe()) id: string): Promise<PlayerRecordDto> {
    const record = await this.honours.player(id);
    if (!record) throw new NotFoundException('Joueur introuvable');
    return {
      player: record.player,
      seasons: record.seasons.map(({ season, rank, score, results }) => ({
        season: toSeasonSummaryDto(season),
        rank,
        score,
        results: results.map(toScoredResultDto),
      })),
      medals: record.medals.map(({ seasonId, eventId, label, type, place, endDate }) => ({
        seasonId,
        eventId,
        label,
        type,
        place,
        endDate: endDate.toISOString(),
      })),
      trophies: record.trophies.map(toSeasonSummaryDto),
    };
  }

  @Get('hall-of-fame')
  async hallOfFame(): Promise<HallOfFameDto> {
    const seasons = await this.honours.hallOfFame();
    return { seasons: seasons.map(({ season, podium }) => ({ season: toSeasonSummaryDto(season), podium: podium.map(toEntryDto) })) };
  }

  @Get('home')
  async home(): Promise<HomeDto> {
    const home = await this.homeService.home();
    return {
      ongoing: home.ongoing.map(toEventSummaryDto),
      next: home.next ? toEventSummaryDto(home.next) : null,
      season: home.season ? toSeasonSummaryDto(home.season) : null,
      top: home.top.map(toEntryDto),
    };
  }
}
