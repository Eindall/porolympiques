import { Global, Module } from '@nestjs/common';
import {
  CATALOG_SEARCH_CACHE,
  COVER_STORAGE,
  type CatalogSearchCache,
  type CoverStorage,
  CatalogService,
  GAME_CATALOG,
  GAME_REPOSITORY,
  type GameCatalog,
  type GameRepository,
  IDEA_REPOSITORY,
  type IdeaRepository,
  IdeasService,
} from '@porolympiques/domain';
import { IgdbModule } from '@porolympiques/igdb';

/**
 * Câblage de la boîte à idées : services du domaine (classes TypeScript pures) avec leurs ports, dont le
 * catalogue IGDB. Global : l'API les sert maintenant, le bot les utilisera pour `/list-games` et `/add-game`.
 */
@Global()
@Module({
  imports: [IgdbModule],
  providers: [
    {
      provide: CatalogService,
      inject: [GAME_REPOSITORY, GAME_CATALOG, CATALOG_SEARCH_CACHE],
      useFactory: (games: GameRepository, catalog: GameCatalog, cache: CatalogSearchCache) =>
        new CatalogService(games, catalog, cache),
    },
    {
      provide: IdeasService,
      inject: [IDEA_REPOSITORY, GAME_REPOSITORY, GAME_CATALOG, COVER_STORAGE],
      useFactory: (ideas: IdeaRepository, games: GameRepository, catalog: GameCatalog, covers: CoverStorage) =>
        new IdeasService(ideas, games, catalog, covers),
    },
  ],
  exports: [CatalogService, IdeasService],
})
export class IdeasModule {}
