import { computeStandings } from './compute-standings';
import { FICTIONAL_SEASON, fictionalCoefficient, fictionalPlaces } from './fictional-season';

describe('Saison fictive', () => {
  const entries = computeStandings({
    season: FICTIONAL_SEASON,
    events: FICTIONAL_SEASON.events.map((event) => ({
      id: event.key,
      label: `${event.game} — ${event.format}`,
      type: event.type,
      coefficient: fictionalCoefficient(event),
      status: event.status,
      validated: event.validated,
      endDate: new Date(event.endDate),
    })),
    results: fictionalPlaces().map(({ event, player, place }) => ({ eventId: event, playerId: player, place })),
    players: FICTIONAL_SEASON.players.map(({ key, pseudo }) => ({ id: key, pseudo, avatarUrl: '', active: true })),
  });
  const entryOf = (key: string) => entries.find((entry) => entry.player.id === key);

  it('donne le classement attendu', () => {
    expect(entries.map(({ rank, player, score, wins }) => ({ rank, player: player.id, score, wins }))).toEqual(
      FICTIONAL_SEASON.expected,
    );
  });

  it('départage Alice et Bruno par le meilleur résultat écarté', () => {
    const discarded = (key: string) =>
      entryOf(key)?.results.filter((result) => result.status === 'discarded').map((result) => result.points);
    expect([discarded('alice'), discarded('bruno')]).toEqual([[14], [12]]);
  });

  it('ignore le side non validé, le side à 3 classés, le main en cours et le main annulé', () => {
    const playedEvents = new Set(entries.flatMap((entry) => entry.results.map((result) => result.eventId)));
    expect([...playedEvents].sort()).toEqual(['m1', 'm2', 'm3', 'm4', 's1', 's4']);
  });

  it('donne à chaque membre d’une équipe la place de son équipe', () => {
    const m3 = (key: string) => entryOf(key)?.results.find((result) => result.eventId === 'm3')?.place;
    expect(['chloe', 'david', 'emma', 'farid', 'alice', 'bruno'].map(m3)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});
