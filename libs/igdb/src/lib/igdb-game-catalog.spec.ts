import { IgdbGameCatalog } from './igdb-game-catalog';

interface Call {
  url: string;
  init: RequestInit;
}

/** Faux réseau : répond aux appels Twitch et IGDB dans l'ordre prévu, et garde la trace des appels. */
function fakeHttp(igdbResponses: Array<{ status: number; body: unknown }>, tokens = ['jeton-1', 'jeton-2']) {
  const calls: Call[] = [];
  const http = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    if (url.startsWith('https://id.twitch.tv/')) {
      return new Response(JSON.stringify({ access_token: tokens.shift(), expires_in: 3600, token_type: 'bearer' }));
    }
    const next = igdbResponses.shift() ?? { status: 200, body: [] };
    return new Response(typeof next.body === 'string' ? next.body : JSON.stringify(next.body), { status: next.status });
  }) as typeof fetch;
  return { http, calls, igdbCalls: () => calls.filter((call) => call.url.startsWith('https://api.igdb.com/')) };
}

function setup(responses: Array<{ status: number; body: unknown }> = []) {
  const net = fakeHttp(responses);
  let now = 1_000_000;
  const waits: number[] = [];
  const catalog = new IgdbGameCatalog(
    { clientId: 'client-id', clientSecret: 'client-secret' },
    net.http,
    () => now,
    async (ms) => {
      waits.push(ms);
      now += ms;
    },
  );
  return { ...net, catalog, waits, advance: (ms: number) => (now += ms) };
}

const witcher = { id: 1942, name: 'The Witcher 3: Wild Hunt', cover: { image_id: 'co1wyy' }, first_release_date: 1431993600 };

describe('IgdbGameCatalog', () => {
  it('cherche des jeux et les traduit pour le domaine', async () => {
    const { catalog } = setup([{ status: 200, body: [witcher, { id: 7, name: 'Sans jaquette' }] }]);

    expect(await catalog.search('witcher')).toEqual([
      {
        externalId: '1942',
        name: 'The Witcher 3: Wild Hunt',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg',
        year: 2015,
      },
      { externalId: '7', name: 'Sans jaquette', coverUrl: null, year: null },
    ]);
  });

  it('obtient un jeton d’application Twitch et l’envoie à IGDB avec le Client-ID', async () => {
    const { catalog, calls } = setup();

    await catalog.search('witcher');

    const [token, igdb] = calls;
    expect(token.url).toBe(
      'https://id.twitch.tv/oauth2/token?client_id=client-id&client_secret=client-secret&grant_type=client_credentials',
    );
    expect(token.init.method).toBe('POST');
    expect(igdb.url).toBe('https://api.igdb.com/v4/games');
    expect(igdb.init.headers).toMatchObject({ 'Client-ID': 'client-id', Authorization: 'Bearer jeton-1' });
    expect(igdb.init.body).toBe(
      'search "witcher"; fields name,cover.image_id,first_release_date; where game_type = (0,4,8,9,10,11) & version_parent = null; limit 10;',
    );
  });

  it('retire les guillemets et antislashs de la recherche', async () => {
    const { catalog, igdbCalls } = setup();

    await catalog.search('a"b\\c');
    expect(await catalog.search(' " ')).toEqual([]);

    expect(igdbCalls().map((call) => call.init.body)).toEqual([expect.stringContaining('search "a b c";')]);
  });

  it('réutilise le jeton tant qu’il est valide, et le renouvelle avant son expiration', async () => {
    const { catalog, calls, advance } = setup();

    await catalog.search('a');
    advance(3600_000 - 61_000);
    await catalog.search('b');
    advance(2_000);
    await catalog.search('c');

    const tokenCalls = calls.filter((call) => call.url.startsWith('https://id.twitch.tv/'));
    expect(tokenCalls).toHaveLength(2);
    expect(calls.at(-1)?.init.headers).toMatchObject({ Authorization: 'Bearer jeton-2' });
  });

  it('redemande un jeton une fois si IGDB le refuse', async () => {
    const { catalog, igdbCalls } = setup([
      { status: 401, body: 'Unauthorized' },
      { status: 200, body: [witcher] },
    ]);

    expect(await catalog.search('witcher')).toHaveLength(1);
    expect(igdbCalls().map((call) => (call.init.headers as Record<string, string>)['Authorization'])).toEqual([
      'Bearer jeton-1',
      'Bearer jeton-2',
    ]);
  });

  it('échoue si IGDB refuse encore après un nouveau jeton, ou répond une erreur', async () => {
    await expect(
      setup([
        { status: 401, body: 'Unauthorized' },
        { status: 401, body: 'Unauthorized' },
      ]).catalog.search('a'),
    ).rejects.toThrow('IGDB a répondu 401');
    await expect(setup([{ status: 429, body: 'Too Many Requests' }]).catalog.search('a')).rejects.toThrow('429');
  });

  it('espace les appels d’au moins 250 ms', async () => {
    const { catalog, waits } = setup();

    await Promise.all([catalog.search('a'), catalog.search('b'), catalog.search('c')]);

    expect(waits).toEqual([250, 250]);
  });

  it('lit un jeu par son identifiant', async () => {
    const { catalog, igdbCalls } = setup([{ status: 200, body: [witcher] }, { status: 200, body: [] }]);

    expect(await catalog.findById('1942')).toMatchObject({ externalId: '1942', name: 'The Witcher 3: Wild Hunt' });
    expect(await catalog.findById('404')).toBeNull();
    expect(await catalog.findById('1 or 1')).toBeNull();
    expect(igdbCalls().map((call) => call.init.body)).toEqual([
      'fields name,cover.image_id,first_release_date; where id = 1942; limit 1;',
      'fields name,cover.image_id,first_release_date; where id = 404; limit 1;',
    ]);
  });
});
