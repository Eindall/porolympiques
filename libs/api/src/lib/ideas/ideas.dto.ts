import { PLAY_MODES, PRICE_TIERS, type PlayModeDto, type PriceTierDto, TEAM_MODES, type TeamModeDto } from '@porolympiques/shared';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateIf, ValidateNested } from 'class-validator';

const KINDS = ['existing', 'catalog', 'custom'] as const;

export class GameChoiceBody {
  @IsIn(KINDS)
  kind!: (typeof KINDS)[number];

  @ValidateIf((body: GameChoiceBody) => body.kind === 'existing')
  @IsUUID()
  gameId?: string;

  @ValidateIf((body: GameChoiceBody) => body.kind === 'catalog')
  @Matches(/^\d{1,12}$/)
  externalId?: string;

  @ValidateIf((body: GameChoiceBody) => body.kind === 'custom')
  @IsString()
  @MaxLength(200)
  name?: string;
}

export class SuggestIdeaBody {
  @ValidateNested()
  @Type(() => GameChoiceBody)
  game!: GameChoiceBody;

  @IsOptional()
  @IsIn(PRICE_TIERS)
  priceTier?: PriceTierDto | null;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsIn(TEAM_MODES)
  teamMode!: TeamModeDto;

  @IsIn(PLAY_MODES)
  playMode!: PlayModeDto;
}

export class UpdateIdeaBody {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsIn(TEAM_MODES)
  teamMode?: TeamModeDto;

  @IsOptional()
  @IsIn(PLAY_MODES)
  playMode?: PlayModeDto;

  @IsOptional()
  @IsIn(PRICE_TIERS)
  priceTier?: PriceTierDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  gameName?: string;
}

export class IdeasQuery {
  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsOptional()
  @IsIn(PRICE_TIERS)
  priceTier?: PriceTierDto;

  @IsOptional()
  @IsIn(TEAM_MODES)
  teamMode?: TeamModeDto;

  @IsOptional()
  @IsIn(PLAY_MODES)
  playMode?: PlayModeDto;
}

export class CatalogSearchQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
