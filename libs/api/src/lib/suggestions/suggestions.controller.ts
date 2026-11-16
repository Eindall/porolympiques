import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseFilters } from '@nestjs/common';
import { type Player, type SuggestionView, SuggestionsService } from '@porolympiques/domain';
import type { RoadmapDto, SuggestionDto } from '@porolympiques/shared';
import { CurrentPlayer } from '../auth/current-player.decorator';
import { SuggestionErrorFilter } from './suggestion-error.filter';
import { ProposeSuggestionBody, StatusBody, SuggestionsQuery, UpdateSuggestionBody, VoteBody } from './suggestions.dto';

export function toSuggestionDto(suggestion: SuggestionView): SuggestionDto {
  return {
    id: suggestion.id,
    title: suggestion.title,
    description: suggestion.description,
    category: suggestion.category,
    status: suggestion.status,
    author: suggestion.author,
    upvotes: suggestion.upvotes,
    downvotes: suggestion.downvotes,
    score: suggestion.score,
    myVote: suggestion.myVote,
    createdAt: suggestion.createdAt.toISOString(),
    updatedAt: suggestion.updatedAt.toISOString(),
    canEdit: suggestion.canEdit,
    canDelete: suggestion.canDelete,
    canVote: suggestion.canVote,
  };
}

/** Suggestions d'amélioration et roadmap. Les droits (auteur, admin) sont vérifiés par le domaine. */
@Controller('suggestions')
@UseFilters(SuggestionErrorFilter)
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  @Get()
  async list(@CurrentPlayer() player: Player, @Query() filters: SuggestionsQuery): Promise<SuggestionDto[]> {
    return (await this.suggestions.list(player, filters)).map(toSuggestionDto);
  }

  @Get('roadmap')
  async roadmap(@CurrentPlayer() player: Player): Promise<RoadmapDto> {
    const { planned, done } = await this.suggestions.roadmap(player);
    return { planned: planned.map(toSuggestionDto), done: done.map(toSuggestionDto) };
  }

  @Get(':id')
  async get(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<SuggestionDto> {
    return toSuggestionDto(await this.suggestions.get(player, id));
  }

  @Post()
  async propose(@CurrentPlayer() player: Player, @Body() body: ProposeSuggestionBody): Promise<SuggestionDto> {
    return toSuggestionDto(await this.suggestions.propose(player, body));
  }

  @Patch(':id')
  async update(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateSuggestionBody,
  ): Promise<SuggestionDto> {
    return toSuggestionDto(await this.suggestions.update(player, id, body));
  }

  @Put(':id/vote')
  async vote(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: VoteBody): Promise<SuggestionDto> {
    return toSuggestionDto(await this.suggestions.vote(player, id, body.value));
  }

  @Delete(':id/vote')
  async unvote(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<SuggestionDto> {
    return toSuggestionDto(await this.suggestions.vote(player, id, null));
  }

  /** Admin : ajouter à la roadmap, en retirer, marquer livrée. */
  @Put(':id/status')
  async setStatus(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: StatusBody,
  ): Promise<SuggestionDto> {
    return toSuggestionDto(await this.suggestions.setStatus(player, id, body.status));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.suggestions.remove(player, id);
  }
}
