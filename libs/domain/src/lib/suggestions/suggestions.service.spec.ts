import { InMemoryPlayers, player } from '../players/test-helpers';
import { SuggestionError } from './suggestion-error';
import { SuggestionsService } from './suggestions.service';
import { InMemorySuggestions } from './test-helpers';

const alice = player({ id: 'p-1', pseudo: 'Alice' });
const bruno = player({ id: 'p-2', pseudo: 'Bruno', discordId: '2' });
const chloe = player({ id: 'p-3', pseudo: 'Chloé', discordId: '3' });
const admin = player({ id: 'p-9', pseudo: 'Admin', discordId: '9', role: 'admin' });

describe('SuggestionsService', () => {
  let repo: InMemorySuggestions;
  let service: SuggestionsService;

  beforeEach(() => {
    repo = new InMemorySuggestions(new InMemoryPlayers([alice, bruno, chloe, admin]));
    service = new SuggestionsService(repo);
  });

  const propose = (title = 'Un classement par équipe', by = alice) => service.propose(by, { title, category: 'format' });

  async function refusal(promise: Promise<unknown>): Promise<SuggestionError> {
    const error = await promise.then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(SuggestionError);
    return error as SuggestionError;
  }

  describe('proposer', () => {
    it('crée une suggestion proposée, sans vote, avec ses droits', async () => {
      const created = await service.propose(alice, { title: '  Un   bot plus bavard ', description: ' Des stats ', category: 'bot' });

      expect(created).toMatchObject({
        title: 'Un bot plus bavard',
        description: 'Des stats',
        category: 'bot',
        status: 'proposed',
        author: { id: 'p-1', pseudo: 'Alice' },
        score: 0,
        myVote: null,
        canEdit: true,
        canDelete: true,
        canVote: true,
      });
    });

    it('refuse un titre vide ou trop long, une description trop longue, une catégorie inconnue', async () => {
      expect((await refusal(propose('   '))).code).toBe('invalid');
      expect((await refusal(propose('x'.repeat(151)))).code).toBe('invalid');
      expect((await refusal(service.propose(alice, { title: 'Ok', description: 'x'.repeat(2001), category: 'site' }))).code).toBe('invalid');
      expect((await refusal(service.propose(alice, { title: 'Ok', category: 'autre' as never }))).code).toBe('invalid');
      expect(repo.rows.size).toBe(0);
    });
  });

  describe('voter', () => {
    it('pour ou contre, modifiable et retirable, avec le score calculé', async () => {
      const { id } = await propose();

      await service.vote(alice, id, 1);
      await service.vote(bruno, id, 1);
      expect(await service.vote(chloe, id, -1)).toMatchObject({ upvotes: 2, downvotes: 1, score: 1, myVote: -1 });

      expect(await service.vote(chloe, id, 1)).toMatchObject({ score: 3, myVote: 1 });
      expect(await service.vote(bruno, id, null)).toMatchObject({ score: 2, myVote: null });
      expect((await service.get(alice, id)).myVote).toBe(1);
    });

    it('reste ouvert dans la roadmap, et se fige une fois livrée', async () => {
      const { id } = await propose();
      await service.setStatus(admin, id, 'planned');
      expect((await service.vote(bruno, id, 1)).score).toBe(1);

      await service.setStatus(admin, id, 'done');
      expect((await service.get(bruno, id)).canVote).toBe(false);
      expect((await refusal(service.vote(bruno, id, -1))).code).toBe('votes_frozen');
      expect((await refusal(service.vote(bruno, id, null))).code).toBe('votes_frozen');
      expect((await service.get(bruno, id)).score).toBe(1);
    });

    it('refuse une valeur autre que +1 ou -1, et une suggestion inconnue', async () => {
      const { id } = await propose();
      expect((await refusal(service.vote(bruno, id, 2 as never))).code).toBe('invalid');
      expect((await refusal(service.vote(bruno, 'nope', 1))).code).toBe('not_found');
    });
  });

  describe('lister', () => {
    it('trie par score, puis les plus anciennes, et filtre par catégorie et statut', async () => {
      const first = await propose('Première');
      const second = await propose('Deuxième');
      const third = await service.propose(bruno, { title: 'Troisième', category: 'site' });
      await service.vote(alice, third.id, 1);
      await service.vote(bruno, first.id, -1);

      expect((await service.list(alice)).map((item) => item.title)).toEqual(['Troisième', 'Deuxième', 'Première']);
      expect((await service.list(alice, { category: 'format' })).map((item) => item.id)).toEqual([second.id, first.id]);

      await service.setStatus(admin, second.id, 'planned');
      expect((await service.list(alice, { status: 'proposed' })).map((item) => item.id)).toEqual([third.id, first.id]);
      expect((await service.list(alice, { status: 'planned', category: 'site' })).length).toBe(0);
    });

    it('donne la roadmap : prévu par score, livré du plus récent au plus ancien', async () => {
      const [a, b, c, d] = [await propose('A'), await propose('B'), await propose('C'), await propose('D')];
      await service.vote(bruno, b.id, 1);
      for (const item of [a, b, c, d]) await service.setStatus(admin, item.id, 'planned');
      await service.setStatus(admin, c.id, 'done');
      await service.setStatus(admin, d.id, 'done');

      const roadmap = await service.roadmap(chloe);
      expect(roadmap.planned.map((item) => item.title)).toEqual(['B', 'A']);
      expect(roadmap.done.map((item) => item.title)).toEqual(['D', 'C']);
    });
  });

  describe('modifier et supprimer', () => {
    it('l’auteur modifie et supprime tant que la suggestion est proposée', async () => {
      const { id } = await propose();
      await service.vote(bruno, id, 1);

      expect(await service.update(alice, id, { title: 'Nouveau titre', category: 'process' })).toMatchObject({
        title: 'Nouveau titre',
        category: 'process',
        score: 1,
      });
      await service.remove(alice, id);
      expect(repo.rows.size).toBe(0);
      expect(repo.votes.size).toBe(0);
    });

    it('un autre joueur ne modifie ni ne supprime', async () => {
      const { id } = await propose();
      expect((await service.get(bruno, id)).canEdit).toBe(false);
      expect((await refusal(service.update(bruno, id, { title: 'Pirate' }))).code).toBe('forbidden');
      expect((await refusal(service.remove(bruno, id))).code).toBe('forbidden');
    });

    it('dans la roadmap, seul l’admin modifie ou supprime', async () => {
      const { id } = await propose();
      await service.setStatus(admin, id, 'planned');

      expect((await service.get(alice, id)).canDelete).toBe(false);
      expect((await refusal(service.update(alice, id, { title: 'Encore' }))).code).toBe('forbidden');
      expect((await refusal(service.remove(alice, id))).code).toBe('forbidden');

      expect((await service.get(admin, id)).canEdit).toBe(true);
      expect((await service.update(admin, id, { description: 'Précisé' })).description).toBe('Précisé');
      await service.remove(admin, id);
      expect(repo.rows.size).toBe(0);
    });

    it('valide les changements comme à la création', async () => {
      const { id } = await propose();
      expect((await refusal(service.update(alice, id, { title: ' ' }))).code).toBe('invalid');
    });
  });

  describe('roadmap', () => {
    it('l’admin ajoute, retire, marque livrée et revient en arrière', async () => {
      const { id } = await propose();
      expect((await service.setStatus(admin, id, 'planned')).status).toBe('planned');
      expect((await service.setStatus(admin, id, 'proposed')).status).toBe('proposed');
      await service.setStatus(admin, id, 'planned');
      expect((await service.setStatus(admin, id, 'done')).status).toBe('done');
      expect((await service.setStatus(admin, id, 'planned')).status).toBe('planned');
    });

    it('est réservée à l’admin, auteur compris', async () => {
      const { id } = await propose();
      expect((await refusal(service.setStatus(alice, id, 'planned'))).code).toBe('forbidden');
      expect((await refusal(service.setStatus(admin, id, 'later' as never))).code).toBe('invalid');
      expect((await refusal(service.setStatus(admin, 'nope', 'planned'))).code).toBe('not_found');
    });
  });
});
