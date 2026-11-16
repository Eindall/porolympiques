import { HomeService, timelineOf } from './timeline';
import type { EventSummary } from './event';
import type { StandingsEntry } from '../standings/standings';

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const now = at('2026-02-10');

const summary = (id: string, overrides: Partial<EventSummary> = {}) =>
  ({ id, status: 'registration', announceDate: at('2026-02-01'), endDate: at('2026-02-28'), ...overrides }) as EventSummary;

describe('timelineOf', () => {
  it('range un event selon son annonce et son statut', () => {
    expect(timelineOf({ status: 'registration', announceDate: at('2026-03-01') }, now)).toBe('upcoming');
    expect(timelineOf({ status: 'registration', announceDate: at('2026-02-01') }, now)).toBe('ongoing');
    expect(timelineOf({ status: 'in_progress', announceDate: at('2026-02-01') }, now)).toBe('ongoing');
    expect(timelineOf({ status: 'finished', announceDate: at('2026-02-01') }, now)).toBe('past');
    expect(timelineOf({ status: 'cancelled', announceDate: at('2026-03-01') }, now)).toBe('past');
  });
});

describe('HomeService', () => {
  const entry = (rank: number) => ({ rank, player: { id: `p-${rank}` } }) as StandingsEntry;

  it('montre les events en cours, le prochain à annoncer et le top 5, ex æquo compris', async () => {
    const events = [
      summary('main', { endDate: at('2026-02-28') }),
      summary('side', { endDate: at('2026-02-15') }),
      summary('plus-tard', { announceDate: at('2026-04-01') }),
      summary('bientôt', { announceDate: at('2026-03-01') }),
    ];
    const entries = [1, 2, 3, 4, 5, 5, 7].map(entry);
    const service = new HomeService(
      { listOpen: async () => events },
      { forActiveSeason: async () => ({ season: { id: 's-1' } as never, entries }) },
      () => now,
    );

    const home = await service.home();

    expect(home.ongoing.map((event) => event.id)).toEqual(['side', 'main']);
    expect(home.next?.id).toBe('bientôt');
    expect(home.top.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5, 5]);
  });

  it('reste vide sans saison ni event', async () => {
    const service = new HomeService({ listOpen: async () => [] }, { forActiveSeason: async () => null }, () => now);

    expect(await service.home()).toEqual({ ongoing: [], next: null, season: null, top: [] });
  });
});
