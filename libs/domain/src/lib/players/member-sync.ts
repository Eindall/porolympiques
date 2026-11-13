import type { GuildMember, Player, PlayerChanges, PlayerProfile } from './player';
import { changesFor, profileOf } from './player-rules';

export interface MemberSyncPlan {
  toCreate: PlayerProfile[];
  toUpdate: Array<{ id: string; changes: PlayerChanges }>;
  /** Joueurs actifs qui ne sont plus sur le serveur. */
  toDeactivate: Player[];
}

/**
 * Compare la liste complète des membres du serveur aux joueurs connus.
 * Les bots sont ignorés. Un joueur absent du serveur est désactivé, jamais supprimé.
 */
export function planMemberSync(
  members: readonly GuildMember[],
  players: readonly Player[],
  adminIds: ReadonlySet<string>,
): MemberSyncPlan {
  const byDiscordId = new Map(players.map((player) => [player.discordId, player]));
  const present = new Set<string>();
  const plan: MemberSyncPlan = { toCreate: [], toUpdate: [], toDeactivate: [] };

  for (const member of members) {
    if (member.isBot || present.has(member.discordId)) continue;
    present.add(member.discordId);
    const profile = profileOf(member, adminIds);
    const player = byDiscordId.get(member.discordId);
    if (!player) {
      plan.toCreate.push(profile);
      continue;
    }
    const changes = changesFor(player, profile);
    if (Object.keys(changes).length > 0) plan.toUpdate.push({ id: player.id, changes });
  }

  plan.toDeactivate = players.filter((player) => player.active && !present.has(player.discordId));
  return plan;
}
