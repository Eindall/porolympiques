import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SuggestIdeaBody } from '../ideas/ideas.dto';

export class SeasonBody {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsISO8601({ strict: true })
  startDate!: string;

  @IsISO8601({ strict: true })
  endDate!: string;

  /** Vérifié en détail par le domaine (places qui se suivent, points positifs). */
  @IsOptional()
  @IsObject()
  scoringScale?: Record<string, number>;

  @IsOptional()
  @IsInt()
  mainQuota?: number;

  @IsOptional()
  @IsInt()
  sideQuota?: number;
}

export class UpdateSeasonBody {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  startDate?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  endDate?: string;

  @IsOptional()
  @IsObject()
  scoringScale?: Record<string, number>;

  @IsOptional()
  @IsInt()
  mainQuota?: number;

  @IsOptional()
  @IsInt()
  sideQuota?: number;
}

const FORMAT_KINDS = ['existing', 'new'] as const;

export class EventFormatBody {
  @IsIn(FORMAT_KINDS)
  kind!: (typeof FORMAT_KINDS)[number];

  @ValidateIf((body: EventFormatBody) => body.kind === 'existing')
  @IsUUID()
  formatId?: string;

  @ValidateIf((body: EventFormatBody) => body.kind === 'new')
  @ValidateNested()
  @Type(() => SuggestIdeaBody)
  idea?: SuggestIdeaBody;
}

export class UpdateEventBody {
  @IsOptional()
  @IsNumber()
  coefficient?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  rules?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  announceDate?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  registrationEnd?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  endDate?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  liveDate?: string | null;

  @IsOptional()
  @IsUUID()
  hostId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  challongeUrl?: string | null;
}

export class CreateEventBody {
  @IsUUID()
  seasonId!: string;

  @IsIn(['main', 'side'])
  type!: 'main' | 'side';

  @ValidateNested()
  @Type(() => EventFormatBody)
  format!: EventFormatBody;

  @IsOptional()
  @IsNumber()
  coefficient?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  rules?: string;

  @IsISO8601({ strict: true })
  announceDate!: string;

  @IsISO8601({ strict: true })
  registrationEnd!: string;

  @IsISO8601({ strict: true })
  endDate!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  liveDate?: string | null;

  @IsOptional()
  @IsUUID()
  hostId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  challongeUrl?: string | null;
}

export class PlayerPlaceBody {
  @IsUUID()
  playerId!: string;

  @ValidateIf((body: PlayerPlaceBody) => body.place !== null)
  @IsInt()
  place!: number | null;
}

export class TeamPlaceBody {
  @IsUUID()
  teamId!: string;

  @ValidateIf((body: TeamPlaceBody) => body.place !== null)
  @IsInt()
  place!: number | null;
}

export class ResultsBody {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerPlaceBody)
  players?: PlayerPlaceBody[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamPlaceBody)
  teams?: TeamPlaceBody[];
}

export class TeamBody {
  @IsString()
  @MaxLength(100)
  name!: string;
}

export class TeamAssignmentBody {
  @ValidateIf((body: TeamAssignmentBody) => body.teamId !== null)
  @IsUUID()
  teamId!: string | null;
}

export class ValidationBody {
  @IsBoolean()
  validated!: boolean;
}

export class ChooseGameBody {
  @IsUUID()
  formatId!: string;
}

export class ChangeFormatBody {
  @ValidateNested()
  @Type(() => EventFormatBody)
  format!: EventFormatBody;
}
