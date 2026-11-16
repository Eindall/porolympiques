import { IdeasService } from '../ideas/ideas.service';
import { FakeCatalog, InMemoryCovers, InMemoryGames, InMemoryIdeas, customGame } from '../ideas/test-helpers';
import { InMemoryPlayers, player } from '../players/test-helpers';
import type { StandingsEntry } from '../standings/standings';
import { type EventInput, EventsService } from '../events/events.service';
import { InMemoryEvents, InMemorySeasons, season } from '../events/test-helpers';
import { AnnouncementsService, RESULTS_STANDINGS_TOP } from './announcements.service';
import { type EventAnnouncement, type EventAnnouncer, type ResultsAnnouncement, SILENT_MESSAGE_ID } from './event-announcer';

const admin = { id: 'p-admin', role: 'admin' as const };
const alice = { id: 'p-alice', role: 'player' as const };
const bruno = { id: 'p-bruno', role: 'player' as const };
const at = (iso: string) => new Date(`${iso}Z`);

/** Faux bot : garde les messages postés et leurs versions successives. */
class FakeAnnouncer implements EventAnnouncer {
  ready = true;
  failNext = false;
  next = 1;
  announcements = new Map<string, EventAnnouncement[]>();
  results = new Map<string, ResultsAnnouncement[]>();

  isReady() {
    return this.ready;
  }
  async postAnnouncement(announcement: EventAnnouncement) {
    this.maybeFail();
    const id = `m-${this.next++}`;
    this.announcements.set(id, [announcement]);
    return id;
  }
  async editAnnouncement(id: string, announcement: EventAnnouncement) {
    this.maybeFail();
    const versions = this.announcements.get(id);
    versions?.push(announcement);
    return Boolean(versions);
  }
  async postResults(results: ResultsAnnouncement) {
    this.maybeFail();
    const id = `m-${this.next++}`;
    this.results.set(id, [results]);
    return id;
  }
  async editResults(id: string, results: ResultsAnnouncement) {
    this.maybeFail();
    const versions = this.results.get(id);
    versions?.push(results);
    return Boolean(versions);
  }
  last(id: string) {
    const versions = this.announcements.get(id) ?? [];
    return versions[versions.length - 1];
  }
  private maybeFail() {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Discord indisponible');
    }
  }
}

const entry = (rank: number, pseudo: string): StandingsEntry => ({
  rank,
  player: { id: `p-${pseudo}`, pseudo, avatarUrl: '', active: true },
  score: 100 - rank,
  wins: 0,
  results: [],
});

function setup() {
  let now = at('2026-02-01T12:00:00');
  const clock = () => now;
  const games = new InMemoryGames([customGame('g-1', 'Trackmania')]);
  const ideas = new InMemoryIdeas(games);
  const players = new InMemoryPlayers([
    player({ id: 'p-admin', pseudo: 'Tong', role: 'admin', discordId: '9' }),
    player({ id: 'p-alice', pseudo: 'Alice', discordId: '1' }),
    player({ id: 'p-bruno', pseudo: 'Bruno', discordId: '2' }),
    player({ id: 'p-chloe', pseudo: 'Chloé', discordId: '3' }),
  ]);
  const seasons = new InMemorySeasons([season()]);
  const events = new InMemoryEvents(games, ideas, players);
  const ideasService = new IdeasService(ideas, games, new FakeCatalog(), new InMemoryCovers());
  const announcer = new FakeAnnouncer();
  const errors: string[] = [];
  const ranking = Array.from({ length: 12 }, (_, index) => entry(index + 1, `J${index + 1}`));
  const standings = { forSeason: async () => ({ season: season(), entries: ranking }) };
  const announcements = new AnnouncementsService(events, standings, announcer, (message) => errors.push(message), clock);
  const service = new EventsService(events, seasons, players, ideas, ideasService, clock, announcements);
  const format = async (name: string, teamMode: 'solo' | 'team' = 'solo') =>
    (await ideasService.suggest(alice, { game: { kind: 'existing', gameId: 'g-1' }, priceTier: null, name, description: '', teamMode, playMode: 'async' })).id;
  const create = async (overrides: Partial<EventInput> = {}, teamMode: 'solo' | 'team' = 'solo') => {
    const event = await service.create(admin, {
      seasonId: 's-1',
      type: 'main',
      format: { kind: 'existing', formatId: await format(`Format ${Math.random()}`, teamMode) },
      announceDate: at('2026-02-01T10:00:00'),
      registrationEnd: at('2026-02-10T20:00:00'),
      endDate: at('2026-02-20T20:00:00'),
      ...overrides,
    });
    await announcements.settled();
    return event;
  };
  const messageOf = async (id: string) => (await events.findById(id))?.announcementMessageId ?? null;
  return { events, service, announcements, announcer, errors, create, messageOf, setNow: (date: Date) => (now = date) };
}

