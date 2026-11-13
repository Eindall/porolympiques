import type { SessionStore } from '../sessions/session.store';
import { PlayersService } from './players.service';
import { InMemoryPlayers, RecordingSessions, member, player } from './test-helpers';

function setup(initial = [player()], admins: string[] = []) {
  const players = new InMemoryPlayers(initial);
  const sessions = new RecordingSessions();
  const service = new PlayersService(players, sessions as unknown as SessionStore, new Set(admins));
  return { players, sessions, service };
}

describe('PlayersService', () => {
  describe('signIn', () => {
    it('connecte un membre déjà synchronisé et met son profil à jour', async () => {
      const { service } = setup();

      const result = await service.signIn('100000000000000001', member({ nickname: 'Ali' }));

      expect(result).toEqual({ kind: 'ok', player: expect.objectContaining({ id: 'p-1', pseudo: 'Ali', active: true }) });
    });

    it('crée le joueur si la synchro l’a manqué', async () => {
      const { service, players } = setup([]);

      const result = await service.signIn('100000000000000001', member());

      expect(result.kind).toBe('ok');
      expect(players.rows.size).toBe(1);
    });

    it('refuse un non-membre, le désactive et coupe ses sessions', async () => {
      const { service, players, sessions } = setup();

      expect(await service.signIn('100000000000000001', null)).toEqual({ kind: 'not_member' });
      expect(players.rows.get('p-1')?.active).toBe(false);
      expect(sessions.revokedFor).toEqual(['p-1']);
    });

    it('refuse un inconnu qui n’est pas membre, sans rien créer', async () => {
      const { service, players } = setup([]);

      expect(await service.signIn('100000000000000003', null)).toEqual({ kind: 'not_member' });
      expect(players.rows.size).toBe(0);
    });

    it('réactive un ancien membre revenu sur le serveur', async () => {
      const { service } = setup([player({ active: false })]);

      const result = await service.signIn('100000000000000001', member());

      expect(result).toEqual({ kind: 'ok', player: expect.objectContaining({ active: true }) });
    });
  });

  describe('memberLeft', () => {
    it('désactive le joueur et révoque ses sessions', async () => {
      const { service, players, sessions } = setup();

      await service.memberLeft('100000000000000001');

      expect(players.rows.get('p-1')?.active).toBe(false);
      expect(sessions.revokedFor).toEqual(['p-1']);
    });

    it('ignore un inconnu', async () => {
      const { service, sessions } = setup();

      await service.memberLeft('100000000000000003');

      expect(sessions.revokedFor).toEqual([]);
    });
  });

  describe('memberPresent', () => {
    it('ignore les bots', async () => {
      const { service, players } = setup([]);

      expect(await service.memberPresent(member({ isBot: true }))).toBeNull();
      expect(players.rows.size).toBe(0);
    });
  });

  describe('syncMembers', () => {
    it('crée, met à jour et désactive, puis coupe les sessions des partants', async () => {
      const gone = player({ id: 'p-2', discordId: '100000000000000002' });
      const { service, players, sessions } = setup([player(), gone], ['100000000000000001']);

      const report = await service.syncMembers([member(), member({ discordId: '100000000000000004', username: 'bob', globalName: null })]);

      expect(report).toEqual({ created: 1, updated: 1, deactivated: 1 });
      expect(players.rows.get('p-1')?.role).toBe('admin');
      expect(players.rows.get('p-2')?.active).toBe(false);
      expect(sessions.revokedFor).toEqual(['p-2']);
      expect((await players.findByDiscordId('100000000000000004'))?.pseudo).toBe('bob');
    });

    it('refuse une liste de membres vide plutôt que de désactiver tout le monde', async () => {
      const { service, players } = setup();

      await expect(service.syncMembers([])).rejects.toThrow('synchro annulée');
      expect(players.rows.get('p-1')?.active).toBe(true);
    });
  });
});
