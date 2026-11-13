import type { GuildMember } from './player';

/** Port vers l'annuaire du serveur Discord (implémenté par la lib `bot`). */
export interface GuildDirectory {
  /** La fiche du membre, ou `null` s'il n'est pas (ou plus) sur le serveur. */
  findMember(discordId: string): Promise<GuildMember | null>;
}

export const GUILD_DIRECTORY = Symbol('GuildDirectory');
