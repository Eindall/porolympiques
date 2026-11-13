/**
 * Tests d'intégration de l'application complète, sur une vraie base (TEST_DATABASE_URL), avec Discord simulé :
 * l'échange OAuth et l'annuaire du serveur (le bot) sont remplacés par des faux.
 * Ignorés sans TEST_DATABASE_URL. ATTENTION : ils vident les tables de cette base.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DiscordStrategy } from '@porolympiques/api';
import { GUILD_DIRECTORY, type GuildDirectory, type GuildMember, PlayersService } from '@porolympiques/domain';
import { DataSource } from 'typeorm';
import { assertTestDatabase } from './testing/assert-test-database';

const APP_URL = 'http://localhost:4200';
const ADMIN_ID = '100000000000000009';
const ALICE_ID = '100000000000000001';

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
    await dataSource.query('TRUNCATE players CASCADE');
    directory.members = new Map([
      [ALICE_ID, guildMember(ALICE_ID, { globalName: 'Alice', nickname: 'Ali la Menace' })],
      [ADMIN_ID, guildMember(ADMIN_ID, { globalName: 'Tong' })],
    ]);
    directory.unavailable = false;
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
});
