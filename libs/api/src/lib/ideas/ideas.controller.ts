import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CatalogService,
  type Game,
  type GameChoice,
  type IdeaView,
  IdeasService,
  MAX_COVER_BYTES,
  type Player,
  canEditGame,
} from '@porolympiques/domain';
import type { GameDto, GameSearchDto, IdeaDto } from '@porolympiques/shared';
import { CurrentPlayer } from '../auth/current-player.decorator';
import { IdeaErrorFilter } from './idea-error.filter';
import { CatalogSearchQuery, type GameChoiceBody, IdeasQuery, SuggestIdeaBody, UpdateIdeaBody } from './ideas.dto';

/**
 * Adresse de l'image d'un jeu : celle envoyée par un joueur (servie par l'API, avec le nom du fichier en
 * paramètre pour que le navigateur la recharge quand elle change), sinon la jaquette du catalogue.
 */
export function coverUrlOf(game: Pick<Game, 'id' | 'coverUrl' | 'coverFile'>): string | null {
  return game.coverFile ? `/api/games/${game.id}/cover?v=${game.coverFile.slice(0, 8)}` : game.coverUrl;
}

function toGameDto(game: Game, viewer: Pick<Player, 'id' | 'role'>): GameDto {
  return {
    id: game.id,
    source: game.source,
    name: game.name,
    coverUrl: coverUrlOf(game),
    priceTier: game.priceTier,
    canEdit: canEditGame(viewer, game),
  };
}

export function toIdeaDto(idea: IdeaView): IdeaDto {
  return {
    id: idea.id,
    game: {
      id: idea.game.id,
      source: idea.game.source,
      name: idea.game.name,
      coverUrl: coverUrlOf(idea.game),
      priceTier: idea.game.priceTier,
      canEdit: idea.canEditGame,
    },
    name: idea.name,
    description: idea.description,
    teamMode: idea.teamMode,
    playMode: idea.playMode,
    status: idea.status,
    suggestedBy: idea.suggestedBy,
    votes: idea.votes,
    votedByMe: idea.votedByMe,
    playedCount: idea.playedCount,
    createdAt: idea.createdAt.toISOString(),
    canEdit: idea.canEdit,
  };
}

function toGameChoice(body: GameChoiceBody): GameChoice {
  switch (body.kind) {
    case 'existing':
      return { kind: 'existing', gameId: body.gameId as string };
    case 'catalog':
      return { kind: 'catalog', externalId: body.externalId as string };
    case 'custom':
      return { kind: 'custom', name: body.name as string };
  }
}

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Autocomplete des jeux. */
  @Get('games')
  async search(@Query() { q }: CatalogSearchQuery): Promise<GameSearchDto> {
    const { results, catalogAvailable } = await this.catalog.search(q ?? '');
    return {
      catalogAvailable,
      results: results.map(({ coverFile, ...result }) => ({
        ...result,
        coverUrl: result.gameId ? coverUrlOf({ id: result.gameId, coverUrl: result.coverUrl, coverFile }) : result.coverUrl,
      })),
    };
  }
}

@Controller('ideas')
@UseFilters(IdeaErrorFilter)
export class IdeasController {
  constructor(private readonly ideas: IdeasService) {}

  @Get()
  async list(@CurrentPlayer() player: Player, @Query() filters: IdeasQuery): Promise<IdeaDto[]> {
    return (await this.ideas.list(player, filters)).map(toIdeaDto);
  }

  @Post()
  async suggest(@CurrentPlayer() player: Player, @Body() body: SuggestIdeaBody): Promise<IdeaDto> {
    const idea = await this.ideas.suggest(player, {
      game: toGameChoice(body.game),
      priceTier: body.priceTier ?? null,
      name: body.name,
      description: body.description ?? '',
      teamMode: body.teamMode,
      playMode: body.playMode,
    });
    return toIdeaDto(idea);
  }

  @Put(':id/vote')
  async vote(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<IdeaDto> {
    return toIdeaDto(await this.ideas.vote(player, id));
  }

  @Delete(':id/vote')
  async unvote(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<IdeaDto> {
    return toIdeaDto(await this.ideas.unvote(player, id));
  }

  /** Modification par l'auteur ou l'admin (le domaine vérifie les droits). */
  @Patch(':id')
  async update(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateIdeaBody,
  ): Promise<IdeaDto> {
    return toIdeaDto(await this.ideas.update(player, id, body));
  }

  /** Suppression par l'admin (le domaine refuse les autres). */
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.ideas.remove(player, id);
  }
}

/** Images des jeux saisis librement. */
@Controller('games')
@UseFilters(IdeaErrorFilter)
export class GamesController {
  constructor(private readonly ideas: IdeasService) {}

  /** Envoi (champ `file`, multipart). Le fichier reste en mémoire : la limite coupe tout envoi de plus de 2 Mo. */
  @Put(':id/cover')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_COVER_BYTES, files: 1, fields: 0 } }))
  async setCover(
    @CurrentPlayer() player: Player,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<GameDto> {
    const bytes = file ? new Uint8Array(file.buffer.buffer, file.buffer.byteOffset, file.buffer.byteLength) : undefined;
    return toGameDto(await this.ideas.setCover(player, id, bytes), player);
  }

  @Delete(':id/cover')
  async removeCover(@CurrentPlayer() player: Player, @Param('id', new ParseUUIDPipe()) id: string): Promise<GameDto> {
    return toGameDto(await this.ideas.removeCover(player, id), player);
  }

  /** L'image, avec son vrai type. Son adresse change avec le fichier : elle peut rester longtemps en cache. */
  @Get(':id/cover')
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  @Header('Content-Disposition', 'inline')
  async cover(@Param('id', new ParseUUIDPipe()) id: string): Promise<StreamableFile> {
    const cover = await this.ideas.readCover(id);
    if (!cover) throw new NotFoundException();
    return new StreamableFile(cover.bytes, { type: cover.contentType, length: cover.bytes.length });
  }
}
