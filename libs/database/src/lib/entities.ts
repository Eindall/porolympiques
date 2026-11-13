import { AuthSessionEntity } from './sessions/auth-session.entity';
import { PlayerEntity } from './players/player.entity';

/** Liste explicite des entités (pas de glob : le bundle webpack n'a pas de système de fichiers). */
export const ENTITIES = [PlayerEntity, AuthSessionEntity];
