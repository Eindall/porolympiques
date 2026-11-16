import { InMemoryPlayers, player } from '../players/test-helpers';
import { season } from '../events/test-helpers';
import type { Season } from '../seasons/season';
import { HonoursService, championsOf, medalsOf } from './honours';
import type { StandingsEntry, StandingsEvent, StandingsResult } from './standings';
import type { SeasonResults, StandingsReader } from './standings.reader';

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

const event = (id: string, overrides: Partial<StandingsEvent> = {}): StandingsEvent => ({
  id,
  label: `Jeu ${id}`,
  type: 'main',
  coefficient: 1,
  status: 'finished',
  validated: false,
  endDate: at('2026-02-01'),
  ...overrides,
});

const places = (eventId: string, list: [string, number | null][]): StandingsResult[] =>
  list.map(([playerId, place]) => ({ eventId, playerId, place }));

describe('medalsOf', () => {
  it('donne or, argent et bronze au podium d’un main, deux bronzes aux ex æquo', () => {
    const medals = medalsOf('s', [event('m')], places('m', [['a', 1], ['b', 2], ['c', 3], ['d', 3], ['e', 5], ['f', null]]));

    expect(medals.map((medal) => [medal.playerId, medal.place])).toEqual([['a', 1], ['b', 2], ['c', 3], ['d', 3]]);
  });

  it('ne donne rien pour un side qui ne compte pas, ni pour un event pas terminé', () => {
    const four: [string, number][] = [['a', 1], ['b', 2], ['c', 3], ['d', 4]];
    const events = [
      event('validé', { type: 'side', validated: true }),
      event('non-validé', { type: 'side' }),
      event('trop-petit', { type: 'side', validated: true }),
      event('en-cours', { status: 'in_progress' }),
    ];
    const results = [
      ...places('validé', four),
      ...places('non-validé', four),
      ...places('trop-petit', [['a', 1], ['b', 2], ['c', 3], ['d', null]]),
      ...places('en-cours', four),
    ];

    expect(new Set(medalsOf('s', events, results).map((medal) => medal.eventId))).toEqual(new Set(['validé']));
  });
});

describe('championsOf', () => {
  const entry = (id: string, rank: number) => ({ rank, player: { id } }) as StandingsEntry;

  it('donne le titre aux 1ers d’une saison terminée, ex æquo compris', () => {
    expect(championsOf({ status: 'finished' }, [entry('a', 1), entry('b', 1), entry('c', 3)]).map((e) => e.player.id)).toEqual(['a', 'b']);
  });

  it('ne donne rien pendant la saison', () => {
    expect(championsOf({ status: 'active' }, [entry('a', 1)])).toEqual([]);
  });
});

describe('HonoursService', () => {
  const seasons: Season[] = [
    season({ id: 's-old', name: 'Saison 1', status: 'finished', startDate: at('2025-07-01') }),
    season({ id: 's-now', name: 'Saison 2', status: 'active', startDate: at('2026-01-01') }),
  ];
  const data: Record<string, SeasonResults> = {
    's-old': {
      events: [event('old', { endDate: at('2025-08-01') })],
      results: places('old', [['p-alice', 1], ['p-bruno', 2]]),
      players: [],
    },
    's-now': {
      events: [event('now', { endDate: at('2026-02-01') }), event('side', { type: 'side', validated: true, coefficient: 0.5, endDate: at('2026-02-10') })],
      results: [
        ...places('now', [['p-bruno', 1], ['p-alice', 3]]),
        ...places('side', [['p-alice', 2], ['p-bruno', 1], ['p-chloe', 3], ['p-david', 4]]),
      ],
      players: [],
    },
  };
  const people = ['alice', 'bruno', 'chloe', 'david'].map((name, index) =>
    player({ id: `p-${name}`, pseudo: name, discordId: String(index) }),
  );
  for (const results of Object.values(data)) results.players = people.map(({ id, pseudo, avatarUrl, active }) => ({ id, pseudo, avatarUrl, active }));
  const reader: StandingsReader = { loadSeasonResults: async (id) => data[id] };
  const service = new HonoursService({ list: async () => seasons }, reader, new InMemoryPlayers(people));

  it('rassemble les saisons, médailles et trophées d’un joueur, les plus récents d’abord', async () => {
    const record = await service.player('p-alice');

    expect(record?.seasons.map((item) => [item.season.id, item.rank, item.score])).toEqual([
      ['s-now', 2, 23],
      ['s-old', 1, 24],
    ]);
    expect(record?.seasons[0].results.map((result) => result.status)).toEqual(['counted', 'counted']);
    expect(record?.medals.map((medal) => [medal.eventId, medal.place])).toEqual([['side', 2], ['now', 3], ['old', 1]]);
    expect(record?.trophies.map((item) => item.id)).toEqual(['s-old']);
  });

  it('montre un joueur sans résultat, et rien pour un joueur inconnu', async () => {
    expect(await service.player('p-inconnu')).toBeNull();
    expect(await service.player('p-david')).toMatchObject({ medals: [], trophies: [], seasons: [{ season: { id: 's-now' }, rank: 4 }] });
  });

  it('dresse le palmarès des saisons terminées seulement', async () => {
    const hall = await service.hallOfFame();

    expect(hall.map((item) => [item.season.id, item.podium.map((entry) => [entry.rank, entry.player.pseudo])])).toEqual([
      ['s-old', [[1, 'alice'], [2, 'bruno']]],
    ]);
  });
});
