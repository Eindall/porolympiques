/**
 * Tests d'intégration de l'application complète, sur une vraie base (TEST_DATABASE_URL), avec Discord simulé :
 * l'échange OAuth et l'annuaire du serveur (le bot) sont remplacés par des faux.
 * Ignorés sans TEST_DATABASE_URL. ATTENTION : ils vident les tables de cette base.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DiscordStrategy } from '@porolympiques/api';
import { seedFictionalSeason } from '@porolympiques/database';
import {
  AnnouncementsService,
  type CatalogGame,
  EVENT_ANNOUNCER,
  type EventAnnouncement,
  type EventAnnouncer,
  type ResultsAnnouncement,
  FICTIONAL_SEASON,
  GAME_CATALOG,
  type GameCatalog,
  GUILD_DIRECTORY,
  type GuildDirectory,
  type GuildMember,
  PlayersService,
} from '@porolympiques/domain';
import type {
  EventDto,
  GameDto,
  GameSearchDto,
  HallOfFameDto,
  HomeDto,
  IdeaDto,
  MeDto,
  NextGameDto,
  PlayerRecordDto,
  RoadmapDto,
  SeasonDto,
  SuggestionDto,
  SeasonStandingsDto,
} from '@porolympiques/shared';
import { DataSource } from 'typeorm';
import { assertTestDatabase } from './testing/assert-test-database';

const APP_URL = 'http://localhost:4200';
const ADMIN_ID = '100000000000000009';
const ALICE_ID = '100000000000000001';
const BRUNO_ID = '100000000000000002';
const CHLOE_ID = '100000000000000003';
const DAVID_ID = '100000000000000004';

const describeWithDb = process.env['TEST_DATABASE_URL'] ? describe : describe.skip;

/** Annuaire du serveur simulé : les membres présents, modifiables d'un test à l'autre. */
class FakeGuildDirectory implements GuildDirectory {
  members = new Map<string, GuildMember>();
  unavailable = false;

  isConnected() {
    return !this.unavailable;
  }

  async findMember(discordId: string): Promise<GuildMember | null> {
    if (this.unavailable) throw new Error('bot pas encore connecté');
    return this.members.get(discordId) ?? null;
  }
}

/** Catalogue de jeux simulé : pas d'appel à IGDB. */
class FakeGameCatalog implements GameCatalog {
  down = false;
  searches = 0;
  games: CatalogGame[] = [
    { externalId: '1942', name: 'The Witcher 3: Wild Hunt', coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg', year: 2015 },
    { externalId: '7346', name: 'The Legend of Zelda: Breath of the Wild', coverUrl: null, year: 2017 },
  ];

  async search(query: string): Promise<CatalogGame[]> {
    this.searches++;
    if (this.down) throw new Error('IGDB injoignable');
    return this.games.filter((game) => game.name.toLowerCase().includes(query));
  }

  async findById(externalId: string): Promise<CatalogGame | null> {
    if (this.down) throw new Error('IGDB injoignable');
    return this.games.find((game) => game.externalId === externalId) ?? null;
  }
}

/** Bot simulé pour les messages d'event : garde chaque version des messages postés. Éteint par défaut. */
class FakeAnnouncer implements EventAnnouncer {
  ready = false;
  next = 1;
  announcements = new Map<string, EventAnnouncement[]>();
  results = new Map<string, ResultsAnnouncement[]>();

