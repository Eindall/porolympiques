import type { NewPlayer, Player, PlayerChanges } from './player';

/** Port de persistance des joueurs (implémenté par la lib `database`). */
export interface PlayerRepository {
  findById(id: string): Promise<Player | null>;
  findByDiscordId(discordId: string): Promise<Player | null>;
  findAll(): Promise<Player[]>;
  create(player: NewPlayer): Promise<Player>;
  update(id: string, changes: PlayerChanges): Promise<Player>;
}

export const PLAYER_REPOSITORY = Symbol('PlayerRepository');
