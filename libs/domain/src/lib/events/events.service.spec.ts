import { IdeasService } from '../ideas/ideas.service';
import { FakeCatalog, InMemoryCovers, InMemoryGames, InMemoryIdeas, customGame } from '../ideas/test-helpers';
import { InMemoryPlayers, player } from '../players/test-helpers';
import { computeStandings } from '../standings/compute-standings';
import { type EventInput, EventsService, resultsFor, sideWarnings } from './events.service';
import { InMemoryEvents, InMemorySeasons, season } from './test-helpers';

const admin = { id: 'p-admin', role: 'admin' as const };
const alice = { id: 'p-alice', role: 'player' as const };
const bruno = { id: 'p-bruno', role: 'player' as const };

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

function setup() {
  let now = at('2026-02-01');
  const games = new InMemoryGames([customGame('g-1', 'Trackmania'), customGame('g-2', 'Among Us')]);
  const ideas = new InMemoryIdeas(games);
  const players = new InMemoryPlayers([
    player({ id: 'p-admin', pseudo: 'Tong', role: 'admin', discordId: '9' }),
    player({ id: 'p-alice', pseudo: 'Alice', discordId: '1' }),
    player({ id: 'p-bruno', pseudo: 'Bruno', discordId: '2' }),
    player({ id: 'p-chloe', pseudo: 'Chloé', discordId: '3' }),
    player({ id: 'p-david', pseudo: 'David', discordId: '4' }),
    player({ id: 'p-gone', pseudo: 'Parti', discordId: '5', active: false }),
  ]);
  const seasons = new InMemorySeasons([season(), season({ id: 's-old', status: 'finished' })]);
  const events = new InMemoryEvents(games, ideas, players);
  const ideasService = new IdeasService(ideas, games, new FakeCatalog(), new InMemoryCovers());
  const service = new EventsService(events, seasons, players, ideas, ideasService, () => now);
  const format = async (name: string, teamMode: 'solo' | 'team' = 'solo', gameId = 'g-1') =>
    (await ideasService.suggest(alice, { game: { kind: 'existing', gameId }, priceTier: null, name, description: '', teamMode, playMode: 'async' })).id;
  return { games, ideas, players, seasons, events, service, format, setNow: (date: Date) => (now = date) };
}

const eventInput = (formatId: string, overrides: Partial<EventInput> = {}): EventInput => ({
  seasonId: 's-1',
  type: 'main',
  format: { kind: 'existing', formatId },
  announceDate: at('2026-02-01'),
  registrationEnd: at('2026-02-21'),
  endDate: at('2026-02-28'),
  ...overrides,
});

