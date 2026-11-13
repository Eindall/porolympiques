import type { GuildMember, Player } from './player';
import type { PlayerRepository } from './player.repository';
import type { SessionStore } from '../sessions/session.store';
import { changesFor, profileOf } from './player-rules';
import { planMemberSync } from './member-sync';

export type SignInResult = { kind: 'ok'; player: Player } | { kind: 'not_member' };

export interface MemberSyncReport {
  created: number;
  updated: number;
  deactivated: number;
}

/**
 * Cycle de vie des joueurs : créés par la synchro des membres du serveur, mis à jour à chaque connexion,
 * désactivés (sessions coupées) quand ils quittent le serveur, réactivés s'ils reviennent.
 */
export class PlayersService {
  constructor(
    private readonly players: PlayerRepository,
    private readonly sessions: SessionStore,
    private readonly adminIds: ReadonlySet<string>,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  findById(id: string): Promise<Player | null> {
    return this.players.findById(id);
  }

  /**
   * Connexion : `member` est la fiche lue sur le serveur au moment de la connexion, `null` si la personne
   * n'en est pas membre. Un non-membre est refusé, et désactivé s'il était connu.
   */
  async signIn(discordId: string, member: GuildMember | null): Promise<SignInResult> {
    if (!member || member.isBot) {
      await this.memberLeft(discordId);
      return { kind: 'not_member' };
    }
    return { kind: 'ok', player: await this.upsert(member) };
  }

  /** Arrivée sur le serveur, ou changement de surnom ou d'avatar. */
  async memberPresent(member: GuildMember): Promise<Player | null> {
    if (member.isBot) return null;
    return this.upsert(member);
  }

  /** Départ du serveur : le joueur est désactivé et toutes ses sessions sont révoquées. */
  async memberLeft(discordId: string): Promise<void> {
    const player = await this.players.findByDiscordId(discordId);
    if (!player) return;
    if (player.active) await this.players.update(player.id, { active: false });
    await this.sessions.revokeAllForPlayer(player.id, this.clock());
  }

  /** Synchro complète à partir de la liste de tous les membres du serveur. */
  async syncMembers(members: readonly GuildMember[]): Promise<MemberSyncReport> {
    // Garde-fou : une liste vide viendrait d'une lecture ratée (le bot est lui-même membre), pas d'un serveur vide.
    // La traiter désactiverait tout le monde.
    if (members.length === 0) throw new Error('Liste des membres vide : synchro annulée');

    const plan = planMemberSync(members, await this.players.findAll(), this.adminIds);
    for (const profile of plan.toCreate) await this.players.create({ ...profile, active: true });
    for (const { id, changes } of plan.toUpdate) await this.players.update(id, changes);
    for (const player of plan.toDeactivate) {
      await this.players.update(player.id, { active: false });
      await this.sessions.revokeAllForPlayer(player.id, this.clock());
    }
    return { created: plan.toCreate.length, updated: plan.toUpdate.length, deactivated: plan.toDeactivate.length };
  }

  private async upsert(member: GuildMember): Promise<Player> {
    const profile = profileOf(member, this.adminIds);
    const player = await this.players.findByDiscordId(member.discordId);
    if (!player) return this.players.create({ ...profile, active: true });
    const changes = changesFor(player, profile);
    return Object.keys(changes).length > 0 ? this.players.update(player.id, changes) : player;
  }
}
