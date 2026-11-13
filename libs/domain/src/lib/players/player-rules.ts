import type { GuildMember, Player, PlayerChanges, PlayerProfile, PlayerRole } from './player';

/** Le pseudo affiché : le surnom sur le serveur, sinon le nom d'affichage Discord, sinon le nom d'utilisateur. */
export function pseudoOf(member: GuildMember): string {
  return member.nickname?.trim() || member.globalName?.trim() || member.username;
}

/** Admin si l'identifiant Discord est dans la liste de configuration, joueur sinon. */
export function roleOf(discordId: string, adminIds: ReadonlySet<string>): PlayerRole {
  return adminIds.has(discordId) ? 'admin' : 'player';
}

export function profileOf(member: GuildMember, adminIds: ReadonlySet<string>): PlayerProfile {
  return {
    discordId: member.discordId,
    pseudo: pseudoOf(member),
    avatarUrl: member.avatarUrl,
    role: roleOf(member.discordId, adminIds),
  };
}

/**
 * Ce qui change pour un joueur présent sur le serveur : profil à jour, et réactivation s'il était parti
 * (rejoindre le serveur vaut validation). Objet vide si rien ne change.
 */
export function changesFor(player: Player, profile: PlayerProfile): PlayerChanges {
  const changes: PlayerChanges = {};
  if (player.pseudo !== profile.pseudo) changes.pseudo = profile.pseudo;
  if (player.avatarUrl !== profile.avatarUrl) changes.avatarUrl = profile.avatarUrl;
  if (player.role !== profile.role) changes.role = profile.role;
  if (!player.active) changes.active = true;
  return changes;
}