describe('EventsService', () => {
  describe('création', () => {
    it('crée un main ouvert aux inscriptions, au coefficient 1, et retient son format', async () => {
      const { service, format, ideas } = setup();
      const formatId = await format('Speedrun');

      const event = await service.create(admin, eventInput(formatId, { rules: '  Meilleur chrono.  ' }));

      expect(event).toMatchObject({ type: 'main', coefficient: 1, status: 'registration', rules: 'Meilleur chrono.', registrationOpen: true });
      expect(ideas.formats.get(formatId)?.status).toBe('selected');
    });

    it('met un side au coefficient 0,5 et crée son format au nom de l’hôte', async () => {
      const { service, ideas } = setup();

      const event = await service.create(admin, {
        ...eventInput('', { type: 'side', hostId: 'p-bruno' }),
        format: { kind: 'new', idea: { game: { kind: 'existing', gameId: 'g-2' }, priceTier: null, name: 'Imposteurs', description: '', teamMode: 'solo', playMode: 'live' } },
      });

      expect(event).toMatchObject({ type: 'side', coefficient: 0.5, host: { pseudo: 'Bruno' }, format: { name: 'Imposteurs', status: 'selected' } });
      expect(ideas.formats.get(event.formatId)?.suggestedById).toBe('p-bruno');
    });

    it('est réservée à l’admin', async () => {
      const { service, format } = setup();
      await expect(service.create(alice, eventInput(await format('Speedrun')))).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('refuse une saison terminée, des dates dans le désordre, un hôte parti et un lien non https', async () => {
      const { service, format } = setup();
      const formatId = await format('Speedrun');

      await expect(service.create(admin, eventInput(formatId, { seasonId: 's-old' }))).rejects.toMatchObject({ code: 'closed' });
      await expect(service.create(admin, eventInput(formatId, { registrationEnd: at('2026-01-01') }))).rejects.toMatchObject({ code: 'invalid' });
      await expect(service.create(admin, eventInput(formatId, { endDate: at('2026-02-10') }))).rejects.toMatchObject({ code: 'invalid' });
      await expect(service.create(admin, eventInput(formatId, { liveDate: at('2026-03-10') }))).rejects.toMatchObject({ code: 'invalid' });
      await expect(service.create(admin, eventInput(formatId, { hostId: 'p-gone' }))).rejects.toMatchObject({ code: 'invalid' });
      await expect(service.create(admin, eventInput(formatId, { challongeUrl: 'javascript:alert(1)' }))).rejects.toMatchObject({ code: 'invalid' });
      await expect(service.create(admin, eventInput(formatId, { coefficient: 0 }))).rejects.toMatchObject({ code: 'invalid' });
    });

    it('refuse un format déjà retenu pour un autre event en cours', async () => {
      const { service, format } = setup();
      const formatId = await format('Speedrun');
      await service.create(admin, eventInput(formatId));

      await expect(service.create(admin, eventInput(formatId, { type: 'side' }))).rejects.toMatchObject({ code: 'conflict' });
    });
  });

  describe('inscription', () => {
    it('inscrit un joueur une seule fois, jusqu’à la fin des inscriptions', async () => {
      const { service, format, setNow } = setup();
      const event = await service.create(admin, eventInput(await format('Speedrun')));

      expect(await service.register(alice, event.id)).toMatchObject({ registeredByMe: true, registrationCount: 1 });
      await expect(service.register(alice, event.id)).rejects.toMatchObject({ code: 'conflict' });

      setNow(at('2026-02-21'));
      await expect(service.register(bruno, event.id)).rejects.toMatchObject({ code: 'closed' });
    });

    it('ferme les inscriptions dès que l’event commence', async () => {
      const { service, format } = setup();
      const event = await service.create(admin, eventInput(await format('Speedrun')));

      await service.start(admin, event.id);

      await expect(service.register(alice, event.id)).rejects.toMatchObject({ code: 'closed' });
    });

    it('laisse l’admin inscrire après la date ou retirer un inscrit, tant que l’event n’est pas clos', async () => {
      const { service, format, setNow } = setup();
      const event = await service.create(admin, eventInput(await format('Speedrun')));
      setNow(at('2026-02-25'));

      await service.addRegistration(admin, event.id, 'p-bruno');
      await expect(service.addRegistration(admin, event.id, 'p-gone')).rejects.toMatchObject({ code: 'invalid' });
      await expect(service.removeRegistration(bruno, event.id, 'p-bruno')).rejects.toMatchObject({ code: 'forbidden' });
      expect((await service.removeRegistration(admin, event.id, 'p-bruno')).registrations).toEqual([]);

      await service.saveResults(admin, event.id, {});
      await expect(service.addRegistration(admin, event.id, 'p-bruno')).rejects.toMatchObject({ code: 'closed' });
    });
  });

  describe('équipes', () => {
    it('compose les équipes d’un event par équipe', async () => {
      const { service, format } = setup();
      const event = await service.create(admin, eventInput(await format('Relais', 'team')));
      await service.register(alice, event.id);

      const withTeam = await service.createTeam(admin, event.id, ' Les Bleus ');
      const team = withTeam.teams[0];
      await expect(service.createTeam(admin, event.id, 'les bleus')).rejects.toMatchObject({ code: 'conflict' });
      const assigned = await service.assignTeam(admin, event.id, 'p-alice', team.id);
      expect(assigned.registrations).toEqual([expect.objectContaining({ playerId: 'p-alice', teamId: team.id })]);

      await service.renameTeam(admin, event.id, team.id, 'Les Rouges');
      const deleted = await service.deleteTeam(admin, event.id, team.id);
      expect(deleted.teams).toEqual([]);
      expect(deleted.registrations[0].teamId).toBeNull();
    });

    it('refuse les équipes pour un event solo, et une équipe d’un autre event', async () => {
      const { service, format } = setup();
      const solo = await service.create(admin, eventInput(await format('Speedrun')));
      const team = await service.create(admin, eventInput(await format('Relais', 'team')));
      const { teams } = await service.createTeam(admin, team.id, 'Les Bleus');

      await expect(service.createTeam(admin, solo.id, 'Les Bleus')).rejects.toMatchObject({ code: 'invalid' });
      await service.register(alice, team.id);
      const other = await service.create(admin, eventInput(await format('Relais 2', 'team')));
      await expect(service.renameTeam(admin, other.id, teams[0].id, 'X')).rejects.toMatchObject({ code: 'not_found' });
      await expect(service.assignTeam(admin, team.id, 'p-bruno', teams[0].id)).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('résultats et clôture', () => {
    it('clôt l’event à la première saisie : votes effacés, format proposé, inscrits sans place non classés', async () => {
      const { service, format, ideas, setNow } = setup();
      const formatId = await format('Speedrun');
      const event = await service.create(admin, eventInput(formatId));
      for (const id of ['p-alice', 'p-bruno', 'p-chloe']) await service.addRegistration(admin, event.id, id);
      setNow(at('2026-03-01'));

      const closed = await service.saveResults(admin, event.id, {
        players: [
          { playerId: 'p-alice', place: 1 },
          { playerId: 'p-bruno', place: 1 },
        ],
      });

      expect(closed).toMatchObject({ status: 'finished', finishedAt: at('2026-03-01') });
      expect(closed.results).toEqual([
        { playerId: 'p-alice', place: 1 },
        { playerId: 'p-bruno', place: 1 },
        { playerId: 'p-chloe', place: null },
      ]);
      expect(ideas.formats.get(formatId)?.status).toBe('proposed');
      expect([...ideas.votes].filter((vote) => vote.endsWith(formatId))).toEqual([]);
    });

    it('corrige les places d’un event clos sans toucher aux votes reçus depuis', async () => {
      const { service, format, ideas, setNow } = setup();
      const formatId = await format('Speedrun');
      const event = await service.create(admin, eventInput(formatId));
      await service.addRegistration(admin, event.id, 'p-alice');
      await service.saveResults(admin, event.id, { players: [{ playerId: 'p-alice', place: 2 }] });
      await ideas.addVote('p-bruno', formatId);
      setNow(at('2026-03-05'));

      const corrected = await service.saveResults(admin, event.id, { players: [{ playerId: 'p-alice', place: 1 }] });

      expect(corrected.results).toEqual([{ playerId: 'p-alice', place: 1 }]);
      expect(corrected.finishedAt).toEqual(at('2026-02-01'));
      expect(ideas.votes.has(`p-bruno/${formatId}`)).toBe(true);
    });

    it('donne à chaque membre la place de son équipe', async () => {
      const { service, format } = setup();
      const event = await service.create(admin, eventInput(await format('Relais', 'team')));
      for (const id of ['p-alice', 'p-bruno', 'p-chloe', 'p-david']) await service.addRegistration(admin, event.id, id);
      const [bleus, rouges] = (await service.createTeam(admin, event.id, 'Bleus').then(() => service.createTeam(admin, event.id, 'Rouges'))).teams;
      await service.assignTeam(admin, event.id, 'p-alice', bleus.id);
      await service.assignTeam(admin, event.id, 'p-bruno', bleus.id);
      await service.assignTeam(admin, event.id, 'p-chloe', rouges.id);

      const closed = await service.saveResults(admin, event.id, { teams: [{ teamId: bleus.id, place: 1 }, { teamId: rouges.id, place: 2 }] });

      expect(closed.results).toEqual([
        { playerId: 'p-alice', place: 1 },
        { playerId: 'p-bruno', place: 1 },
        { playerId: 'p-chloe', place: 2 },
        { playerId: 'p-david', place: null },
      ]);
    });

    it('refuse un non-inscrit, une place invalide, et un event annulé', async () => {
      const { service, format } = setup();
      const event = await service.create(admin, eventInput(await format('Speedrun')));
      await service.addRegistration(admin, event.id, 'p-alice');

      await expect(service.saveResults(admin, event.id, { players: [{ playerId: 'p-bruno', place: 1 }] })).rejects.toMatchObject({ code: 'invalid' });
      await expect(service.saveResults(admin, event.id, { players: [{ playerId: 'p-alice', place: 0 }] })).rejects.toMatchObject({ code: 'invalid' });
      await expect(service.saveResults(admin, event.id, { players: [{ playerId: 'p-alice', place: 1.5 }] })).rejects.toMatchObject({ code: 'invalid' });
      await expect(service.saveResults(admin, event.id, { teams: [] , players: [] })).resolves.toBeDefined();
      await expect(service.saveResults(alice, event.id, {})).rejects.toMatchObject({ code: 'forbidden' });

      const other = await service.create(admin, eventInput(await format('Autre')));
      await service.cancel(admin, other.id);
      await expect(service.saveResults(admin, other.id, {})).rejects.toMatchObject({ code: 'closed' });
    });
  });

  describe('changement du jeu et annulation', () => {
    it('remplace le format : l’ancien redevient proposé avec ses votes, le nouveau est retenu', async () => {
      const { service, format, ideas } = setup();
      const first = await format('Speedrun');
      const second = await format('Course libre');
      const event = await service.create(admin, eventInput(first));

      const changed = await service.changeFormat(admin, event.id, { kind: 'existing', formatId: second });

      expect(changed.format).toMatchObject({ id: second, status: 'selected' });
      expect(ideas.formats.get(first)?.status).toBe('proposed');
      expect(ideas.votes.has(`p-alice/${first}`)).toBe(true);
    });

    it('annule un event et libère son format, sans toucher aux votes', async () => {
      const { service, format, ideas } = setup();
      const formatId = await format('Speedrun');
      const event = await service.create(admin, eventInput(formatId));

      expect(await service.cancel(admin, event.id)).toMatchObject({ status: 'cancelled', registrationOpen: false });
      expect(ideas.formats.get(formatId)?.status).toBe('proposed');
      expect(ideas.votes.has(`p-alice/${formatId}`)).toBe(true);
      await expect(service.changeFormat(admin, event.id, { kind: 'existing', formatId })).rejects.toMatchObject({ code: 'closed' });
    });
  });

  describe('validation d’un side', () => {
    it('valide un side malgré les avertissements, et refuse de valider un main', async () => {
      const { service, format } = setup();
      const side = await service.create(admin, eventInput(await format('Speedrun'), { type: 'side', announceDate: at('2026-02-25'), registrationEnd: at('2026-02-26') }));
      const main = await service.create(admin, eventInput(await format('Autre')));

      const validated = await service.validate(admin, side.id, true);

      expect(validated).toMatchObject({ validated: true, sideWarnings: ['Annoncé moins d’une semaine avant d’être joué.'] });
      await expect(service.validate(admin, main.id, true)).rejects.toMatchObject({ code: 'invalid' });
    });
  });

  it('joue une saison de bout en bout : main, side et event par équipe, puis le classement', async () => {
    const { service, format, seasons, events, players } = setup();
    const ids = ['p-alice', 'p-bruno', 'p-chloe', 'p-david'];

    const main = await service.create(admin, eventInput(await format('Speedrun')));
    for (const id of ids) await service.addRegistration(admin, main.id, id);
    await service.saveResults(admin, main.id, { players: ids.map((playerId, index) => ({ playerId, place: index + 1 })) });

    const side = await service.create(admin, eventInput(await format('Course libre'), { type: 'side', announceDate: at('2026-01-01') }));
    for (const id of ids) await service.addRegistration(admin, side.id, id);
    await service.saveResults(admin, side.id, { players: ids.map((playerId, index) => ({ playerId, place: 4 - index })) });
    await service.validate(admin, side.id, true);

    const team = await service.create(admin, eventInput(await format('Relais', 'team')));
    for (const id of ids) await service.addRegistration(admin, team.id, id);
    await service.createTeam(admin, team.id, 'Bleus');
    const { teams } = await service.createTeam(admin, team.id, 'Rouges');
    for (const [index, id] of ids.entries()) await service.assignTeam(admin, team.id, id, teams[index < 2 ? 0 : 1].id);
    await service.saveResults(admin, team.id, { teams: [{ teamId: teams[0].id, place: 2 }, { teamId: teams[1].id, place: 1 }] });

    const all = await events.listBySeason('s-1');
    const standings = computeStandings({
      season: (await seasons.findById('s-1'))!,
      events: all.map((event) => ({ ...event, label: event.format.name })),
      results: (await Promise.all(all.map(async (event) => (await events.results(event.id)).map((result) => ({ ...result, eventId: event.id }))))).flat(),
      players: [...players.rows.values()],
    });

    // Alice : 24 + 18 (main) et 6 (side) ; Chloé : 14 + 24 et 9 ; David : 12 + 24 et 12 ; Bruno : 18 + 18 et 7.
    expect(standings.map((entry) => [entry.player.pseudo, entry.score])).toEqual([
      ['David', 48],
      ['Alice', 48],
      ['Chloé', 47],
      ['Bruno', 43],
    ]);
  });
});

describe('resultsFor', () => {
  it('refuse une place par joueur pour un event par équipe, et l’inverse', () => {
    expect(() => resultsFor(true, [], [], { players: [{ playerId: 'p', place: 1 }] })).toThrow('une place par équipe');
    expect(() => resultsFor(false, [], [], { teams: [{ teamId: 't', place: 1 }] })).toThrow('une place par joueur');
  });

  it('refuse un participant saisi deux fois', () => {
    expect(() =>
      resultsFor(false, [{ playerId: 'p', teamId: null }], [], { players: [{ playerId: 'p', place: 1 }, { playerId: 'p', place: 2 }] }),
    ).toThrow('deux fois');
  });
});

describe('sideWarnings', () => {
  const side = { type: 'side' as const, status: 'finished' as const, announceDate: at('2026-01-01'), endDate: at('2026-01-20'), liveDate: null };

  it('signale un side joué avec moins de 4 classés', () => {
    expect(sideWarnings(side, [{ playerId: 'a', place: 1 }, { playerId: 'b', place: 2 }, { playerId: 'c', place: 3 }, { playerId: 'd', place: null }])).toEqual([
      'Moins de 4 joueurs classés : ce side ne comptera pas au classement.',
    ]);
  });

  it('mesure le préavis jusqu’au live quand il y en a un', () => {
    expect(sideWarnings({ ...side, status: 'registration', liveDate: at('2026-01-05') }, [])).toEqual(['Annoncé moins d’une semaine avant d’être joué.']);
    expect(sideWarnings({ ...side, status: 'registration' }, [])).toEqual([]);
  });

  it('ne dit rien pour un main', () => {
    expect(sideWarnings({ ...side, type: 'main' }, [])).toEqual([]);
  });
});
