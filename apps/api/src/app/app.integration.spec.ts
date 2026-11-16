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
  type CatalogGame,
  FICTIONAL_SEASON,
  GAME_CATALOG,
  type GameCatalog,
  GUILD_DIRECTORY,
  type GuildDirectory,
  type GuildMember,
  PlayersService,
} from '@porolympiques/domain';
import type { GameDto, GameSearchDto, IdeaDto, SeasonStandingsDto } from '@porolympiques/shared';
import { DataSource } from 'typeorm';
import { assertTestDatabase } from './testing/assert-test-database';

const APP_URL = 'http://localhost:4200';
const ADMIN_ID = '100000000000000009';
const ALICE_ID = '100000000000000001';
const BRUNO_ID = '100000000000000002';

const describeWithDb = process.env['TEST_DATABASE_URL'] ? describe : describe.skip;

/** Annuaire du serveur simulé : les membres présents, modifiables d'un test à l'autre. */
class FakeGuildDirectory implements GuildDirectory {
  members = new Map<string, GuildMember>();
  unavailable = false;

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
    expect(await response.json()).toEqual({ status: 'ok' });
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
});
