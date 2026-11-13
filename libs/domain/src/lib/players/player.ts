export type PlayerRole = 'admin' | 'player';

/** Un joueur : un membre (actuel ou passé) du serveur Discord. */
export interface Player {
  id: string;
  discordId: string;
  pseudo: string;
  avatarUrl: string;
  role: PlayerRole;
  /** Faux quand le membre a quitté le serveur : il ne peut plus se connecter, ses résultats restent affichés. */
  active: boolean;
}

/** Ce qu'on garde d'un joueur, calculé à partir de sa fiche de membre. */
export type PlayerProfile = Pick<Player, 'discordId' | 'pseudo' | 'avatarUrl' | 'role'>;

export type NewPlayer = Omit<Player, 'id'>;
export type PlayerChanges = Partial<Omit<Player, 'id' | 'discordId'>>;

/**
 * Fiche d'un membre du serveur, telle que le bot la lit. L'avatar arrive déjà résolu
 * (avatar de serveur, sinon avatar du compte, sinon avatar par défaut).
 */
export interface GuildMember {
  discordId: string;
  username: string;
  globalName: string | null;
  nickname: string | null;
  avatarUrl: string;
  isBot: boolean;
}
