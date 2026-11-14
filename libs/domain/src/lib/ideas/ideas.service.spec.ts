import type { Game } from '../catalog/game';
import type { IdeaInput } from './ideas.service';
import { IdeasService } from './ideas.service';
import { MAX_COVER_BYTES } from '../catalog/cover';
import {
  FakeCatalog,
  InMemoryCovers,
  InMemoryGames,
  InMemoryIdeas,
  JPEG_BYTES,
  PNG_BYTES,
  catalogGame,
  customGame,
} from './test-helpers';

const alice = { id: 'p-alice', role: 'player' as const };
const bruno = { id: 'p-bruno', role: 'player' as const };
const admin = { id: 'p-admin', role: 'admin' as const };

function setup(initialGames: Game[] = []) {
  const games = new InMemoryGames(initialGames);
  const ideas = new InMemoryIdeas(games, { 'p-alice': 'Alice' });
  const catalog = new FakeCatalog([catalogGame('1942', 'The Witcher 3', 2015)]);
  const covers = new InMemoryCovers();
  return { games, ideas, catalog, covers, service: new IdeasService(ideas, games, catalog, covers) };
}

const input = (overrides: Partial<IdeaInput> = {}): IdeaInput => ({
  game: { kind: 'catalog', externalId: '1942' },
  priceTier: '10to30',
  name: 'Speedrun any%',
  description: 'Le plus vite possible.',
  teamMode: 'solo',
  playMode: 'async',
  ...overrides,
});

