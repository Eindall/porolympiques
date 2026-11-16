import type { EventType } from '../events/event';
import type { PlayerRepository } from '../players/player.repository';
import type { Season } from '../seasons/season';
import type { SeasonRepository } from '../seasons/season.repository';
import { compareSeasons } from '../seasons/seasons.service';
import { computeStandings, countedEventIds } from './compute-standings';
import type { ScoredResult, StandingsEntry, StandingsEvent, StandingsPlayer, StandingsResult } from './standings';
import type { StandingsReader } from './standings.reader';

/** Une médaille : un podium (places 1 à 3) dans un main, ou dans un side qui compte (version discrète). */
export interface Medal {
  playerId: string;
  seasonId: string;
  eventId: string;
  label: string;
  type: EventType;
  place: 1 | 2 | 3;
  endDate: Date;
}

/** La saison d'un joueur : son rang et ses résultats retenus (comptés, écartés, non classé). */
export interface PlayerSeason {
  season: Season;
  rank: number;
  score: number;
  results: ScoredResult[];
}

/** Ce qu'affiche la page d'un joueur. Tout est recalculé à partir des places. */
export interface PlayerRecord {
  player: StandingsPlayer;
  /** Les plus récentes d'abord. */
  seasons: PlayerSeason[];
  /** Les plus récentes d'abord. */
  medals: Medal[];
  /** Saisons terminées dont il est champion, les plus récentes d'abord. */
  trophies: Season[];
}

/** Une saison terminée du palmarès : son podium (rangs 1 à 3, ex æquo compris). */
export interface HallOfFameSeason {
  season: Season;
  podium: StandingsEntry[];
}

/**
 * Médailles de chaque joueur : podiums des mains terminés et des sides qui comptent (validés, au moins 4 classés).
 * Des ex æquo prennent chacun la médaille de leur place.
 */
export function medalsOf(seasonId: string, events: readonly StandingsEvent[], results: readonly StandingsResult[]): Medal[] {
  const counted = countedEventIds(events, results);
  const byId = new Map(events.map((event) => [event.id, event]));
  const medals: Medal[] = [];
  for (const result of results) {
    const event = byId.get(result.eventId);
    if (!event || !counted.has(event.id) || result.place === null || result.place > 3) continue;
    medals.push({ playerId: result.playerId, seasonId, eventId: event.id, label: event.label, type: event.type, place: result.place as 1 | 2 | 3, endDate: event.endDate });
  }
  return medals;
}

/** Champions d'une saison : ses 1ers, seulement une fois la saison terminée (plusieurs en cas d'égalité parfaite). */
export function championsOf(season: Pick<Season, 'status'>, entries: readonly StandingsEntry[]): StandingsEntry[] {
  return season.status === 'finished' ? entries.filter((entry) => entry.rank === 1) : [];
}

interface SeasonData {
  season: Season;
  entries: StandingsEntry[];
  medals: Medal[];
}

/** Page joueur et palmarès, recalculés à chaque demande à partir des places de toutes les saisons. */
export class HonoursService {
  constructor(
    private readonly seasons: Pick<SeasonRepository, 'list'>,
    private readonly reader: StandingsReader,
    private readonly players: Pick<PlayerRepository, 'findById'>,
  ) {}

  /** Null si le joueur n'existe pas. */
  async player(playerId: string): Promise<PlayerRecord | null> {
    const player = await this.players.findById(playerId);
    if (!player) return null;
    const seasons: PlayerSeason[] = [];
    const medals: Medal[] = [];
    const trophies: Season[] = [];
    for (const data of await this.all()) {
      const entry = data.entries.find((item) => item.player.id === playerId);
      if (entry) seasons.push({ season: data.season, rank: entry.rank, score: entry.score, results: entry.results });
      medals.push(...data.medals.filter((medal) => medal.playerId === playerId));
      if (championsOf(data.season, data.entries).some((champion) => champion.player.id === playerId)) trophies.push(data.season);
    }
    medals.sort((a, b) => b.endDate.getTime() - a.endDate.getTime() || a.place - b.place);
    const { id, pseudo, avatarUrl, active } = player;
    return { player: { id, pseudo, avatarUrl, active }, seasons, medals, trophies };
  }

  /** Les saisons terminées, les plus récentes d'abord, avec leur podium. */
  async hallOfFame(): Promise<HallOfFameSeason[]> {
    return (await this.all())
      .filter((data) => data.season.status === 'finished')
      .map((data) => ({ season: data.season, podium: data.entries.filter((entry) => entry.rank <= 3) }));
  }

  private async all(): Promise<SeasonData[]> {
    const seasons = (await this.seasons.list()).sort(compareSeasons);
    return Promise.all(
      seasons.map(async (season) => {
        const { events, results, players } = await this.reader.loadSeasonResults(season.id);
        return { season, entries: computeStandings({ season, events, results, players }), medals: medalsOf(season.id, events, results) };
      }),
    );
  }
}