describe('AnnouncementsService', () => {
  describe('annonce', () => {
    it('poste l’annonce dès la création si sa date est passée, puis la met à jour à chaque inscription', async () => {
      const { service, announcements, announcer, create, messageOf } = setup();
      const event = await create();

      const messageId = (await messageOf(event.id)) as string;
      expect(messageId).toBe('m-1');
      expect(announcer.last(messageId)).toMatchObject({ registrationOpen: true, event: { registrationCount: 0 } });

      await service.register(alice, event.id);
      await service.register(bruno, event.id);
      await announcements.settled();
      expect(announcer.announcements.size).toBe(1);
      expect(announcer.last(messageId).event.registrationCount).toBe(2);
    });

    it('attend la date d’annonce pour poster, au passage régulier', async () => {
      const { announcements, announcer, create, messageOf, setNow } = setup();
      const event = await create({ announceDate: at('2026-02-03T18:00:00') });
      await announcements.tick();
      expect(await messageOf(event.id)).toBeNull();

      setNow(at('2026-02-03T18:00:30'));
      await announcements.tick();
      await announcements.tick();
      expect(await messageOf(event.id)).toBe('m-1');
      expect(announcer.announcements.size).toBe(1);
    });

    it('désactive l’inscription quand la date limite passe, sans toucher aux autres messages', async () => {
      const { announcements, announcer, create, messageOf, setNow } = setup();
      const event = await create();
      const other = await create({ registrationEnd: at('2026-02-15T20:00:00') });
      await announcements.tick();
      const versions = (id: string | null) => announcer.announcements.get(id as string)?.length;
      const before = versions(await messageOf(other.id));

      setNow(at('2026-02-10T20:01:00'));
      await announcements.tick();
      const messageId = (await messageOf(event.id)) as string;
      expect(announcer.last(messageId).registrationOpen).toBe(false);
      expect(versions(await messageOf(other.id))).toBe(before);
    });

    it('suit l’annulation, et n’annonce jamais un event annulé avant sa date d’annonce', async () => {
      const { service, announcements, announcer, create, messageOf, setNow } = setup();
      const shown = await create();
      const secret = await create({ announceDate: at('2026-02-05T10:00:00') });

      await service.cancel(admin, shown.id);
      await service.cancel(admin, secret.id);
      await announcements.settled();
      expect(announcer.last((await messageOf(shown.id)) as string)).toMatchObject({ registrationOpen: false, event: { status: 'cancelled' } });

      setNow(at('2026-02-06T10:00:00'));
      await announcements.tick();
      expect(await messageOf(secret.id)).toBeNull();
      expect(announcer.announcements.size).toBe(1);
    });

    it('reposte une annonce supprimée à la main, tant que l’event est ouvert', async () => {
      const { service, announcements, announcer, create, messageOf } = setup();
      const event = await create();
      announcer.announcements.clear();

      await service.register(alice, event.id);
      await announcements.settled();
      expect(await messageOf(event.id)).toBe('m-2');
    });

    it('ne poste rien tant que le bot n’est pas prêt, puis rattrape au passage suivant', async () => {
      const { announcements, announcer, create, messageOf } = setup();
      announcer.ready = false;
      const event = await create();
      await announcements.tick();
      expect(await messageOf(event.id)).toBeNull();

      announcer.ready = true;
      await announcements.tick();
      expect(await messageOf(event.id)).toBe('m-1');
    });

    it('signale une erreur de Discord sans bloquer le site, et rattrape ensuite', async () => {
      const { announcements, announcer, errors, create, messageOf } = setup();
      announcer.failNext = true;
      const event = await create();

      expect(event.id).toBeDefined();
      expect(errors).toEqual([expect.stringContaining('Discord indisponible')]);
      expect(await messageOf(event.id)).toBeNull();
      await announcements.tick();
      expect(await messageOf(event.id)).toBe('m-1');
      expect(announcer.announcements.size).toBe(1);
    });

    it('laisse sans message un event créé avant le bot', async () => {
      const { service, events, announcements, announcer, create } = setup();
      announcer.ready = false;
      const event = await create();
      await events.update(event.id, { announcementMessageId: SILENT_MESSAGE_ID, resultsMessageId: SILENT_MESSAGE_ID });
      announcer.ready = true;

      await announcements.tick();
      await service.register(alice, event.id);
      await service.saveResults(admin, event.id, { players: [{ playerId: 'p-alice', place: 1 }] });
      await announcements.settled();
      expect(announcer.announcements.size + announcer.results.size).toBe(0);
    });
  });

  describe('résultats', () => {
    it('poste les places et le haut du classement à la clôture, puis modifie le message à chaque correction', async () => {
      const { service, announcements, announcer, events, create, messageOf } = setup();
      const event = await create();
      for (const player of [alice, bruno, { id: 'p-chloe', role: 'player' as const }]) await service.register(player, event.id);

      await service.saveResults(admin, event.id, {
        players: [
          { playerId: 'p-bruno', place: 1 },
          { playerId: 'p-alice', place: 2 },
        ],
      });
      await announcements.settled();

      const resultsId = (await events.findById(event.id))?.resultsMessageId as string;
      const [posted] = announcer.results.get(resultsId) ?? [];
      expect(posted.lines.map((line) => [line.place, line.label])).toEqual([
        [1, 'Bruno'],
        [2, 'Alice'],
      ]);
      expect(posted.unranked).toBe(1);
      expect(posted.standings).toHaveLength(RESULTS_STANDINGS_TOP);
      expect(announcer.last((await messageOf(event.id)) as string)).toMatchObject({ registrationOpen: false, event: { status: 'finished' } });

      await service.saveResults(admin, event.id, { players: [{ playerId: 'p-alice', place: 1 }, { playerId: 'p-bruno', place: 1 }] });
      await announcements.settled();
      expect(announcer.results.size).toBe(1);
      const versions = announcer.results.get(resultsId) ?? [];
      expect(versions[versions.length - 1].lines.map((line) => [line.place, line.label])).toEqual([
        [1, 'Alice'],
        [1, 'Bruno'],
      ]);
    });

    it('donne une ligne par équipe, avec ses membres', async () => {
      const { service, announcements, announcer, events, create } = setup();
      const event = await create({}, 'team');
      for (const player of [alice, bruno, { id: 'p-chloe', role: 'player' as const }]) await service.register(player, event.id);
      const withTeams = await service.createTeam(admin, event.id, 'Les Rouges');
      const reds = withTeams.teams[0].id;
      const blues = (await service.createTeam(admin, event.id, 'Les Bleus')).teams.find((team) => team.id !== reds)?.id as string;
      await service.assignTeam(admin, event.id, 'p-alice', reds);
      await service.assignTeam(admin, event.id, 'p-bruno', reds);
      await service.assignTeam(admin, event.id, 'p-chloe', blues);

      await service.saveResults(admin, event.id, { teams: [{ teamId: reds, place: 1 }] });
      await announcements.settled();

      const [posted] = announcer.results.get((await events.findById(event.id))?.resultsMessageId as string) ?? [];
      expect(posted.lines).toEqual([{ place: 1, label: 'Les Rouges', members: ['Alice', 'Bruno'] }]);
      expect(posted.unranked).toBe(1);
    });
  });
});