  isReady() {
    return this.ready;
  }
  async postAnnouncement(announcement: EventAnnouncement) {
    const id = `m-${this.next++}`;
    this.announcements.set(id, [announcement]);
    return id;
  }
  async editAnnouncement(id: string, announcement: EventAnnouncement) {
    this.announcements.get(id)?.push(announcement);
    return this.announcements.has(id);
  }
  async postResults(results: ResultsAnnouncement) {
    const id = `m-${this.next++}`;
    this.results.set(id, [results]);
    return id;
  }
  async editResults(id: string, results: ResultsAnnouncement) {
    this.results.get(id)?.push(results);
    return this.results.has(id);
  }
}

function guildMember(discordId: string, overrides: Partial<GuildMember> = {}): GuildMember {
  return {
    discordId,
    username: `user${discordId.slice(-2)}`,
    globalName: null,
    nickname: null,
    avatarUrl: `https://cdn.discordapp.com/embed/avatars/${Number(discordId.slice(-1)) % 6}.png`,
    isBot: false,
    ...overrides,
  };
}

describeWithDb('Application (intégration)', () => {
  let app: NestExpressApplication;
  let base: string;
  let dataSource: DataSource;
  const directory = new FakeGuildDirectory();
  const catalog = new FakeGameCatalog();
  const announcer = new FakeAnnouncer();
  /** Identifiant Discord renvoyé par le faux échange OAuth. */
  let oauthDiscordId = ALICE_ID;

  beforeAll(async () => {
    // Importés ici : `ConfigModule.forRoot()` valide l'environnement dès l'import d'AppModule,
    // ce qui ferait échouer le fichier même quand la suite est ignorée.
    const { AppModule } = await import('./app.module');
    const { configureApp } = await import('./configure-app');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GUILD_DIRECTORY)
      .useValue(directory)
      .overrideProvider(GAME_CATALOG)
      .useValue(catalog)
      .overrideProvider(EVENT_ANNOUNCER)
      .useValue(announcer)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');

    // Faux échange OAuth : pas d'appel réseau vers Discord.
    const strategy = app.get(DiscordStrategy);
    const oauth2 = (strategy as unknown as { _oauth2: { getOAuthAccessToken: unknown } })._oauth2;
    oauth2.getOAuthAccessToken = (code: string, _params: unknown, cb: (err: unknown, token?: string) => void) =>
      code === 'refus' ? cb({ statusCode: 400, data: 'invalid_grant' }) : cb(null, `token-${code}`);
    strategy.userProfile = (_token, done) => done(null, { id: oauthDiscordId });

    dataSource = app.get(DataSource);
    assertTestDatabase(dataSource);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE players, seasons, games, catalog_search_cache CASCADE');
    directory.members = new Map([
      [ALICE_ID, guildMember(ALICE_ID, { globalName: 'Alice', nickname: 'Ali la Menace' })],
      [ADMIN_ID, guildMember(ADMIN_ID, { globalName: 'Tong' })],
      [BRUNO_ID, guildMember(BRUNO_ID, { globalName: 'Bruno' })],
      [CHLOE_ID, guildMember(CHLOE_ID, { globalName: 'Chloé' })],
      [DAVID_ID, guildMember(DAVID_ID, { globalName: 'David' })],
    ]);
    directory.unavailable = false;
    catalog.down = false;
    oauthDiscordId = ALICE_ID;
  });

  const cookieFrom = (res: Response, name: string) =>
    res.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`))?.split(';')[0];

  /** Parcours OAuth complet ; renvoie la redirection finale et le cookie de session éventuel. */
  async function login(code = 'abc'): Promise<{ location: string | null; session?: string; setCookie?: string }> {
    const start = await fetch(`${base}/api/auth/discord`, { redirect: 'manual' });
    const state = new URL(start.headers.get('location') as string).searchParams.get('state');
    const res = await fetch(`${base}/api/auth/discord/callback?code=${code}&state=${state}`, {
      redirect: 'manual',
      headers: { cookie: cookieFrom(start, 'poro_oauth_state') as string },
    });
    return {
      location: res.headers.get('location'),
      session: cookieFrom(res, 'poro_session'),
      setCookie: res.headers.getSetCookie().find((cookie) => cookie.startsWith('poro_session=')),
    };
  }

  const me = (session?: string) => fetch(`${base}/api/me`, { headers: session ? { cookie: session } : {} });

  it('GET /api/health répond ok sans session', async () => {
    const response = await fetch(`${base}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', discord: 'up' });

    directory.unavailable = true;
    const down = await fetch(`${base}/api/health`);
    expect(down.status).toBe(200);
    expect(await down.json()).toEqual({ status: 'ok', discord: 'down' });
  });

  it('refuse les routes protégées sans session', async () => {
    expect((await me()).status).toBe(401);
    // Une route qui n'existe pas répond 404 (les gardes ne s'appliquent qu'aux routes existantes) : rien n'y fuit.
    expect((await fetch(`${base}/api/inconnue`)).status).toBe(404);
  });

  it('redirige vers Discord avec le scope identify et un state gardé en cookie signé', async () => {
    const res = await fetch(`${base}/api/auth/discord`, { redirect: 'manual' });
    const location = new URL(res.headers.get('location') as string);

    expect(res.status).toBe(302);
    expect(location.origin + location.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(location.searchParams.get('scope')).toBe('identify');
    const cookie = cookieFrom(res, 'poro_oauth_state') as string;
    const payload = JSON.parse(Buffer.from(cookie.split('.')[1], 'base64url').toString());
    expect(payload).toMatchObject({ state: location.searchParams.get('state'), purpose: 'oauth-state' });
  });

  it('renvoie vers /login si le state est absent ou faux, ou si Discord refuse', async () => {
    const start = await fetch(`${base}/api/auth/discord`, { redirect: 'manual' });
    const state = new URL(start.headers.get('location') as string).searchParams.get('state');
    const cookie = cookieFrom(start, 'poro_oauth_state') as string;
    const callback = (query: string, withCookie = true) =>
      fetch(`${base}/api/auth/discord/callback?${query}`, { redirect: 'manual', headers: withCookie ? { cookie } : {} });

    expect((await callback(`code=abc&state=${state}`, false)).headers.get('location')).toBe(`${APP_URL}/login?error=state`);
    expect((await callback('code=abc&state=faux')).headers.get('location')).toBe(`${APP_URL}/login?error=state`);
    expect((await callback(`error=access_denied&state=${state}`)).headers.get('location')).toBe(`${APP_URL}/login?error=discord`);
    expect((await login('refus')).location).toBe(`${APP_URL}/login?error=discord`);
  });

  it('connecte un membre du serveur avec son surnom, et lui ouvre /api/me', async () => {
    const { location, session, setCookie } = await login();

    expect(location).toBe(`${APP_URL}/`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    const response = await me(session);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: expect.any(String),
      pseudo: 'Ali la Menace',
      avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
      role: 'player',
    });
  });

  it("donne le rôle admin à l'identifiant de la configuration", async () => {
    oauthDiscordId = ADMIN_ID;
    const { session } = await login();

    expect(await (await me(session)).json()).toMatchObject({ pseudo: 'Tong', role: 'admin' });
  });

  it("refuse un compte qui n'est pas sur le serveur", async () => {
    oauthDiscordId = '100000000000000005';
    const { location, session } = await login();

    expect(location).toBe(`${APP_URL}/login?error=not_member`);
    expect(session).toBeUndefined();
    expect(await dataSource.query('SELECT 1 FROM players WHERE discord_id = $1', [oauthDiscordId])).toHaveLength(0);
  });

  it('refuse la connexion si le bot ne peut pas vérifier la présence', async () => {
    directory.unavailable = true;

    expect((await login()).location).toBe(`${APP_URL}/login?error=discord`);
  });

  it('coupe la session d’un membre qui quitte le serveur dès la requête suivante', async () => {
    const { session } = await login();
    expect((await me(session)).status).toBe(200);

    directory.members.delete(ALICE_ID);
    await app.get(PlayersService).memberLeft(ALICE_ID);

    expect((await me(session)).status).toBe(401);
    const [row] = await dataSource.query('SELECT active FROM players WHERE discord_id = $1', [ALICE_ID]);
    expect(row.active).toBe(false);
    // Et il ne peut plus se reconnecter tant qu'il n'est pas revenu.
    expect((await login()).location).toBe(`${APP_URL}/login?error=not_member`);
  });

  it('refuse aussi un joueur désactivé dont la session n’a pas été révoquée', async () => {
    const { session } = await login();
    await dataSource.query('UPDATE players SET active = false WHERE discord_id = $1', [ALICE_ID]);

    expect((await me(session)).status).toBe(401);
    const [row] = await dataSource.query('SELECT revoked_at FROM auth_sessions');
    expect(row.revoked_at).not.toBeNull();
  });

  it('réactive un ancien membre revenu sur le serveur', async () => {
    await login();
    await app.get(PlayersService).memberLeft(ALICE_ID);

    const { location, session } = await login();

    expect(location).toBe(`${APP_URL}/`);
    expect((await me(session)).status).toBe(200);
  });

  it('révoque réellement la session à la déconnexion', async () => {
    const { session } = await login();

    const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie: session as string } });

    expect(logout.status).toBe(204);
    expect(logout.headers.getSetCookie().some((cookie) => cookie.startsWith('poro_session=;'))).toBe(true);
    expect((await me(session)).status).toBe(401);
  });

  describe('Classement', () => {
    const standings = (path: string, session?: string) =>
      fetch(`${base}/api/seasons/${path}/standings`, { headers: session ? { cookie: session } : {} });

    it('est derrière le mur de connexion', async () => {
      await seedFictionalSeason(dataSource);

      expect((await standings('current')).status).toBe(401);
    });

    it('renvoie le classement attendu pour la saison fictive en cours', async () => {
      const { seasonId, playerIds } = await seedFictionalSeason(dataSource);
      const { session } = await login();

      const response = await standings('current', session);

      expect(response.status).toBe(200);
      const body = (await response.json()) as SeasonStandingsDto;
      expect(body.season).toMatchObject({ id: seasonId, name: FICTIONAL_SEASON.name, status: 'active', mainQuota: 3, sideQuota: 2 });
      expect(body.entries.map(({ rank, player, score, wins }) => ({ rank, player: player.id, score, wins }))).toEqual(
        FICTIONAL_SEASON.expected.map((entry) => ({ ...entry, player: playerIds[entry.player] })),
      );
      // Détail d'une ligne : résultats comptés, écartés et non classés, du plus ancien au plus récent.
      const alice = body.entries[0];
      expect(alice.player).toMatchObject({ pseudo: 'Alice', active: true });
      expect(alice.results.map(({ label, type, place, points, status }) => [label, type, place, points, status])).toEqual([
        ['Trackmania — Contre-la-montre', 'main', 1, 24, 'counted'],
        ['Wikipédia — Speedrun de liens', 'side', 2, 9, 'counted'],
        ['Tetris 99 — Meilleur score', 'main', 2, 18, 'counted'],
        ['Overcooked 2 — Relais en cuisine', 'main', 3, 14, 'counted'],
        ['Celeste — Speedrun any%', 'main', 3, 14, 'discarded'],
      ]);
      expect(body.entries.find((entry) => entry.player.pseudo === 'Inès')?.results).toEqual([
        expect.objectContaining({ place: null, points: 0, status: 'unranked' }),
      ]);
    });

    it('renvoie le classement d’une saison par son identifiant, et le recalcule à chaque appel', async () => {
      const { seasonId, playerIds } = await seedFictionalSeason(dataSource);
      const { session } = await login();
      // Changer une place change le classement, sans rien d'autre à mettre à jour.
      await dataSource.query('UPDATE results SET place = 1 WHERE player_id = $1 AND place = 2', [playerIds['bruno']]);

      const body = (await (await standings(seasonId, session)).json()) as SeasonStandingsDto;

      expect(body.entries[0]).toMatchObject({ rank: 1, player: { pseudo: 'Bruno' } });
    });

    it('répond 404 sans saison en cours ou pour une saison inconnue, et 400 pour un identifiant mal formé', async () => {
      const { session } = await login();

      expect((await standings('current', session)).status).toBe(404);
      expect((await standings('00000000-0000-4000-8000-000000000000', session)).status).toBe(404);
      expect((await standings('pas-un-uuid', session)).status).toBe(400);
    });
  });

  describe('Boîte à idées', () => {
    const api = (path: string, session: string, init: RequestInit = {}) =>
      fetch(`${base}/api/${path}`, {
        ...init,
        headers: { cookie: session, ...(init.body ? { 'content-type': 'application/json' } : {}) },
      });
    const suggest = (session: string, body: object) => api('ideas', session, { method: 'POST', body: JSON.stringify(body) });
    const witcherIdea = {
      game: { kind: 'catalog', externalId: '1942' },
      priceTier: '10to30',
      name: 'Speedrun any%',
      description: 'Le plus vite possible.',
      teamMode: 'solo',
      playMode: 'async',
    };

    async function players() {
      const alice = (await login()).session as string;
      oauthDiscordId = ADMIN_ID;
      const admin = (await login()).session as string;
      oauthDiscordId = BRUNO_ID;
      const bruno = (await login()).session as string;
      oauthDiscordId = ALICE_ID;
      return { alice, admin, bruno };
    }

    it('est derrière le mur de connexion', async () => {
      expect((await fetch(`${base}/api/ideas`)).status).toBe(401);
      expect((await fetch(`${base}/api/catalog/games?q=witcher`)).status).toBe(401);
    });

    it('propose les jeux du catalogue puis, une fois suggérés, depuis la base', async () => {
      const { alice } = await players();

      const first = (await (await api('catalog/games?q=Witcher', alice)).json()) as GameSearchDto;
      expect(first).toEqual({
        catalogAvailable: true,
        results: [expect.objectContaining({ gameId: null, source: 'igdb', externalId: '1942', name: 'The Witcher 3: Wild Hunt' })],
      });

      await suggest(alice, witcherIdea);
      const second = (await (await api('catalog/games?q=wit', alice)).json()) as GameSearchDto;
      expect(second.results).toEqual([
        expect.objectContaining({ gameId: expect.any(String), externalId: '1942', priceTier: '10to30' }),
      ]);
    });

    it('garde la recherche en cache et signale un catalogue injoignable', async () => {
      const { alice } = await players();
      const before = catalog.searches;

      await api('catalog/games?q=zelda', alice);
      await api('catalog/games?q=Zelda', alice);
      expect(catalog.searches - before).toBe(1);

      catalog.down = true;
      const down = (await (await api('catalog/games?q=mario', alice)).json()) as GameSearchDto;
      expect(down).toEqual({ results: [], catalogAvailable: false });
    });

    it('un joueur propose un format par autocomplete, un autre l’upvote', async () => {
      const { alice, admin } = await players();

      const created = await suggest(alice, witcherIdea);
      expect(created.status).toBe(201);
      const idea = (await created.json()) as IdeaDto;
      expect(idea).toMatchObject({
        name: 'Speedrun any%',
        votes: 1,
        votedByMe: true,
        playedCount: 0,
        status: 'proposed',
        suggestedBy: { pseudo: 'Ali la Menace' },
        game: { source: 'igdb', name: 'The Witcher 3: Wild Hunt', priceTier: '10to30' },
      });

      const voted = (await (await api(`ideas/${idea.id}/vote`, admin, { method: 'PUT' })).json()) as IdeaDto;
      expect([voted.votes, voted.votedByMe]).toEqual([2, true]);

      const list = (await (await api('ideas', alice)).json()) as IdeaDto[];
      expect(list.map((item) => [item.name, item.votes, item.votedByMe])).toEqual([['Speedrun any%', 2, true]]);

      const unvoted = (await (await api(`ideas/${idea.id}/vote`, admin, { method: 'DELETE' })).json()) as IdeaDto;
      expect(unvoted.votes).toBe(1);
    });

    it('accepte une idée hors catalogue', async () => {
      const { alice } = await players();

      const response = await suggest(alice, { ...witcherIdea, game: { kind: 'custom', name: 'Speedrun Wikipédia' }, priceTier: 'free' });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ game: { source: 'custom', name: 'Speedrun Wikipédia', priceTier: 'free' } });
    });

    it('montre les formats déjà proposés pour un jeu, et refuse un doublon', async () => {
      const { alice, admin } = await players();
      const idea = (await (await suggest(alice, witcherIdea)).json()) as IdeaDto;

      const forGame = (await (await api(`ideas?gameId=${idea.game.id}`, admin)).json()) as IdeaDto[];
      expect(forGame.map((item) => item.name)).toEqual(['Speedrun any%']);

      const duplicate = await suggest(admin, { ...witcherIdea, game: { kind: 'existing', gameId: idea.game.id }, name: 'speedrun ANY%' });
      expect(duplicate.status).toBe(409);
      expect(await duplicate.json()).toMatchObject({ code: 'duplicate', message: expect.stringContaining('existe déjà') });
    });

    it('demande la tranche de prix d’un nouveau jeu, et valide la saisie', async () => {
      const { alice } = await players();

      const noTier = await suggest(alice, { ...witcherIdea, priceTier: null });
      expect(noTier.status).toBe(400);
      expect(await noTier.json()).toMatchObject({ code: 'price_tier_required' });

      expect((await suggest(alice, { ...witcherIdea, teamMode: 'duo' })).status).toBe(400);
      expect((await suggest(alice, { ...witcherIdea, game: { kind: 'catalog' } })).status).toBe(400);
      expect((await suggest(alice, { ...witcherIdea, hack: true })).status).toBe(400);
    });

    it('filtre la liste par tranche de prix et par mode', async () => {
      const { alice } = await players();
      await suggest(alice, witcherIdea);
      await suggest(alice, { ...witcherIdea, game: { kind: 'custom', name: 'Archipelago' }, priceTier: 'free', teamMode: 'team', playMode: 'live' });

      const names = async (query: string) => ((await (await api(`ideas?${query}`, alice)).json()) as IdeaDto[]).map((idea) => idea.game.name);
      expect(await names('priceTier=free')).toEqual(['Archipelago']);
      expect(await names('teamMode=solo')).toEqual(['The Witcher 3: Wild Hunt']);
      expect(await names('playMode=live&teamMode=team')).toEqual(['Archipelago']);
      expect((await api('ideas?priceTier=cher', alice)).status).toBe(400);
    });

    it('gèle les votes d’un format retenu', async () => {
      const { alice, admin } = await players();
      const idea = (await (await suggest(alice, witcherIdea)).json()) as IdeaDto;
      await dataSource.query(`UPDATE formats SET status = 'selected' WHERE id = $1`, [idea.id]);

      const response = await api(`ideas/${idea.id}/vote`, admin, { method: 'PUT' });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'votes_frozen' });
    });

    it('laisse l’auteur modifier son idée tant qu’elle n’est pas retenue, l’admin toujours', async () => {
      const { alice, admin, bruno } = await players();
      const idea = (await (await suggest(alice, witcherIdea)).json()) as IdeaDto;
      const patch = (session: string, body: object) =>
        api(`ideas/${idea.id}`, session, { method: 'PATCH', body: JSON.stringify(body) });

      expect(idea.canEdit).toBe(true);
      const updated = await patch(alice, { name: 'Speedrun 100%', description: 'Tout ramasser.', playMode: 'live' });
      expect(await updated.json()).toMatchObject({ name: 'Speedrun 100%', description: 'Tout ramasser.', playMode: 'live', votes: 1 });

      expect((await patch(bruno, { name: 'Autre' })).status).toBe(403);
      expect((await patch(alice, { priceTier: 'gt30' })).status).toBe(403);
      const brunoView = (await (await api('ideas', bruno)).json()) as IdeaDto[];
      expect(brunoView[0].canEdit).toBe(false);

      await dataSource.query(`UPDATE formats SET status = 'selected' WHERE id = $1`, [idea.id]);
      const frozen = await patch(alice, { name: 'Encore' });
      expect(frozen.status).toBe(403);
      expect(await frozen.json()).toMatchObject({ code: 'forbidden', message: expect.stringContaining('retenu') });
      expect(await (await patch(admin, { priceTier: 'gt30' })).json()).toMatchObject({ game: { priceTier: 'gt30' } });
    });

    it('réserve la suppression à l’admin', async () => {
      const { alice, admin } = await players();
      const idea = (await (await suggest(alice, witcherIdea)).json()) as IdeaDto;

      expect((await api(`ideas/${idea.id}`, alice, { method: 'DELETE' })).status).toBe(403);
      expect((await api(`ideas/${idea.id}`, admin, { method: 'DELETE' })).status).toBe(204);
      expect(await (await api('ideas', alice)).json()).toEqual([]);
    });

    it('refuse de supprimer un format joué, et compte les events terminés', async () => {
      await seedFictionalSeason(dataSource);
      const { alice, admin } = await players();
      const ideas = (await (await api('ideas', alice)).json()) as IdeaDto[];
      const trackmania = ideas.find((idea) => idea.game.name === 'Trackmania') as IdeaDto;
      const mario = ideas.find((idea) => idea.game.name === 'Mario Kart 8') as IdeaDto;

      expect([trackmania.playedCount, mario.playedCount]).toEqual([1, 0]);
      const response = await api(`ideas/${trackmania.id}`, admin, { method: 'DELETE' });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'in_use' });
    });
  });

  describe('Images des jeux saisis librement', () => {
    /** Un vrai PNG de 1 × 1 pixel. */
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

    async function setup() {
      const alice = (await login()).session as string;
      oauthDiscordId = BRUNO_ID;
      const bruno = (await login()).session as string;
      oauthDiscordId = ALICE_ID;
      const created = await fetch(`${base}/api/ideas`, {
        method: 'POST',
        headers: { cookie: alice, 'content-type': 'application/json' },
        body: JSON.stringify({
          game: { kind: 'custom', name: 'Archipelago' },
          priceTier: 'free',
          name: 'Multiworld',
          teamMode: 'team',
          playMode: 'async',
        }),
      });
      const idea = (await created.json()) as IdeaDto;
      return { alice, bruno, idea, gameId: idea.game.id };
    }

    const upload = (gameId: string, session: string, bytes: Uint8Array, name = 'jaquette.png', type = 'image/png') => {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(bytes)], { type }), name);
      return fetch(`${base}/api/games/${gameId}/cover`, { method: 'PUT', headers: { cookie: session }, body: form });
    };
    const cover = (url: string, session?: string) => fetch(`${base}${url}`, { headers: session ? { cookie: session } : {} });

    it('enregistre l’image du créateur du jeu et la sert avec son type, derrière le mur', async () => {
      const { alice, idea, gameId } = await setup();
      expect(idea.game).toMatchObject({ coverUrl: null, canEdit: true });

      const response = await upload(gameId, alice, PNG);

      expect(response.status).toBe(200);
      const game = (await response.json()) as GameDto;
      expect(game.coverUrl).toMatch(new RegExp(`^/api/games/${gameId}/cover\\?v=[0-9a-f]{8}$`));
      const image = await cover(game.coverUrl as string, alice);
      expect(image.status).toBe(200);
      expect(image.headers.get('content-type')).toBe('image/png');
      expect(image.headers.get('x-content-type-options')).toBe('nosniff');
      expect(Buffer.from(await image.arrayBuffer())).toEqual(PNG);
      expect((await cover(game.coverUrl as string)).status).toBe(401);

      const list = (await (await fetch(`${base}/api/ideas`, { headers: { cookie: alice } })).json()) as IdeaDto[];
      expect(list[0].game.coverUrl).toBe(game.coverUrl);
    });

    it('refuse un fichier qui n’est pas une vraie image, même nommé et typé en PNG', async () => {
      const { alice, gameId } = await setup();

      const response = await upload(gameId, alice, Buffer.from('<svg onload="alert(1)"/>'));

      expect(response.status).toBe(415);
      expect(await response.json()).toMatchObject({ code: 'unsupported_file' });
    });

    it('refuse une image de plus de 2 Mo', async () => {
      const { alice, gameId } = await setup();
      const big = Buffer.alloc(2 * 1024 * 1024 + 1);
      PNG.copy(big);

      const response = await upload(gameId, alice, big);

      expect(response.status).toBe(413);
      expect(await response.json()).toMatchObject({ code: 'file_too_large', message: 'Image trop lourde : 2 Mo au maximum.' });
    });

    it('réserve l’image au créateur du jeu (et à l’admin)', async () => {
      const { bruno, gameId } = await setup();

      expect((await upload(gameId, bruno, PNG)).status).toBe(403);
      const view = (await (await fetch(`${base}/api/ideas`, { headers: { cookie: bruno } })).json()) as IdeaDto[];
      expect(view[0].game.canEdit).toBe(false);
    });

    it('retire l’image', async () => {
      const { alice, gameId } = await setup();
      const { coverUrl } = (await (await upload(gameId, alice, PNG)).json()) as GameDto;

      const removed = await fetch(`${base}/api/games/${gameId}/cover`, { method: 'DELETE', headers: { cookie: alice } });

      expect(await removed.json()).toMatchObject({ coverUrl: null });
      expect((await cover(coverUrl as string, alice)).status).toBe(404);
    });

    it('demande un fichier', async () => {
      const { alice, gameId } = await setup();

      const response = await fetch(`${base}/api/games/${gameId}/cover`, { method: 'PUT', headers: { cookie: alice }, body: new FormData() });

      expect(response.status).toBe(400);
    });
  });

  describe('Pages joueur', () => {
    const get = (path: string, session?: string) => fetch(`${base}/api/${path}`, { headers: session ? { cookie: session } : {} });

    it('sont derrière le mur de connexion', async () => {
      await seedFictionalSeason(dataSource);
      for (const path of ['home', 'hall-of-fame', `players/${crypto.randomUUID()}`]) expect((await get(path)).status).toBe(401);
    });

    it('montre l’event en cours et le top 5 de la saison sur l’accueil', async () => {
      await seedFictionalSeason(dataSource);
      const { session } = await login();

      const home = (await (await get('home', session)).json()) as HomeDto;

      expect(home.season?.name).toBe(FICTIONAL_SEASON.name);
      expect(home.ongoing.map((event) => `${event.game.name} — ${event.format.name}`)).toEqual(['Mario Kart 8 — Grand Prix 150cc']);
      expect(home.next).toBeNull();
      expect(home.top.map((entry) => [entry.rank, entry.player.pseudo])).toEqual([
        [1, 'Alice'],
        [2, 'Bruno'],
        [3, 'Chloé'],
        [4, 'David'],
        [5, 'Emma'],
        [5, 'Farid'],
      ]);
    });

    it('rassemble les résultats et les médailles d’un joueur', async () => {
      const { seasonId, playerIds } = await seedFictionalSeason(dataSource);
      const { session } = await login();

      const record = (await (await get(`players/${playerIds['alice']}`, session)).json()) as PlayerRecordDto;

      expect(record.player.pseudo).toBe('Alice');
      expect(record.seasons).toHaveLength(1);
      expect(record.seasons[0]).toMatchObject({ season: { id: seasonId }, rank: 1, score: 65 });
      // Podiums des mains et du side validé avec 4 classés ; rien pour le side à 3 classés.
      expect(record.medals.map((medal) => [medal.label, medal.type, medal.place])).toEqual([
        ['Celeste — Speedrun any%', 'main', 3],
        ['Overcooked 2 — Relais en cuisine', 'main', 3],
        ['Tetris 99 — Meilleur score', 'main', 2],
        ['Wikipédia — Speedrun de liens', 'side', 2],
        ['Trackmania — Contre-la-montre', 'main', 1],
      ]);
      expect(record.trophies).toEqual([]);
      expect((await get(`players/${crypto.randomUUID()}`, session)).status).toBe(404);
    });

    it('donne le trophée et le palmarès une fois la saison terminée', async () => {
      const { seasonId, playerIds } = await seedFictionalSeason(dataSource);
      const { session } = await login();
      expect(((await (await get('hall-of-fame', session)).json()) as HallOfFameDto).seasons).toEqual([]);

      await dataSource.query(`UPDATE seasons SET status = 'finished' WHERE id = $1`, [seasonId]);
      const hall = (await (await get('hall-of-fame', session)).json()) as HallOfFameDto;

      expect(hall.seasons.map(({ season, podium }) => [season.id, podium.map((entry) => [entry.rank, entry.player.pseudo])])).toEqual([
        [seasonId, [[1, 'Alice'], [2, 'Bruno'], [3, 'Chloé']]],
      ]);
      const record = (await (await get(`players/${playerIds['alice']}`, session)).json()) as PlayerRecordDto;
      expect(record.trophies.map((season) => season.id)).toEqual([seasonId]);
    });
  });

  describe('Saisons et events', () => {
    const api = (path: string, session: string, init: RequestInit = {}) =>
      fetch(`${base}/api/${path}`, {
        ...init,
        headers: { cookie: session, ...(init.body ? { 'content-type': 'application/json' } : {}) },
      });
    const send = (method: string, path: string, session: string, body?: object) =>
      api(path, session, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
    const json = async <T>(response: Response | Promise<Response>): Promise<T> => {
      const res = await response;
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      return (await res.json()) as T;
    };
    const day = 24 * 60 * 60 * 1000;
    const inDays = (days: number) => new Date(Date.now() + days * day).toISOString();

    async function circuit() {
      const sessions: Record<string, string> = {};
      const ids: Record<string, string> = {};
      for (const [name, discordId] of Object.entries({ admin: ADMIN_ID, alice: ALICE_ID, bruno: BRUNO_ID, chloe: CHLOE_ID, david: DAVID_ID })) {
        oauthDiscordId = discordId;
        sessions[name] = (await login()).session as string;
        ids[name] = (await json<MeDto>(me(sessions[name]))).id;
      }
      oauthDiscordId = ALICE_ID;
      const season = await json<SeasonDto>(
        send('POST', 'admin/seasons', sessions.admin, { name: 'Saison test', startDate: inDays(-30), endDate: inDays(150) }),
      );
      await json(send('POST', `admin/seasons/${season.id}/start`, sessions.admin));
      const idea = (name: string, teamMode = 'solo') =>
        json<IdeaDto>(
          send('POST', 'ideas', sessions.alice, {
            game: { kind: 'custom', name: 'Trackmania' },
            priceTier: 'free',
            name,
            teamMode,
            playMode: 'async',
          }),
        );
      const event = (type: string, formatId: string, extra: object = {}) =>
        json<EventDto>(
          send('POST', 'admin/events', sessions.admin, {
            seasonId: season.id,
            type,
            format: { kind: 'existing', formatId },
            announceDate: inDays(-10),
            registrationEnd: inDays(5),
            endDate: inDays(10),
            ...extra,
          }),
        );
      return { sessions, ids, season, idea, event };
    }

    it('réserve les routes admin à l’admin', async () => {
      const { sessions, season } = await circuit();

      expect((await fetch(`${base}/api/admin/seasons`, { method: 'POST' })).status).toBe(401);
      const refused = await send('POST', `admin/seasons/${season.id}/finish`, sessions.alice);
      expect(refused.status).toBe(403);
      expect(await refused.json()).toMatchObject({ code: 'forbidden' });
      expect((await send('POST', 'admin/seasons', sessions.alice, { name: 'X', startDate: inDays(0), endDate: inDays(1) })).status).toBe(403);
    });

    it('refuse une deuxième saison active et valide la saisie', async () => {
      const { sessions } = await circuit();
      const other = await json<SeasonDto>(send('POST', 'admin/seasons', sessions.admin, { name: 'Saison 2', startDate: inDays(150), endDate: inDays(330) }));

      expect(other).toMatchObject({ status: 'upcoming', mainQuota: 3, sideQuota: 2, scoringScale: { 1: 24, 9: 2 } });
      expect((await send('POST', `admin/seasons/${other.id}/start`, sessions.admin)).status).toBe(409);
      expect((await send('POST', 'admin/seasons', sessions.admin, { name: 'X', startDate: 'demain', endDate: inDays(1) })).status).toBe(400);
      const scale = await send('PATCH', `admin/seasons/${other.id}`, sessions.admin, { scoringScale: { 1: 10, 3: 5 } });
      expect(scale.status).toBe(400);
      expect(((await json<SeasonDto[]>(api('seasons', sessions.alice))).map((season) => season.name))).toEqual(['Saison 2', 'Saison test']);
    });

    it('joue une saison de bout en bout : main, side et event par équipe, jusqu’au classement', async () => {
      const { sessions, ids, season, idea, event } = await circuit();
      const players = ['alice', 'bruno', 'chloe', 'david'];

      // Main : chacun s'inscrit lui-même, une seule fois.
      const speedrun = await idea('Speedrun');
      await json(send('PUT', `ideas/${speedrun.id}/vote`, sessions.bruno));
      const main = await event('main', speedrun.id, { rules: 'Meilleur chrono sur 3 essais.' });
      expect(main).toMatchObject({ status: 'registration', coefficient: 1, registrationOpen: true });
      for (const name of players) await json(send('POST', `events/${main.id}/registrations`, sessions[name]));
      expect((await send('POST', `events/${main.id}/registrations`, sessions.alice)).status).toBe(409);
      expect((await send('PUT', `ideas/${speedrun.id}/vote`, sessions.chloe)).status).toBe(409);
      await json(send('POST', `admin/events/${main.id}/start`, sessions.admin));
      const closedMain = await json<EventDto>(
        send('PUT', `admin/events/${main.id}/results`, sessions.admin, {
          players: players.map((name, index) => ({ playerId: ids[name], place: index + 1 })),
        }),
      );
      expect(closedMain).toMatchObject({ status: 'finished', registrationCount: 4 });
      const replayed = (await json<IdeaDto[]>(api('ideas', sessions.alice))).find((item) => item.id === speedrun.id);
      expect(replayed).toMatchObject({ status: 'proposed', votes: 0, playedCount: 1 });

      // Side : format créé avec l'event, au nom de l'hôte, puis validé.
      const side = await json<EventDto>(
        send('POST', 'admin/events', sessions.admin, {
          seasonId: season.id,
          type: 'side',
          hostId: ids.bruno,
          format: { kind: 'new', idea: { game: { kind: 'custom', name: 'Trackmania' }, name: 'Course libre', teamMode: 'solo', playMode: 'live' } },
          announceDate: inDays(-10),
          registrationEnd: inDays(1),
          endDate: inDays(2),
          liveDate: inDays(2),
          challongeUrl: 'https://challonge.com/poro-side',
        }),
      );
      expect(side).toMatchObject({ coefficient: 0.5, host: { pseudo: 'Bruno' }, format: { name: 'Course libre' } });
      for (const name of players) await json(send('PUT', `admin/events/${side.id}/registrations/${ids[name]}`, sessions.admin));
      await json(
        send('PUT', `admin/events/${side.id}/results`, sessions.admin, {
          players: players.map((name, index) => ({ playerId: ids[name], place: 4 - index })),
        }),
      );
      expect(await json<EventDto>(send('PUT', `admin/events/${side.id}/validated`, sessions.admin, { validated: true }))).toMatchObject({
        validated: true,
        sideWarnings: [],
      });

      // Event par équipe : l'admin compose les équipes, chaque membre prend la place de son équipe.
      const relay = await event('main', (await idea('Relais', 'team')).id);
      for (const name of players) await json(send('POST', `events/${relay.id}/registrations`, sessions[name]));
      await json(send('POST', `admin/events/${relay.id}/teams`, sessions.admin, { name: 'Bleus' }));
      const { teams } = await json<EventDto>(send('POST', `admin/events/${relay.id}/teams`, sessions.admin, { name: 'Rouges' }));
      const bleus = teams.find((team) => team.name === 'Bleus')?.id as string;
      const rouges = teams.find((team) => team.name === 'Rouges')?.id as string;
      for (const [index, name] of players.entries()) {
        await json(send('PUT', `admin/events/${relay.id}/registrations/${ids[name]}/team`, sessions.admin, { teamId: index < 2 ? bleus : rouges }));
      }
      const closedRelay = await json<EventDto>(
        send('PUT', `admin/events/${relay.id}/results`, sessions.admin, { teams: [{ teamId: bleus, place: 2 }, { teamId: rouges, place: 1 }] }),
      );
      expect(closedRelay.results.filter((result) => result.place === 1).map((result) => result.playerId).sort()).toEqual([ids.chloe, ids.david].sort());

      const standings = await json<SeasonStandingsDto>(api('seasons/current/standings', sessions.alice));
      expect(standings.entries.map((entry) => [entry.rank, entry.player.pseudo, entry.score])).toEqual([
        [1, 'David', 48],
        [2, 'Ali la Menace', 48],
        [3, 'Chloé', 47],
        [4, 'Bruno', 43],
      ]);
      const events = await json<EventDto[]>(api(`seasons/${season.id}/events`, sessions.alice));
      expect(events.map((item) => item.status)).toEqual(['finished', 'finished', 'finished']);
    });

    it('poste l’annonce à la création et les résultats à la clôture, puis les tient à jour', async () => {
      const { sessions, ids, idea, event } = await circuit();
      announcer.ready = true;
      const settled = () => app.get(AnnouncementsService).settled();
      try {
        const main = await event('main', (await idea('Speedrun')).id);
        await settled();
        const [announcementId, versions] = [...announcer.announcements.entries()].at(-1) as [string, EventAnnouncement[]];
        expect(versions[0]).toMatchObject({ registrationOpen: true, event: { id: main.id, registrationCount: 0 } });

        await json(send('POST', `events/${main.id}/registrations`, sessions.alice));
        await json(send('POST', `events/${main.id}/registrations`, sessions.bruno));
        await settled();
        expect(versions.at(-1)?.event.registrationCount).toBe(2);

        const close = (places: [string, number][]) =>
          json(send('PUT', `admin/events/${main.id}/results`, sessions.admin, { players: places.map(([name, place]) => ({ playerId: ids[name], place })) }));
        await close([['alice', 1], ['bruno', 2]]);
        await settled();
        expect(announcer.results.size).toBe(1);
        const [results] = [...announcer.results.values()];
        expect(results[0].lines.map((line) => [line.place, line.label])).toEqual([[1, 'Ali la Menace'], [2, 'Bruno']]);
        expect(results[0].standings.map((entry) => entry.player.pseudo)).toEqual(['Ali la Menace', 'Bruno']);
        expect(versions.at(-1)).toMatchObject({ registrationOpen: false, event: { status: 'finished' } });

        await close([['alice', 2], ['bruno', 1]]);
        await settled();
        expect(announcer.results.size).toBe(1);
        expect(results.at(-1)?.lines.map((line) => line.label)).toEqual(['Bruno', 'Ali la Menace']);
        expect(announcer.announcements.has(announcementId)).toBe(true);

        const stored = await dataSource.query('SELECT announcement_message_id, results_message_id FROM events WHERE id = $1', [main.id]);
        expect(stored).toEqual([{ announcement_message_id: announcementId, results_message_id: [...announcer.results.keys()][0] }]);
      } finally {
        announcer.ready = false;
      }
    });

    it('garde secret un event dont la date d’annonce n’est pas arrivée', async () => {
      const { idea, event } = await circuit();
      announcer.ready = true;
      try {
        const before = announcer.announcements.size;
        const later = await event('main', (await idea('Plus tard')).id, { announceDate: inDays(3) });
        await app.get(AnnouncementsService).tick();
        expect(announcer.announcements.size).toBe(before);
        const stored = await dataSource.query('SELECT announcement_message_id FROM events WHERE id = $1', [later.id]);
        expect(stored[0].announcement_message_id).toBeNull();
      } finally {
        announcer.ready = false;
      }
    });

    it('ferme les inscriptions après la date limite, sauf pour l’admin', async () => {
      const { sessions, ids, idea, event } = await circuit();
      const late = await event('side', (await idea('Speedrun')).id, { announceDate: inDays(-10), registrationEnd: inDays(-1) });

      const refused = await send('POST', `events/${late.id}/registrations`, sessions.alice);
      expect(refused.status).toBe(409);
      expect(await refused.json()).toMatchObject({ code: 'closed' });
      expect((await json<EventDto>(send('PUT', `admin/events/${late.id}/registrations/${ids.alice}`, sessions.admin))).registrationCount).toBe(1);
      expect((await send('DELETE', `events/${late.id}/registrations`, sessions.alice)).status).toBe(404);
    });

    it('change le jeu d’un event, puis l’annule en libérant son format', async () => {
      const { sessions, idea, event } = await circuit();
      const first = await idea('Speedrun');
      const second = await idea('Course libre');
      const main = await event('main', first.id);

      const changed = await json<EventDto>(send('PUT', `admin/events/${main.id}/format`, sessions.admin, { format: { kind: 'existing', formatId: second.id } }));
      expect(changed.format.id).toBe(second.id);
      const statuses = async () => Object.fromEntries((await json<IdeaDto[]>(api('ideas', sessions.alice))).map((item) => [item.name, item.status]));
      expect(await statuses()).toEqual({ Speedrun: 'proposed', 'Course libre': 'selected' });

      expect(await json<EventDto>(send('POST', `admin/events/${main.id}/cancel`, sessions.admin))).toMatchObject({ status: 'cancelled' });
      expect(await statuses()).toEqual({ Speedrun: 'proposed', 'Course libre': 'proposed' });
      expect((await send('PUT', `admin/events/${main.id}/results`, sessions.admin, {})).status).toBe(409);
    });

    it('laisse le vainqueur du dernier main choisir le jeu suivant parmi le top 5', async () => {
      const { sessions, ids, idea, event } = await circuit();
      const played = await idea('Speedrun');
      const next = await idea('Course libre');
      expect(await json<NextGameDto>(api('game-choice', sessions.alice))).toMatchObject({ status: 'default', pick: { id: played.id } });

      const main = await event('main', played.id);
      expect((await json<NextGameDto>(api('game-choice', sessions.alice))).status).toBe('scheduled');
      for (const name of ['alice', 'bruno']) await json(send('POST', `events/${main.id}/registrations`, sessions[name]));
      await json(send('PUT', `admin/events/${main.id}/results`, sessions.admin, { players: [{ playerId: ids.bruno, place: 1 }, { playerId: ids.alice, place: 2 }] }));

      const open = await json<NextGameDto>(api('game-choice', sessions.bruno));
      expect(open).toMatchObject({ status: 'open', canChoose: true, choosers: [{ pseudo: 'Bruno' }] });
      expect(new Date(open.deadline as string).getTime() - new Date(open.lastMain?.finishedAt as string).getTime()).toBe(3 * day);
      expect((await send('PUT', 'game-choice', sessions.alice, { formatId: next.id })).status).toBe(403);

      const chosen = await json<NextGameDto>(send('PUT', 'game-choice', sessions.bruno, { formatId: next.id }));
      expect(chosen).toMatchObject({ status: 'chosen', pick: { id: next.id, status: 'selected' } });
      expect((await send('PUT', 'game-choice', sessions.bruno, { formatId: played.id })).status).toBe(409);
      expect((await send('PUT', `ideas/${next.id}/vote`, sessions.chloe)).status).toBe(409);

      const nextMain = await event('main', next.id);
      expect(nextMain.format.id).toBe(next.id);
      expect((await json<NextGameDto>(api('game-choice', sessions.alice))).status).toBe('scheduled');
    });
  });

  describe('Suggestions d’amélioration', () => {
    const send = (method: string, path: string, session?: string, body?: object) =>
      fetch(`${base}/api/${path}`, {
        method,
        headers: { ...(session ? { cookie: session } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const json = async <T>(response: Response | Promise<Response>): Promise<T> => {
      const res = await response;
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      return (await res.json()) as T;
    };

    async function players() {
      const sessions: Record<string, string> = {};
      for (const [name, discordId] of Object.entries({ admin: ADMIN_ID, alice: ALICE_ID, bruno: BRUNO_ID, chloe: CHLOE_ID })) {
        oauthDiscordId = discordId;
        sessions[name] = (await login()).session as string;
      }
      oauthDiscordId = ALICE_ID;
      return sessions;
    }

    it('sont derrière le mur de connexion', async () => {
      const id = crypto.randomUUID();
      for (const [method, path] of [
        ['GET', 'suggestions'],
        ['GET', 'suggestions/roadmap'],
        ['POST', 'suggestions'],
        ['PUT', `suggestions/${id}/vote`],
        ['PUT', `suggestions/${id}/status`],
        ['DELETE', `suggestions/${id}`],
      ]) {
        expect((await send(method, path)).status).toBe(401);
      }
    });

    it('une suggestion votée par deux comptes passe dans la roadmap, et un joueur la voit', async () => {
      const { admin, alice, bruno, chloe } = await players();
      const created = await json<SuggestionDto>(
        send('POST', 'suggestions', alice, { title: 'Un classement par équipe', description: 'Pour les events à deux.', category: 'format' }),
      );
      expect(created).toMatchObject({ status: 'proposed', score: 0, author: { pseudo: 'Ali la Menace' }, canEdit: true, canDelete: true });

      await json(send('PUT', `suggestions/${created.id}/vote`, alice, { value: 1 }));
      const voted = await json<SuggestionDto>(send('PUT', `suggestions/${created.id}/vote`, bruno, { value: 1 }));
      expect(voted).toMatchObject({ upvotes: 2, downvotes: 0, score: 2, myVote: 1 });

      expect((await send('PUT', `suggestions/${created.id}/status`, alice, { status: 'planned' })).status).toBe(403);
      await json(send('PUT', `suggestions/${created.id}/status`, admin, { status: 'planned' }));

      const roadmap = await json<RoadmapDto>(send('GET', 'suggestions/roadmap', chloe));
      expect(roadmap.planned.map((item) => [item.title, item.score])).toEqual([['Un classement par équipe', 2]]);
      expect(roadmap.done).toEqual([]);
      const seen = await json<SuggestionDto>(send('GET', `suggestions/${created.id}`, alice));
      expect(seen).toMatchObject({ status: 'planned', canEdit: false, canDelete: false, canVote: true });
      expect((await send('DELETE', `suggestions/${created.id}`, alice)).status).toBe(403);
    });

    it('change ou retire un vote, fige les votes une fois livrée, et trie par score', async () => {
      const { admin, alice, bruno, chloe } = await players();
      const propose = (title: string, category = 'site') => json<SuggestionDto>(send('POST', 'suggestions', alice, { title, category }));
      const low = await propose('Mode sombre');
      const high = await propose('Rappels Discord', 'bot');

      await json(send('PUT', `suggestions/${low.id}/vote`, bruno, { value: -1 }));
      await json(send('PUT', `suggestions/${high.id}/vote`, chloe, { value: -1 }));
      expect((await json<SuggestionDto>(send('PUT', `suggestions/${high.id}/vote`, chloe, { value: 1 }))).score).toBe(1);
      expect((await json<SuggestionDto>(send('DELETE', `suggestions/${low.id}/vote`, bruno))).myVote).toBeNull();
      await json(send('PUT', `suggestions/${low.id}/vote`, chloe, { value: -1 }));

      const titles = async (query = '') => (await json<SuggestionDto[]>(send('GET', `suggestions${query}`, bruno))).map((item) => item.title);
      expect(await titles()).toEqual(['Rappels Discord', 'Mode sombre']);
      expect(await titles('?category=site')).toEqual(['Mode sombre']);

      await json(send('PUT', `suggestions/${high.id}/status`, admin, { status: 'planned' }));
      await json(send('PUT', `suggestions/${high.id}/status`, admin, { status: 'done' }));
      expect(await titles('?status=done')).toEqual(['Rappels Discord']);
      expect(await titles('?status=proposed')).toEqual(['Mode sombre']);
      const frozen = await send('PUT', `suggestions/${high.id}/vote`, bruno, { value: 1 });
      expect(frozen.status).toBe(409);
      expect(((await frozen.json()) as { code: string }).code).toBe('votes_frozen');
      expect((await json<RoadmapDto>(send('GET', 'suggestions/roadmap', bruno))).done.map((item) => item.title)).toEqual(['Rappels Discord']);
    });

    it('reprend les pistes V2 dans la roadmap et le « plus tard » en propositions, une seule fois, au nom de l’admin', async () => {
      const { RoadmapSuggestions1794843631066, ROADMAP_SUGGESTIONS } = await import('./database/migrations/1794843631066-RoadmapSuggestions');
      const migration = new RoadmapSuggestions1794843631066();
      const runner = dataSource.createQueryRunner();
      try {
        await migration.up(runner);
        expect(Number((await dataSource.query('SELECT count(*) FROM suggestions'))[0].count)).toBe(0);

        const { admin, bruno } = await players();
        await migration.up(runner);
        await migration.up(runner);

        const roadmap = await json<RoadmapDto>(send('GET', 'suggestions/roadmap', bruno));
        expect(roadmap.planned.map((item) => item.title)).toEqual(ROADMAP_SUGGESTIONS.filter((item) => item.status === 'planned').map((item) => item.title));
        expect(roadmap.planned.every((item) => item.author.pseudo === 'Tong')).toBe(true);
        const proposed = await json<SuggestionDto[]>(send('GET', 'suggestions?status=proposed', admin));
        expect(proposed.map((item) => item.title)).toEqual(['Ladder à défis permanent', 'Showmatch contre un autre Discord', 'Badges fantaisie']);

        await migration.down(runner);
        expect(await json<SuggestionDto[]>(send('GET', 'suggestions', admin))).toEqual([]);
      } finally {
        await runner.release();
      }
    });

    it('laisse l’auteur modifier et supprimer tant que c’est proposé, l’admin toujours, et valide la saisie', async () => {
      const { admin, alice, bruno } = await players();
      const { id } = await json<SuggestionDto>(send('POST', 'suggestions', alice, { title: 'Brouillon', category: 'process' }));

      expect((await send('PATCH', `suggestions/${id}`, bruno, { title: 'Pirate' })).status).toBe(403);
      expect((await json<SuggestionDto>(send('PATCH', `suggestions/${id}`, alice, { title: 'Version propre' }))).title).toBe('Version propre');
      expect((await send('POST', 'suggestions', alice, { title: '   ', category: 'site' })).status).toBe(400);
      expect((await send('POST', 'suggestions', alice, { title: 'Ok', category: 'autre' })).status).toBe(400);
      expect((await send('PUT', `suggestions/${id}/vote`, alice, { value: 2 })).status).toBe(400);
      expect((await send('GET', `suggestions/${crypto.randomUUID()}`, alice)).status).toBe(404);

      await json(send('PUT', `suggestions/${id}/status`, admin, { status: 'planned' }));
      expect((await send('PATCH', `suggestions/${id}`, alice, { title: 'Encore' })).status).toBe(403);
      expect((await send('DELETE', `suggestions/${id}`, admin)).status).toBe(204);

      const other = await json<SuggestionDto>(send('POST', 'suggestions', alice, { title: 'Autre', category: 'site' }));
      await json(send('PUT', `suggestions/${other.id}/vote`, bruno, { value: 1 }));
      expect((await send('DELETE', `suggestions/${other.id}`, alice)).status).toBe(204);
      expect(await json<SuggestionDto[]>(send('GET', 'suggestions', alice))).toEqual([]);
    });
  });
});
