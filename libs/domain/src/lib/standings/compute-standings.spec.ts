import type { EventType } from '../events/event';
import { DEFAULT_SCORING_SCALE } from '../seasons/season';
import { computeStandings } from './compute-standings';
import type { StandingsEntry, StandingsEvent, StandingsInput, StandingsPlayer, StandingsResult } from './standings';

/**
 * Petit constructeur de saison : `event('main', { a: 1, b: 2 })` crée un main terminé où `a` finit 1er
 * et `b` 2e. Les joueurs sont créés à la volée, avec leur clé pour pseudo.
 */
function season(options: Partial<StandingsInput['season']> = {}) {
  const events: StandingsEvent[] = [];
  const results: StandingsResult[] = [];
  const players = new Map<string, StandingsPlayer>();

  const builder = {
    event(type: EventType, places: Record<string, number | null>, overrides: Partial<StandingsEvent> = {}) {
      const id = `e${events.length + 1}`;
      events.push({
        id,
        label: `Event ${events.length + 1}`,
        type,
        coefficient: type === 'main' ? 1 : 0.5,
        status: 'finished',
        validated: type === 'side',
        endDate: new Date(Date.UTC(2026, 0, events.length + 1)),
        ...overrides,
      });
      for (const [player, place] of Object.entries(places)) {
        if (!players.has(player)) players.set(player, { id: player, pseudo: player, avatarUrl: '', active: true });
        results.push({ eventId: id, playerId: player, place });
      }
      return builder;
    },
    standings(): StandingsEntry[] {
      return computeStandings({
        season: { scoringScale: DEFAULT_SCORING_SCALE, mainQuota: 3, sideQuota: 2, ...options },
        events,
        results,
        players: [...players.values()],
      });
    },
  };
  return builder;
}

/** Résumé lisible : `pseudo rang score`. */
const summary = (entries: StandingsEntry[]) => entries.map((entry) => `${entry.player.pseudo} ${entry.rank} ${entry.score}`);
const entryOf = (entries: StandingsEntry[], pseudo: string) =>
  entries.find((entry) => entry.player.pseudo === pseudo) as StandingsEntry;

