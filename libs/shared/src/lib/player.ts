export type PlayerRoleDto = 'admin' | 'player';

/** Le joueur connecté, renvoyé par `GET /api/me`. */
export interface MeDto {
  id: string;
  pseudo: string;
  avatarUrl: string;
  role: PlayerRoleDto;
}
