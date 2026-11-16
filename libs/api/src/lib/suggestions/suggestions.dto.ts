import {
  SUGGESTION_CATEGORIES,
  SUGGESTION_DESCRIPTION_MAX,
  SUGGESTION_STATUSES,
  SUGGESTION_TITLE_MAX,
  type SuggestionCategoryDto,
  type SuggestionStatusDto,
  type SuggestionVoteDto,
} from '@porolympiques/shared';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ProposeSuggestionBody {
  @IsString()
  @MaxLength(SUGGESTION_TITLE_MAX + 50)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(SUGGESTION_DESCRIPTION_MAX + 200)
  description?: string;

  @IsIn(SUGGESTION_CATEGORIES)
  category!: SuggestionCategoryDto;
}

export class UpdateSuggestionBody {
  @IsOptional()
  @IsString()
  @MaxLength(SUGGESTION_TITLE_MAX + 50)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(SUGGESTION_DESCRIPTION_MAX + 200)
  description?: string;

  @IsOptional()
  @IsIn(SUGGESTION_CATEGORIES)
  category?: SuggestionCategoryDto;
}

export class VoteBody {
  @IsIn([1, -1])
  value!: SuggestionVoteDto;
}

export class StatusBody {
  @IsIn(SUGGESTION_STATUSES)
  status!: SuggestionStatusDto;
}

export class SuggestionsQuery {
  @IsOptional()
  @IsIn(SUGGESTION_CATEGORIES)
  category?: SuggestionCategoryDto;

  @IsOptional()
  @IsIn(SUGGESTION_STATUSES)
  status?: SuggestionStatusDto;
}
