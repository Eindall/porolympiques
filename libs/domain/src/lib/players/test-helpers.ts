import type { SessionStore } from '../sessions/session.store';
import type { GuildMember, NewPlayer, Player, PlayerChanges } from './player';
import type { PlayerRepository } from './player.repository';

/** Fabriques et faux ports en mémoire, pour les tests du domaine uniquement. */
export function member(overrides: Partial<GuildMember> = {}): GuildMember {
  return {
    discordId: '100000000000000001',
    username: 'alice',
    globalName: 'Alice',
    nickname: null,
    avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
    isBot: false,
    ...overrides,
  };
}

export function player(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p-1',
    discordId: '100000000000000001',
    pseudo: 'Alice',
    avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
    role: 'player',
    active: true,
    ...overrides,
  };
}

export class InMemoryPlayers implements PlayerRepository {
  readonly rows = new Map<string, Player>();
  private nextId = 1;

  constructor(initial: Player[] = []) {
    for (const row of initial) this.rows.set(row.id, { ...row });
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByDiscordId(discordId: string) {
    return [...this.rows.values()].find((row) => row.discordId === discordId) ?? null;
  }
  async findAll() {
    return [...this.rows.values()];
  }
  async create(data: NewPlayer) {
    const row = { ...data, id: `new-${this.nextId++}` };
    this.rows.set(row.id, row);
    return row;
  }
  async update(id: string, changes: PlayerChanges) {
    const row = { ...(this.rows.get(id) as Player), ...changes };
    this.rows.set(id, row);
    return row;
  }
}

/** Ne retient que les révocations globales, seules utilisées par PlayersService. */
export class RecordingSessions implements Pick<SessionStore, 'revokeAllForPlayer'> {
  readonly revokedFor: string[] = [];
  async revokeAllForPlayer(playerId: string) {
    this.revokedFor.push(playerId);
    return 1;
  }
}
