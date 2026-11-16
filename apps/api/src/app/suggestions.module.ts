import { Global, Module } from '@nestjs/common';
import { SUGGESTION_REPOSITORY, type SuggestionRepository, SuggestionsService } from '@porolympiques/domain';

/** Câblage des suggestions d'amélioration : service du domaine (classe TypeScript pure) avec son port. */
@Global()
@Module({
  providers: [
    {
      provide: SuggestionsService,
      inject: [SUGGESTION_REPOSITORY],
      useFactory: (suggestions: SuggestionRepository) => new SuggestionsService(suggestions),
    },
  ],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