describe('computeStandings', () => {
  it('classe une saison vide sans erreur', () => {
    expect(season().standings()).toEqual([]);
  });

  describe('points', () => {
    it('additionne les points des mains et des sides selon le barème et le coefficient', () => {
      const entries = season()
        .event('main', { a: 1, b: 2, c: 3, d: 9 })
        .event('side', { a: 2, b: 1, c: 4, d: 3 })
        .standings();

      expect(summary(entries)).toEqual(['a 1 33', 'b 2 30', 'c 3 20', 'd 4 9']);
    });

    it('donne les points de la 3e place aux deux ex æquo, et la 5e place au suivant', () => {
      const entries = season().event('main', { a: 1, b: 2, c: 3, d: 3, e: 5 }).standings();

      expect(summary(entries)).toEqual(['a 1 24', 'b 2 18', 'c 3 14', 'd 3 14', 'e 5 10']);
    });

    it('donne zéro point à un inscrit non classé, qui apparaît quand même au classement', () => {
      const entries = season().event('main', { a: 1, b: null }).standings();

      expect(summary(entries)).toEqual(['a 1 24', 'b 2 0']);
      expect(entryOf(entries, 'b').results).toEqual([
        expect.objectContaining({ place: null, points: 0, status: 'unranked' }),
      ]);
    });

    it('donne la place de son équipe à chaque membre (une place par membre)', () => {
      const entries = season().event('main', { a: 1, b: 1, c: 2, d: 2 }).standings();

      expect(summary(entries)).toEqual(['a 1 24', 'b 1 24', 'c 3 18', 'd 3 18']);
    });

    it('suit le barème et les quotas de la saison', () => {
      const entries = season({ scoringScale: { 1: 10, 2: 5, 3: 1 }, mainQuota: 1, sideQuota: 0 })
        .event('main', { a: 1, b: 2, c: 3, d: 7 })
        .event('main', { a: 2, b: 1 })
        .event('side', { a: 1, b: 2, c: 3, d: 4 })
        .standings();

      expect(summary(entries)).toEqual(['a 1 10', 'b 2 10', 'c 3 1', 'd 3 1']);
    });

    it('suit le coefficient de chaque event, même hors des valeurs par défaut', () => {
      const entries = season().event('main', { a: 1 }, { coefficient: 1.5 }).standings();

      expect(entries[0].score).toBe(36);
    });
  });

  describe('events retenus', () => {
    it('ignore les events qui ne sont pas terminés', () => {
      const entries = season()
        .event('main', { a: 1 }, { status: 'in_progress' })
        .event('main', { b: 1 }, { status: 'cancelled' })
        .event('main', { c: 1 }, { status: 'registration' })
        .event('main', { d: 1 })
        .standings();

      expect(summary(entries)).toEqual(['d 1 24']);
    });

    it('ignore un side non validé, qui ne compte ni comme résultat écarté ni comme victoire', () => {
      const entries = season()
        .event('main', { a: 1, b: 1 })
        .event('side', { a: 1, b: 2, c: 3, d: 4 }, { validated: false })
        .standings();

      const a = entryOf(entries, 'a');
      expect([a.score, a.wins, a.results.length]).toEqual([24, 1, 1]);
      expect(summary(entries)).toEqual(['a 1 24', 'b 1 24', 'c 3 0', 'd 3 0']);
    });

    it('ignore un side validé à moins de 4 classés, les non classés ne comptant pas', () => {
      const entries = season().event('side', { a: 1, b: 2, c: 3, d: null }).standings();

      expect(summary(entries)).toEqual(['a 1 0', 'b 1 0', 'c 1 0', 'd 1 0']);
      expect(entryOf(entries, 'a').results).toEqual([]);
    });

    it('compte un side validé à 4 classés tout juste', () => {
      const entries = season().event('side', { a: 1, b: 2, c: 3, d: 4, e: null }).standings();

      expect(summary(entries)).toEqual(['a 1 12', 'b 2 9', 'c 3 7', 'd 4 6', 'e 5 0']);
    });

    it('ne demande pas de validation pour un main, quel que soit le nombre de classés', () => {
      const entries = season().event('main', { a: 1 }, { validated: false }).standings();

      expect(summary(entries)).toEqual(['a 1 24']);
    });

    it('ignore les résultats d’events d’une autre saison, absents de la liste', () => {
      const entries = computeStandings({
        season: { scoringScale: DEFAULT_SCORING_SCALE, mainQuota: 3, sideQuota: 2 },
        events: [],
        results: [{ eventId: 'ailleurs', playerId: 'a', place: 1 }],
        players: [{ id: 'a', pseudo: 'a', avatarUrl: '', active: true }],
      });

      expect(entries).toEqual([]);
    });
  });

  describe('quotas', () => {
    it('ne compte que les 3 meilleurs mains et les 2 meilleurs sides, et écarte les autres', () => {
      const entries = season()
        .event('main', { a: 4, x: 1 })
        .event('main', { a: 1, x: 2 })
        .event('main', { a: 9, x: 3 })
        .event('main', { a: 2, x: 4 })
        .event('side', { a: 3, b: 1, c: 2, d: 4 })
        .event('side', { a: 1, b: 2, c: 3, d: 4 })
        .event('side', { a: 4, b: 1, c: 2, d: 3 })
        .standings();

      const a = entryOf(entries, 'a');
      // Mains : 24 + 18 + 12, écarté 2. Sides : 12 + 7, écarté 6.
      expect(a.score).toBe(73);
      expect(a.results.map((result) => [result.eventId, result.points, result.status])).toEqual([
        ['e1', 12, 'counted'],
        ['e2', 24, 'counted'],
        ['e3', 2, 'discarded'],
        ['e4', 18, 'counted'],
        ['e5', 7, 'counted'],
        ['e6', 12, 'counted'],
        ['e7', 6, 'discarded'],
      ]);
    });

    it('à points égaux, compte le résultat le plus ancien', () => {
      const entries = season()
        .event('main', { a: 1 })
        .event('main', { a: 1 })
        .event('main', { a: 1 })
        .event('main', { a: 1 })
        .standings();

      expect(entries[0].results.map((result) => result.status)).toEqual(['counted', 'counted', 'counted', 'discarded']);
    });

    it('ne prend pas de place dans les quotas avec un non classé', () => {
      const entries = season({ mainQuota: 1 }).event('main', { a: null }).event('main', { a: 5 }).standings();

      expect(entries[0].score).toBe(10);
      expect(entries[0].results.map((result) => result.status)).toEqual(['unranked', 'counted']);
    });
  });

  describe('départage', () => {
    it('départage une égalité au score par le meilleur résultat écarté', () => {
      // a : 24 + 24 + 24, écarté 14. b : 24 + 24 + 24, écartés 24 et 18.
      const entries = season()
        .event('main', { a: 1, b: 2 })
        .event('main', { b: 1, a: 3 })
        .event('main', { a: 1, b: 1 })
        .event('main', { a: 1, b: 1 })
        .event('main', { b: 1 })
        .standings();

      expect(summary(entries)).toEqual(['b 1 72', 'a 2 72']);
    });

    it('compare les résultats écartés du meilleur au moins bon, main et side confondus', () => {
      // Mêmes mains comptés et même meilleur écarté (14) ; puis a a encore un side écarté à 6, b un main écarté à 4.
      const entries = season({ mainQuota: 1, sideQuota: 0 })
        .event('main', { a: 1, b: 1 })
        .event('main', { a: 3, b: 3 })
        .event('main', { b: 8 })
        .event('side', { a: 4, x: 1, y: 2, z: 3 })
        .standings();

      expect(summary(entries).slice(0, 2)).toEqual(['a 1 24', 'b 2 24']);
    });

    it('fait passer devant celui qui a un résultat écarté face à celui qui n’en a pas', () => {
      const entries = season({ mainQuota: 1 })
        .event('main', { a: 1, b: 1 })
        .event('main', { b: 9 })
        .standings();

      expect(summary(entries)).toEqual(['b 1 24', 'a 2 24']);
    });

    it('départage ensuite au nombre de victoires, sides comptés inclus', () => {
      // a : main 3e (14) + side 1er (12) = 26, 1 victoire. b : main 3e (14) + sides 3e et 5e (7 + 5) = 26, 0 victoire.
      const entries = season()
        .event('main', { a: 3, b: 3 })
        .event('side', { a: 1, b: 3, x: 2, y: 4 })
        .event('side', { b: 5, x: 1, y: 2, z: 3 })
        .standings();

      expect(summary(entries).slice(0, 2)).toEqual(['a 1 26', 'b 2 26']);
      expect([entryOf(entries, 'a').wins, entryOf(entries, 'b').wins]).toEqual([1, 0]);
    });

    it('compte aussi les victoires écartées', () => {
      const entries = season({ mainQuota: 0 }).event('main', { a: 1, b: 2 }).standings();

      expect(entryOf(entries, 'a').wins).toBe(1);
    });

    it('partage la place en cas d’égalité parfaite, affichée par ordre alphabétique de pseudo', () => {
      const entries = season()
        .event('main', { zoé: 1, Émile: 2, anna: 2, bob: 4 })
        .event('main', { Émile: 1, zoé: 2, anna: 2 })
        .standings();

      expect(summary(entries)).toEqual(['Émile 1 42', 'zoé 1 42', 'anna 3 36', 'bob 4 12']);
    });

    it('fait sauter les rangs après une place partagée (1, 2, 2, 4)', () => {
      const entries = season().event('main', { a: 1, b: 2, c: 2, d: 4 }).standings();

      expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 2, 4]);
    });
  });

  it('garde au classement un joueur parti du serveur', () => {
    const entries = computeStandings({
      season: { scoringScale: DEFAULT_SCORING_SCALE, mainQuota: 3, sideQuota: 2 },
      events: [{ id: 'e', label: 'E', type: 'main', coefficient: 1, status: 'finished', validated: false, endDate: new Date() }],
      results: [{ eventId: 'e', playerId: 'a', place: 1 }],
      players: [{ id: 'a', pseudo: 'a', avatarUrl: '', active: false }],
    });

    expect(entries[0]).toEqual(expect.objectContaining({ rank: 1, score: 24, player: expect.objectContaining({ active: false }) }));
  });

  it('refuse un résultat d’un joueur inconnu', () => {
    expect(() =>
      computeStandings({
        season: { scoringScale: DEFAULT_SCORING_SCALE, mainQuota: 3, sideQuota: 2 },
        events: [{ id: 'e', label: 'E', type: 'main', coefficient: 1, status: 'finished', validated: false, endDate: new Date() }],
        results: [{ eventId: 'e', playerId: 'fantôme', place: 1 }],
        players: [],
      }),
    ).toThrow('joueur inconnu');
  });

  it('refuse un barème invalide', () => {
    expect(() => season({ scoringScale: {} }).standings()).toThrow('Barème invalide');
  });
});