describe('IdeasService', () => {
  describe('suggest', () => {
    it('enregistre le jeu du catalogue avec sa tranche, crée le format et y met le vote de l’auteur', async () => {
      const { service, games } = setup();

      const idea = await service.suggest(alice, input());

      expect(idea).toMatchObject({
        name: 'Speedrun any%',
        status: 'proposed',
        votes: 1,
        votedByMe: true,
        playedCount: 0,
        suggestedBy: { id: 'p-alice', pseudo: 'Alice' },
        game: { source: 'igdb', externalId: '1942', name: 'The Witcher 3', priceTier: '10to30' },
      });
      expect(games.rows.size).toBe(1);
    });

    it('réutilise un jeu du catalogue déjà enregistré et garde sa tranche de prix', async () => {
      const { service, games } = setup();
      await service.suggest(alice, input());

      const idea = await service.suggest(bruno, input({ name: 'Mort subite', priceTier: 'gt30' }));

      expect(games.rows.size).toBe(1);
      expect(idea.game.priceTier).toBe('10to30');
    });

    it('accepte une suggestion sans tranche quand le jeu en a déjà une', async () => {
      const { service } = setup([customGame('g-1', 'Archipelago')]);

      const idea = await service.suggest(alice, input({ game: { kind: 'existing', gameId: 'g-1' }, priceTier: null }));

      expect(idea.game.priceTier).toBe('free');
    });

    it('demande la tranche quand le jeu n’en a pas encore', async () => {
      const { service } = setup([customGame('g-1', 'Archipelago', { priceTier: null })]);

      await expect(service.suggest(alice, input({ priceTier: null }))).rejects.toMatchObject({ code: 'price_tier_required' });
      await expect(
        service.suggest(alice, input({ game: { kind: 'existing', gameId: 'g-1' }, priceTier: null })),
      ).rejects.toMatchObject({ code: 'price_tier_required' });

      const idea = await service.suggest(alice, input({ game: { kind: 'existing', gameId: 'g-1' }, priceTier: 'lt10' }));
      expect(idea.game.priceTier).toBe('lt10');
    });

    it('accepte un jeu hors catalogue, et le réutilise s’il est ressaisi autrement', async () => {
      const { service, games } = setup();

      const first = await service.suggest(alice, input({ game: { kind: 'custom', name: '  Speedrun   Wikipédia ' }, priceTier: 'free' }));
      const second = await service.suggest(
        bruno,
        input({ game: { kind: 'custom', name: 'speedrun wikipedia' }, priceTier: null, name: 'Chemin le plus court' }),
      );

      expect(first.game).toMatchObject({ source: 'custom', externalId: null, name: 'Speedrun Wikipédia', priceTier: 'free' });
      expect(second.game.id).toBe(first.game.id);
      expect(games.rows.size).toBe(1);
    });

    it('refuse un format de même nom sur le même jeu, à la casse et aux accents près', async () => {
      const { service } = setup();
      await service.suggest(alice, input({ name: 'Défi chrono' }));

      await expect(service.suggest(bruno, input({ name: ' defi  CHRONO ' }))).rejects.toMatchObject({ code: 'duplicate' });
    });

    it('accepte le même nom de format sur un autre jeu', async () => {
      const { service } = setup([customGame('g-1', 'Archipelago')]);
      await service.suggest(alice, input({ name: 'Défi chrono' }));

      await expect(
        service.suggest(alice, input({ game: { kind: 'existing', gameId: 'g-1' }, name: 'Défi chrono' })),
      ).resolves.toBeTruthy();
    });

    it('refuse un nom de format ou de jeu vide', async () => {
      const { service } = setup();

      await expect(service.suggest(alice, input({ name: '   ' }))).rejects.toMatchObject({ code: 'invalid' });
      await expect(service.suggest(alice, input({ game: { kind: 'custom', name: ' ' } }))).rejects.toMatchObject({ code: 'invalid' });
    });

    it('refuse un jeu introuvable', async () => {
      const { service } = setup();

      await expect(service.suggest(alice, input({ game: { kind: 'existing', gameId: 'g-404' } }))).rejects.toMatchObject({ code: 'not_found' });
      await expect(service.suggest(alice, input({ game: { kind: 'catalog', externalId: '404' } }))).rejects.toMatchObject({ code: 'not_found' });
    });

    it('signale un catalogue injoignable quand il faut y lire le jeu', async () => {
      const { service, catalog } = setup();
      catalog.down = true;

      await expect(service.suggest(alice, input())).rejects.toMatchObject({ code: 'catalog_unavailable' });
    });
  });

  describe('votes', () => {
    it('ajoute et retire un vote, sans doublon', async () => {
      const { service } = setup();
      const { id } = await service.suggest(alice, input());

      await service.vote(bruno, id);
      const voted = await service.vote(bruno, id);
      expect([voted.votes, voted.votedByMe]).toEqual([2, true]);

      const unvoted = await service.unvote(bruno, id);
      expect([unvoted.votes, unvoted.votedByMe]).toEqual([1, false]);
    });

    it('laisse l’auteur retirer son vote d’office', async () => {
      const { service } = setup();
      const { id } = await service.suggest(alice, input());

      expect((await service.unvote(alice, id)).votes).toBe(0);
    });

    it('gèle les votes d’un format retenu pour un event', async () => {
      const { service, ideas } = setup();
      const { id } = await service.suggest(alice, input());
      ideas.formats.set(id, { ...ideas.formats.get(id)!, status: 'selected' });

      await expect(service.vote(bruno, id)).rejects.toMatchObject({ code: 'votes_frozen' });
      await expect(service.unvote(alice, id)).rejects.toMatchObject({ code: 'votes_frozen' });
    });

    it('refuse un vote sur une idée introuvable', async () => {
      const { service } = setup();

      await expect(service.vote(bruno, 'f-404')).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('list', () => {
    it('trie par votes, puis de la plus ancienne à la plus récente', async () => {
      const { service } = setup([customGame('g-1', 'Archipelago')]);
      const onGame = (name: string) => input({ game: { kind: 'existing', gameId: 'g-1' }, name });
      const a = await service.suggest(alice, onGame('A'));
      const b = await service.suggest(alice, onGame('B'));
      const c = await service.suggest(alice, onGame('C'));
      await service.vote(bruno, c.id);
      await service.vote(admin, c.id);
      await service.vote(bruno, b.id);

      const list = await service.list(bruno);

      expect(list.map((idea) => [idea.name, idea.votes])).toEqual([
        ['C', 3],
        ['B', 2],
        ['A', 1],
      ]);
      expect(list.map((idea) => idea.votedByMe)).toEqual([true, true, false]);
      expect(a.id).toBeTruthy();
    });

    it('passe les filtres au repository', async () => {
      const { service } = setup([customGame('g-1', 'Archipelago')]);
      await service.suggest(alice, input());
      await service.suggest(alice, input({ game: { kind: 'existing', gameId: 'g-1' }, teamMode: 'team' }));

      expect((await service.list(alice, { teamMode: 'team' })).map((idea) => idea.game.name)).toEqual(['Archipelago']);
      expect((await service.list(alice, { priceTier: '10to30' })).map((idea) => idea.game.name)).toEqual(['The Witcher 3']);
    });
  });

  describe('admin', () => {
    it('corrige le format et le jeu', async () => {
      const { service } = setup();
      const { id } = await service.suggest(alice, input({ game: { kind: 'custom', name: 'Wikipedia' }, priceTier: 'free' }));

      const idea = await service.update(admin, id, { name: ' Chemin  le plus court ', playMode: 'live', priceTier: 'lt10', gameName: 'Wikipédia' });

      expect(idea).toMatchObject({ name: 'Chemin le plus court', playMode: 'live', game: { name: 'Wikipédia', priceTier: 'lt10' } });
    });

    it('garde le nom d’un jeu du catalogue', async () => {
      const { service } = setup();
      const { id } = await service.suggest(alice, input());

      await expect(service.update(admin, id, { gameName: 'Autre' })).rejects.toMatchObject({ code: 'invalid' });
    });

    it('refuse un renommage qui créerait un doublon, mais pas de garder son propre nom', async () => {
      const { service } = setup();
      await service.suggest(alice, input({ name: 'A' }));
      const { id } = await service.suggest(alice, input({ name: 'B' }));

      await expect(service.update(admin, id, { name: 'a' })).rejects.toMatchObject({ code: 'duplicate' });
      await expect(service.update(admin, id, { name: 'b' })).resolves.toMatchObject({ name: 'b' });
    });

    it('supprime une idée et ses votes', async () => {
      const { service, ideas } = setup();
      const { id } = await service.suggest(alice, input());

      await service.remove(admin, id);

      expect(ideas.formats.size).toBe(0);
      expect(ideas.votes.size).toBe(0);
    });

    it('refuse de supprimer un format joué dans un event', async () => {
      const { service, ideas } = setup();
      const { id } = await service.suggest(alice, input());
      ideas.usedByEvents.add(id);

      await expect(service.remove(admin, id)).rejects.toMatchObject({ code: 'in_use' });
    });

    it('réserve la suppression à l’admin, même face à l’auteur', async () => {
      const { service } = setup();
      const { id } = await service.suggest(alice, input());

      await expect(service.remove(alice, id)).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('corrige aussi un format retenu', async () => {
      const { service, ideas } = setup();
      const { id } = await service.suggest(alice, input());
      ideas.formats.set(id, { ...ideas.formats.get(id)!, status: 'selected' });

      await expect(service.update(admin, id, { description: 'Règles précisées.' })).resolves.toMatchObject({ canEdit: true });
    });
  });

  describe('modification par l’auteur', () => {
    it('laisse l’auteur modifier son format, et garde les votes', async () => {
      const { service } = setup();
      const { id } = await service.suggest(alice, input());
      await service.vote(bruno, id);

      const idea = await service.update(alice, id, { name: 'Speedrun 100%', description: 'Tout ramasser.', teamMode: 'team', playMode: 'live' });

      expect(idea).toMatchObject({ name: 'Speedrun 100%', description: 'Tout ramasser.', teamMode: 'team', playMode: 'live', votes: 2, canEdit: true });
    });

    it('refuse la modification par un autre joueur', async () => {
      const { service } = setup();
      const { id } = await service.suggest(alice, input());

      await expect(service.update(bruno, id, { name: 'X' })).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('bloque l’auteur une fois le format retenu', async () => {
      const { service, ideas } = setup();
      const { id } = await service.suggest(alice, input());
      ideas.formats.set(id, { ...ideas.formats.get(id)!, status: 'selected' });

      await expect(service.update(alice, id, { name: 'X' })).rejects.toMatchObject({
        code: 'forbidden',
        message: expect.stringContaining('retenu'),
      });
      expect((await service.list(alice))[0].canEdit).toBe(false);
    });

    it('laisse la tranche de prix à l’admin', async () => {
      const { service } = setup();
      const { id } = await service.suggest(alice, input());

      await expect(service.update(alice, id, { priceTier: 'gt30' })).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('laisse renommer un jeu saisi librement par celui qui l’a ajouté, pas par les autres auteurs', async () => {
      const { service } = setup();
      const first = await service.suggest(alice, input({ game: { kind: 'custom', name: 'Wikipedia' }, priceTier: 'free' }));
      const second = await service.suggest(bruno, input({ game: { kind: 'custom', name: 'wikipedia' }, priceTier: null, name: 'Autre' }));

      expect([first.canEditGame, second.canEditGame]).toEqual([true, false]);
      await expect(service.update(alice, first.id, { gameName: 'Wikipédia' })).resolves.toMatchObject({ game: { name: 'Wikipédia' } });
      await expect(service.update(bruno, second.id, { gameName: 'Wiki' })).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('indique dans la liste ce que chacun peut modifier', async () => {
      const { service } = setup();
      await service.suggest(alice, input({ game: { kind: 'custom', name: 'Archipelago' }, priceTier: 'free' }));

      expect((await service.list(alice))[0]).toMatchObject({ canEdit: true, canEditGame: true });
      expect((await service.list(bruno))[0]).toMatchObject({ canEdit: false, canEditGame: false });
      expect((await service.list(admin))[0]).toMatchObject({ canEdit: true, canEditGame: true });
    });

    it('ne laisse modifier le jeu d’aucune idée du catalogue', async () => {
      const { service } = setup();

      expect((await service.suggest(alice, input())).canEditGame).toBe(false);
    });
  });

  describe('image d’un jeu saisi librement', () => {
    async function customIdea() {
      const context = setup();
      const idea = await context.service.suggest(alice, input({ game: { kind: 'custom', name: 'Archipelago' }, priceTier: 'free' }));
      return { ...context, gameId: idea.game.id };
    }

    it('enregistre l’image envoyée par celui qui a ajouté le jeu, et la relit avec son type', async () => {
      const { service, covers, gameId } = await customIdea();

      const game = await service.setCover(alice, gameId, PNG_BYTES);

      expect(game.coverFile).toBe('cover-1.png');
      expect(covers.files.has('cover-1.png')).toBe(true);
      expect(await service.readCover(gameId)).toEqual({ bytes: PNG_BYTES, contentType: 'image/png' });
    });

    it('remplace l’image précédente et supprime son fichier', async () => {
      const { service, covers, gameId } = await customIdea();
      await service.setCover(alice, gameId, PNG_BYTES);

      const game = await service.setCover(admin, gameId, JPEG_BYTES);

      expect(game.coverFile).toBe('cover-2.jpg');
      expect([...covers.files.keys()]).toEqual(['cover-2.jpg']);
    });

    it('retire l’image', async () => {
      const { service, covers, gameId } = await customIdea();
      await service.setCover(alice, gameId, PNG_BYTES);

      expect((await service.removeCover(alice, gameId)).coverFile).toBeNull();
      expect(covers.files.size).toBe(0);
      expect(await service.readCover(gameId)).toBeNull();
    });

    it('refuse un fichier qui n’est pas une image acceptée, quel que soit son nom', async () => {
      const { service, covers, gameId } = await customIdea();

      await expect(service.setCover(alice, gameId, new TextEncoder().encode('<svg/>'))).rejects.toMatchObject({ code: 'unsupported_file' });
      await expect(service.setCover(alice, gameId, new Uint8Array())).rejects.toMatchObject({ code: 'invalid' });
      await expect(service.setCover(alice, gameId, undefined)).rejects.toMatchObject({ code: 'invalid' });
      expect(covers.files.size).toBe(0);
    });

    it('refuse une image de plus de 2 Mo', async () => {
      const { service, gameId } = await customIdea();
      const big = new Uint8Array(MAX_COVER_BYTES + 1);
      big.set(PNG_BYTES);

      await expect(service.setCover(alice, gameId, big)).rejects.toMatchObject({ code: 'file_too_large' });
    });

    it('accepte une image d’exactement 2 Mo', async () => {
      const { service, gameId } = await customIdea();
      const max = new Uint8Array(MAX_COVER_BYTES);
      max.set(PNG_BYTES);

      await expect(service.setCover(alice, gameId, max)).resolves.toBeTruthy();
    });

    it('réserve l’image à celui qui a ajouté le jeu et à l’admin', async () => {
      const { service, gameId } = await customIdea();

      await expect(service.setCover(bruno, gameId, PNG_BYTES)).rejects.toMatchObject({ code: 'forbidden' });
      await expect(service.removeCover(bruno, gameId)).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('laisse sa jaquette à un jeu du catalogue', async () => {
      const { service } = setup();
      const idea = await service.suggest(alice, input());

      await expect(service.setCover(admin, idea.game.id, PNG_BYTES)).rejects.toMatchObject({ code: 'invalid' });
    });

    it('signale un jeu introuvable', async () => {
      const { service } = setup();

      await expect(service.setCover(admin, 'g-404', PNG_BYTES)).rejects.toMatchObject({ code: 'not_found' });
      expect(await service.readCover('g-404')).toBeNull();
    });
  });
});
