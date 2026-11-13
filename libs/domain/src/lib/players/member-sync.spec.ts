import { planMemberSync } from './member-sync';
import { member, player } from './test-helpers';

const noAdmins = new Set<string>();

describe('planMemberSync', () => {
  it('crée les nouveaux membres', () => {
    const plan = planMemberSync([member()], [], noAdmins);

    expect(plan.toCreate).toEqual([
      { discordId: '100000000000000001', pseudo: 'Alice', avatarUrl: member().avatarUrl, role: 'player' },
    ]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toDeactivate).toEqual([]);
  });

  it('ignore les bots', () => {
    const plan = planMemberSync([member({ discordId: '200000000000000000', isBot: true })], [], noAdmins);

    expect(plan.toCreate).toEqual([]);
  });

  it('désactive les joueurs actifs qui ne sont plus sur le serveur', () => {
    const gone = player({ id: 'p-2', discordId: '100000000000000002' });
    const plan = planMemberSync([member()], [player(), gone], noAdmins);

    expect(plan.toDeactivate).toEqual([gone]);
  });

  it('laisse tranquilles les joueurs déjà désactivés', () => {
    const plan = planMemberSync([member()], [player(), player({ id: 'p-2', discordId: '100000000000000002', active: false })], noAdmins);

    expect(plan.toDeactivate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
  });

  it('réactive et met à jour un joueur revenu', () => {
    const plan = planMemberSync([member({ nickname: 'Ali' })], [player({ active: false })], noAdmins);

    expect(plan.toUpdate).toEqual([{ id: 'p-1', changes: { pseudo: 'Ali', active: true } }]);
  });

  it('attribue le rôle admin par configuration', () => {
    const plan = planMemberSync([member()], [player()], new Set(['100000000000000001']));

    expect(plan.toUpdate).toEqual([{ id: 'p-1', changes: { role: 'admin' } }]);
  });

  it('ne traite un membre en double qu’une fois', () => {
    const plan = planMemberSync([member(), member()], [], noAdmins);

    expect(plan.toCreate).toHaveLength(1);
  });
});
