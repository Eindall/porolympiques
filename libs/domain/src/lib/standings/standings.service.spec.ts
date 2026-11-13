import { DEFAULT_SCORING_SCALE, type Season } from '../seasons/season';
import type { SeasonRepository } from '../seasons/season.repository';
import type { SeasonResults, StandingsReader } from './standings.reader';
import { StandingsService } from './standings.service';

const season = (overrides: Partial<Season> = {}): Season => ({
  id: 's-1',
  name: 'Saison 1',
  startDate: new Date('2026-01-01T00:00:00Z'),
  endDate: new Date('2026-07-01T00:00:00Z'),
  scoringScale: DEFAULT_SCORING_SCALE,
  mainQuota: 3,
  sideQuota: 2,
  status: 'active',
  ...overrides,
});

function setup(seasons: Season[]) {
  const repository: SeasonRepository = {
    findById: async (id) => seasons.find((s) => s.id === id) ?? null,
    findActive: async () => seasons.find((s) => s.status === 'active') ?? null,
  };
  const loaded: string[] = [];
  const reader: StandingsReader = {
    loadSeasonResults: async (seasonId): Promise<SeasonResults> => {
      loaded.push(seasonId);
      return {
        events: [{ id: 'e', label: 'E', type: 'main', coefficient: 1, status: 'finished', validated: false, endDate: new Date() }],
        results: [{ eventId: 'e', playerId: 'p', place: 1 }],
        players: [{ id: 'p', pseudo: 'Alice', avatarUrl: '', active: true }],
      };
    },
  };
  return { service: new StandingsService(repository, reader), loaded };
}

describe('StandingsService', () => {
  it('classe une saison par son identifiant', async () => {
    const { service, loaded } = setup([season({ id: 's-0', status: 'finished' }), season()]);

    const standings = await service.forSeason('s-0');

    expect(standings?.season.id).toBe('s-0');
    expect(standings?.entries.map((entry) => [entry.player.pseudo, entry.score])).toEqual([['Alice', 24]]);
    expect(loaded).toEqual(['s-0']);
  });

  it('renvoie null pour une saison inconnue', async () => {
    const { service, loaded } = setup([season()]);

    expect(await service.forSeason('inconnue')).toBeNull();
    expect(loaded).toEqual([]);
  });

  it('classe la saison en cours', async () => {
    const { service } = setup([season({ id: 's-0', status: 'finished' }), season()]);

    expect((await service.forActiveSeason())?.season.id).toBe('s-1');
  });

  it('renvoie null sans saison en cours', async () => {
    const { service } = setup([season({ status: 'upcoming' })]);

    expect(await service.forActiveSeason()).toBeNull();
  });
});
