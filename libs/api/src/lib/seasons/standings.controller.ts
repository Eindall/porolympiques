import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { type ScoredResult, type Season, type SeasonStandings, type StandingsEntry, StandingsService } from '@porolympiques/domain';
import type { ScoredResultDto, SeasonStandingsDto, SeasonSummaryDto, StandingsEntryDto } from '@porolympiques/shared';

@Controller('seasons')
export class StandingsController {
  constructor(private readonly standings: StandingsService) {}

  /** Classement de la saison en cours. Déclarée avant `:id` pour que « current » ne soit pas pris pour un identifiant. */
  @Get('current/standings')
  async current(): Promise<SeasonStandingsDto> {
    const standings = await this.standings.forActiveSeason();
    if (!standings) throw new NotFoundException('Aucune saison en cours');
    return toDto(standings);
  }

  @Get(':id/standings')
  async bySeason(@Param('id', new ParseUUIDPipe()) id: string): Promise<SeasonStandingsDto> {
    const standings = await this.standings.forSeason(id);
    if (!standings) throw new NotFoundException('Saison introuvable');
    return toDto(standings);
  }
}

export function toSeasonSummaryDto(season: Season): SeasonSummaryDto {
  return {
    id: season.id,
    name: season.name,
    status: season.status,
    startDate: season.startDate.toISOString(),
    endDate: season.endDate.toISOString(),
    mainQuota: season.mainQuota,
    sideQuota: season.sideQuota,
  };
}

export function toScoredResultDto(result: ScoredResult): ScoredResultDto {
  return { ...result, endDate: result.endDate.toISOString() };
}

export function toEntryDto(entry: StandingsEntry): StandingsEntryDto {
  return { rank: entry.rank, player: entry.player, score: entry.score, wins: entry.wins, results: entry.results.map(toScoredResultDto) };
}

function toDto({ season, entries }: SeasonStandings): SeasonStandingsDto {
  return { season: toSeasonSummaryDto(season), entries: entries.map(toEntryDto) };
}
