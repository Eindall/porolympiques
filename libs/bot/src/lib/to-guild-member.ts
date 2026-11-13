import type { GuildMember } from '@porolympiques/domain';

/** Le sous-ensemble d'un `GuildMember` discord.js dont on a besoin (facile à simuler en test). */
export interface DiscordMemberLike {
  id: string;
  nickname: string | null;
  user: { username: string; globalName: string | null; bot: boolean };
  displayAvatarURL(options: { size: number; extension: 'png' }): string;
}

/** Fiche de membre du domaine. L'avatar est celui du serveur, sinon celui du compte, sinon l'avatar par défaut. */
export function toGuildMember(member: DiscordMemberLike): GuildMember {
  return {
    discordId: member.id,
    username: member.user.username,
    globalName: member.user.globalName,
    nickname: member.nickname,
    avatarUrl: member.displayAvatarURL({ size: 256, extension: 'png' }),
    isBot: member.user.bot,
  };
}
