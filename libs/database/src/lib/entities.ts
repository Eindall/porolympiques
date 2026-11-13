import { CatalogSearchCacheEntity } from './catalog/catalog-search-cache.entity';
import { FormatEntity } from './catalog/format.entity';
import { GameEntity } from './catalog/game.entity';
import { VoteEntity } from './catalog/vote.entity';
import { EventEntity } from './events/event.entity';
import { RegistrationEntity } from './events/registration.entity';
import { ResultEntity } from './events/result.entity';
import { TeamEntity } from './events/team.entity';
import { PlayerEntity } from './players/player.entity';
import { SeasonEntity } from './seasons/season.entity';
import { AuthSessionEntity } from './sessions/auth-session.entity';
import { SuggestionVoteEntity } from './suggestions/suggestion-vote.entity';
import { SuggestionEntity } from './suggestions/suggestion.entity';

/** Liste explicite des entités (pas de glob : le bundle webpack n'a pas de système de fichiers). */
export const ENTITIES = [
  PlayerEntity,
  AuthSessionEntity,
  SeasonEntity,
  GameEntity,
  FormatEntity,
  VoteEntity,
  EventEntity,
  TeamEntity,
  RegistrationEntity,
  ResultEntity,
  SuggestionEntity,
  SuggestionVoteEntity,
  CatalogSearchCacheEntity,
];
