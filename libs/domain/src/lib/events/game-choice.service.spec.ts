import { IdeasService } from '../ideas/ideas.service';
import { FakeCatalog, InMemoryCovers, InMemoryGames, InMemoryIdeas, customGame } from '../ideas/test-helpers';
import { InMemoryPlayers, player } from '../players/test-helpers';
import { EventsService } from './events.service';
import { GameChoiceService } from './game-choice.service';
import { InMemoryEvents, InMemorySeasons, season } from './test-helpers';

const admin = { id: 'p-admin', role: 'admin' as const };
const alice = { id: 'p-alice', role: 'player' as const };
const bruno = { id: 'p-bruno', role: 'player' as const };
const chloe = { id: 'p-chloe', role: 'player' as const };

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

async function setup() {
  let now = at('2026-02-01');
  const games = new InMemoryGames([customGame('g-1', 'Trackmania')]);
  const ideas = new InMemoryIdeas(games);
  const players = new InMemoryPlayers(
    ['admin', 'alice', 'bruno', 'chloe'].map((name, index) =>
      player({ id: `p-${name}`, pseudo: name, discordId: String(index), role: name === 'admin' ? 'admin' : 'player' }),
    ),
  );
  const events = new InMemoryEvents(games, ideas, players);
  const ideasService = new IdeasService(ideas, games, new FakeCatalog(), new InMemoryCovers());
  const eventsService = new EventsService(events, new InMemorySeasons([season()]), players, ideas, ideasService, () => now);
  const service = new GameChoiceService(events, ideas, () => now);

  // Sept formats : « F1 » a 7 votes, « F7 » en a 1 (celui de son auteur).
  const formats: string[] = [];
  for (let index = 1; index <= 7; index++) {
    const { id } = await ideasService.suggest(alice, {
      game: { kind: 'existing', gameId: 'g-1' },
      priceTier: null,
      name: `F${index}`,
      description: '',
      teamMode: 'solo',
      playMode: 'async',
    });
    for (let vote = 0; vote < 7 - index; vote++) ideas.votes.add(`voter-${vote}/${id}`);
    formats.push(id);
  }

  /** Joue un main sur `formatId` : Alice et Bruno premiers ex æquo, Chloé deuxième. */
  async function playMain(formatId: string, closedAt: Date) {
    const main = await eventsService.create(admin, {
      seasonId: 's-1',
      type: 'main',
      format: { kind: 'existing', formatId },
      announceDate: at('2026-01-01'),
      registrationEnd: at('2026-01-20'),
      endDate: at('2026-01-31'),
    });
    for (const id of ['p-alice', 'p-bruno', 'p-chloe']) await eventsService.addRegistration(admin, main.id, id);
    now = closedAt;
    await eventsService.saveResults(admin, main.id, {
      players: [
        { playerId: 'p-alice', place: 1 },
        { playerId: 'p-bruno', place: 1 },
        { playerId: 'p-chloe', place: 2 },
      ],
    });
    return main;
  }

  return { service, eventsService, ideas, formats, playMain, setNow: (date: Date) => (now = date) };
}

const names = (ideas: { name: string }[]) => ideas.map((idea) => idea.name);

describe('GameChoiceService', () => {
  it('avant tout main, propose le format le plus upvoté', async () => {
    const { service } = await setup();

    const state = await service.state(alice);

    expect(state).toMatchObject({ status: 'default', lastMain: null, deadline: null, canChoose: false });
    expect(state.pick?.name).toBe('F1');
    expect(names(state.candidates)).toEqual(['F1', 'F2', 'F3', 'F4', 'F5']);
  });

  it('laisse les classés premiers choisir parmi les 5 plus upvotés pendant 3 jours', async () => {
    const { service, formats, playMain } = await setup();
    await playMain(formats[6], at('2026-02-01'));

    const state = await service.state(alice);

    expect(state).toMatchObject({ status: 'open', deadline: at('2026-02-04'), canChoose: true, pick: null });
    expect(state.choosers.map((chooser) => chooser.pseudo)).toEqual(['alice', 'bruno']);
    expect((await service.state(chloe)).canChoose).toBe(false);
  });

  it('enregistre le premier choix, qui retient le format', async () => {
    const { service, formats, ideas, playMain } = await setup();
    await playMain(formats[6], at('2026-02-01'));

    const state = await service.choose(bruno, formats[2]);

    expect(state).toMatchObject({ status: 'chosen', pick: { name: 'F3' } });
    expect(ideas.formats.get(formats[2])?.status).toBe('selected');
    await expect(service.choose(alice, formats[0])).rejects.toMatchObject({ code: 'conflict' });
  });

  it('refuse un joueur qui n’a pas gagné, et un format hors du top 5', async () => {
    const { service, formats, playMain } = await setup();
    await playMain(formats[0], at('2026-02-01'));

    await expect(service.choose(chloe, formats[1])).rejects.toMatchObject({ code: 'forbidden' });
    // Le format joué est revenu dans la liste sans ses votes : F7 et lui sont hors du top 5.
    await expect(service.choose(alice, formats[6])).rejects.toMatchObject({ code: 'invalid' });
  });

  it('passe au format le plus upvoté après 3 jours sans choix', async () => {
    const { service, formats, playMain, setNow } = await setup();
    await playMain(formats[6], at('2026-02-01'));
    setNow(at('2026-02-04'));

    const state = await service.state(alice);

    expect(state).toMatchObject({ status: 'default', pick: { name: 'F1' }, canChoose: false });
    await expect(service.choose(alice, formats[1])).rejects.toMatchObject({ code: 'closed' });
  });

  it('n’a rien à choisir tant qu’un main est prévu', async () => {
    const { service, eventsService, formats, playMain } = await setup();
    await playMain(formats[6], at('2026-02-01'));
    await service.choose(alice, formats[1]);

    await eventsService.create(admin, {
      seasonId: 's-1',
      type: 'main',
      format: { kind: 'existing', formatId: formats[1] },
      announceDate: at('2026-02-02'),
      registrationEnd: at('2026-02-20'),
      endDate: at('2026-02-28'),
    });
    const state = await service.state(alice);

    expect(state).toMatchObject({ status: 'scheduled', pick: null, nextMain: { formatId: formats[1] } });
    await expect(service.choose(alice, formats[2])).rejects.toMatchObject({ code: 'closed' });
  });

  it('écarte du top 5 les formats retenus pour un event', async () => {
    const { service, eventsService, formats } = await setup();
    await eventsService.create(admin, {
      seasonId: 's-1',
      type: 'side',
      format: { kind: 'existing', formatId: formats[0] },
      announceDate: at('2026-02-01'),
      registrationEnd: at('2026-02-10'),
      endDate: at('2026-02-20'),
    });

    expect(names((await service.state(alice)).candidates)).toEqual(['F2', 'F3', 'F4', 'F5', 'F6']);
  });
});
