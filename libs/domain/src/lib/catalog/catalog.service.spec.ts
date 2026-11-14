import { FakeCatalog, InMemoryGames, InMemorySearchCache, catalogGame, customGame } from '../ideas/test-helpers';
import { CatalogService, SEARCH_CACHE_TTL_MS, SEARCH_LIMIT } from './catalog.service';
import { normalizeName } from './normalize';

function setup(localGames = [customGame('g-1', 'Archipelago')], remote = [catalogGame('1', 'Mario Kart 8')]) {
  const games = new InMemoryGames(localGames);
  const catalog = new FakeCatalog(remote);
  const cache = new InMemorySearchCache();
  let now = new Date('2026-11-13T12:00:00Z');
  const service = new CatalogService(games, catalog, cache, () => now);
  return { games, catalog, cache, service, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
}

describe('normalizeName', () => {
  it('retire casse, accents et espaces en trop', () => {
    expect(normalizeName('  Pokémon   ÉCARLATE ')).toBe('pokemon ecarlate');
  });
});

describe('CatalogService.search', () => {
  it('ne cherche rien en dessous de 2 caractères', async () => {
    const { service, catalog } = setup();

    expect(await service.search(' m ')).toEqual({ results: [], catalogAvailable: true });
    expect(catalog.searches).toEqual([]);
  });

  it('met les jeux enregistrés d’abord, puis complète avec le catalogue', async () => {
    const { service } = setup(
      [customGame('g-1', 'Mario Party maison'), { ...customGame('g-2', 'Mario Kart 8'), source: 'igdb', externalId: '1' }],
      [catalogGame('1', 'Mario Kart 8'), catalogGame('2', 'Super Mario Odyssey', 2017)],
    );

    const { results, catalogAvailable } = await service.search('mario');

    expect(catalogAvailable).toBe(true);
    // Mario Kart 8, déjà enregistré, n'apparaît qu'une fois : avec son identifiant local.
    expect(results.map((result) => [result.name, result.gameId, result.source])).toEqual([
      ['Mario Party maison', 'g-1', 'custom'],
      ['Mario Kart 8', 'g-2', 'igdb'],
      ['Super Mario Odyssey', null, 'igdb'],
    ]);
    expect(results[2]).toEqual({
      gameId: null,
      source: 'igdb',
      externalId: '2',
      name: 'Super Mario Odyssey',
      coverUrl: expect.stringContaining('/2.jpg'),
      year: 2017,
      priceTier: null,
      coverFile: null,
    });
  });

  it('interroge le catalogue même quand des jeux enregistrés correspondent', async () => {
    const { service, catalog } = setup([customGame('g-1', 'Mario maison')]);

    await service.search('Mario');

    expect(catalog.searches).toEqual(['mario']);
  });

  it(`renvoie au plus ${SEARCH_LIMIT} résultats`, async () => {
    const remote = Array.from({ length: 15 }, (_v, i) => catalogGame(String(i), `Zelda ${i}`));
    const { service } = setup([], remote);

    expect((await service.search('zelda')).results).toHaveLength(SEARCH_LIMIT);
  });

  it('garde la recherche en cache 6 h, par requête normalisée', async () => {
    const { service, catalog, advance } = setup();

    await service.search('Mario');
    await service.search('  MARIO ');
    advance(SEARCH_CACHE_TTL_MS - 1);
    await service.search('mario');
    expect(catalog.searches).toEqual(['mario']);

    advance(1);
    await service.search('mario');
    expect(catalog.searches).toEqual(['mario', 'mario']);
  });

  it('se rabat sur les jeux enregistrés quand le catalogue ne répond pas', async () => {
    const { service, catalog } = setup([customGame('g-1', 'Mario maison')]);
    catalog.down = true;

    const { results, catalogAvailable } = await service.search('mario');

    expect(catalogAvailable).toBe(false);
    expect(results.map((result) => result.name)).toEqual(['Mario maison']);
  });

  it('utilise un cache périmé plutôt que rien quand le catalogue ne répond pas', async () => {
    const { service, catalog, advance } = setup([]);
    await service.search('mario');
    advance(SEARCH_CACHE_TTL_MS);
    catalog.down = true;

    const { results, catalogAvailable } = await service.search('mario');

    expect(catalogAvailable).toBe(false);
    expect(results.map((result) => result.name)).toEqual(['Mario Kart 8']);
  });
});
