import { changesFor, profileOf, pseudoOf, roleOf } from './player-rules';
import { member, player } from './test-helpers';

describe('pseudoOf', () => {
  it('prend le surnom du serveur en priorité', () => {
    expect(pseudoOf(member({ nickname: 'Ali la Menace', globalName: 'Alice' }))).toBe('Ali la Menace');
  });

  it("prend le nom d'affichage sans surnom", () => {
    expect(pseudoOf(member({ nickname: null, globalName: 'Alice' }))).toBe('Alice');
  });

  it("prend le nom d'utilisateur en dernier recours", () => {
    expect(pseudoOf(member({ nickname: null, globalName: null, username: 'alice' }))).toBe('alice');
  });

  it('ignore un surnom fait seulement d’espaces', () => {
    expect(pseudoOf(member({ nickname: '   ', globalName: 'Alice' }))).toBe('Alice');
  });
});

describe('roleOf', () => {
  const admins = new Set(['100000000000000009']);

  it('donne le rôle admin aux identifiants de la configuration', () => {
    expect(roleOf('100000000000000009', admins)).toBe('admin');
  });

  it('donne le rôle joueur aux autres', () => {
    expect(roleOf('100000000000000001', admins)).toBe('player');
  });
});

describe('changesFor', () => {
  const admins = new Set<string>();

  it('ne change rien pour un joueur à jour', () => {
    expect(changesFor(player(), profileOf(member(), admins))).toEqual({});
  });

  it('reprend le nouveau pseudo et le nouvel avatar', () => {
    const profile = profileOf(member({ nickname: 'Ali', avatarUrl: 'https://cdn.discordapp.com/a.png' }), admins);
    expect(changesFor(player(), profile)).toEqual({ pseudo: 'Ali', avatarUrl: 'https://cdn.discordapp.com/a.png' });
  });

  it('réactive un joueur revenu sur le serveur', () => {
    expect(changesFor(player({ active: false }), profileOf(member(), admins))).toEqual({ active: true });
  });

  it("retire le rôle admin quand il n'est plus dans la configuration", () => {
    expect(changesFor(player({ role: 'admin' }), profileOf(member(), admins))).toEqual({ role: 'player' });
  });
});
