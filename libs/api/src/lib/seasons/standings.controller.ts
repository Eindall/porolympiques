import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { type SeasonStandings, StandingsService } from '@porolympiques/domain';
import type { SeasonStandingsDto } from '@porolympiques/shared';

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

function toDto({ season, entries }: SeasonStandings): SeasonStandingsDto {
  return {
    season: {
      id: season.id,
      name: season.name,
      status: season.status,
      startDate: season.startDate.toISOString(),
      endDate: season.endDate.toISOString(),
      mainQuota: season.mainQuota,
      sideQuota: season.sideQuota,
    },
    entries: entries.map((entry) => ({
      rank: entry.rank,
      player: entry.player,
      score: entry.score,
      wins: entry.wins,
      results: entry.results.map((result) => ({ ...result, endDate: result.endDate.toISOString() })),
    })),
  };
}
