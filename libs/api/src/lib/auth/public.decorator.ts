import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/**
 * Ouvre une route sans session. Réservé à la route de santé et au flux de connexion :
 * tout le reste de l'API est derrière le mur (voir SessionGuard).
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
