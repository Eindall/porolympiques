import type { Season } from '../seasons/season';
import type { SeasonRepository } from '../seasons/season.repository';
import { computeStandings } from './compute-standings';
import type { StandingsEntry } from './standings';
import type { StandingsReader } from './standings.reader';

export interface SeasonStandings {
  season: Season;
  entries: StandingsEntry[];
}

/** Classement d'une saison, recalculé à chaque demande à partir des places. */
export class StandingsService {
  constructor(
    private readonly seasons: SeasonRepository,
    private readonly reader: StandingsReader,
  ) {}

  /** Null si la saison n'existe pas. */
  async forSeason(seasonId: string): Promise<SeasonStandings | null> {
    const season = await this.seasons.findById(seasonId);
    return season ? this.standingsOf(season) : null;
  }

  /** Null s'il n'y a pas de saison en cours. */
  async forActiveSeason(): Promise<SeasonStandings | null> {
    const season = await this.seasons.findActive();
    return season ? this.standingsOf(season) : null;
  }

  private async standingsOf(season: Season): Promise<SeasonStandings> {
    const { events, results, players } = await this.reader.loadSeasonResults(season.id);
    return { season, entries: computeStandings({ season, events, results, players }) };
  }
}
