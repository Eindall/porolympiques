import type { PlayMode, PriceTier, TeamMode } from '../catalog/catalog';
import { COVER_EXTENSIONS, type CoverType, MAX_COVER_BYTES, coverTypeOfFile, detectCoverType } from '../catalog/cover';
import type { CoverStorage } from '../catalog/cover-storage';
import type { Game, GameChanges } from '../catalog/game';
import type { GameCatalog } from '../catalog/game-catalog';
import type { GameRepository } from '../catalog/game.repository';
import { cleanName, normalizeName } from '../catalog/normalize';
import type { Player } from '../players/player';
import type { Format, FormatChanges, Idea, IdeaFilters, IdeaView } from './idea';
import { IdeaError } from './idea-error';
import type { IdeaRepository } from './idea.repository';

/** Le jeu d'une suggestion : déjà enregistré, trouvé dans le catalogue externe, ou saisi librement. */
export type GameChoice =
  | { kind: 'existing'; gameId: string }
  | { kind: 'catalog'; externalId: string }
  | { kind: 'custom'; name: string };

export interface IdeaInput {
  game: GameChoice;
  /** Obligatoire seulement si le jeu n'a pas encore de tranche ; ignorée sinon (la première reste). */
  priceTier: PriceTier | null;
  name: string;
  description: string;
  teamMode: TeamMode;
  playMode: PlayMode;
}

/** Modification d'une idée. `priceTier` (admin seulement) et `gameName` (jeu saisi librement) portent sur le jeu. */
export interface IdeaUpdate extends FormatChanges {
  priceTier?: PriceTier;
  gameName?: string;
}

export interface CoverImage {
  bytes: Uint8Array;
  contentType: CoverType;
}

type Actor = Pick<Player, 'id' | 'role'>;

const isAdmin = (actor: Actor) => actor.role === 'admin';

/** Modifier un format : l'admin toujours, son auteur tant qu'il n'est pas retenu pour un event. */
export function canEditFormat(actor: Actor, format: Pick<Format, 'suggestedById' | 'status'>): boolean {
  return isAdmin(actor) || (format.suggestedById === actor.id && format.status !== 'selected');
}

/** Renommer un jeu saisi librement et changer son image : son créateur et l'admin. Un jeu du catalogue est figé. */
export function canEditGame(actor: Actor, game: Pick<Game, 'source' | 'createdById'>): boolean {
  return game.source === 'custom' && (isAdmin(actor) || game.createdById === actor.id);
}

/** Ordre de la liste : les plus upvotées d'abord, puis les plus anciennes. */
export function compareIdeas(a: Idea, b: Idea): number {
  return b.votes - a.votes || a.createdAt.getTime() - b.createdAt.getTime() || a.name.localeCompare(b.name, 'fr');
}

/**
 * La boîte à idées : on suggère et on upvote un format, pas un jeu. L'auteur vote d'office pour sa suggestion,
 * et peut la modifier tant qu'elle n'est pas retenue. Un format retenu a ses votes gelés. L'admin corrige ou
 * supprime les idées. Un jeu saisi librement peut recevoir une image, envoyée par son créateur ou l'admin.
 */
export class IdeasService {
  constructor(
    private readonly ideas: IdeaRepository,
    private readonly games: GameRepository,
    private readonly catalog: GameCatalog,
    private readonly covers: CoverStorage,
  ) {}

  async list(viewer: Actor, filters: IdeaFilters = {}): Promise<IdeaView[]> {
    return (await this.ideas.list(viewer.id, filters)).sort(compareIdeas).map((idea) => withRights(idea, viewer));
  }

  async suggest(author: Actor, input: IdeaInput): Promise<IdeaView> {
    const name = requireName(input.name, 'Le nom du format est obligatoire.');
    const game = await this.resolveGame(author, input.game, input.priceTier);
    await this.assertNoDuplicate(game.id, name);
    const format = await this.ideas.createWithVote(
      {
        gameId: game.id,
        name,
        description: input.description.trim(),
        teamMode: input.teamMode,
        playMode: input.playMode,
        suggestedById: author.id,
      },
      author.id,
    );
    return this.view(format.id, author);
  }

  async vote(player: Actor, formatId: string): Promise<IdeaView> {
    await this.votableFormat(formatId);
    await this.ideas.addVote(player.id, formatId);
    return this.view(formatId, player);
  }

  async unvote(player: Actor, formatId: string): Promise<IdeaView> {
    await this.votableFormat(formatId);
    await this.ideas.removeVote(player.id, formatId);
    return this.view(formatId, player);
  }

  async update(actor: Actor, formatId: string, update: IdeaUpdate): Promise<IdeaView> {
    const format = await this.ideas.findFormat(formatId);
    if (!format) throw notFound();
    const game = await this.games.findById(format.gameId);
    if (!game) throw notFound();

    const { priceTier, gameName, ...changes } = update;
    if (!canEditFormat(actor, format)) {
      throw new IdeaError(
        'forbidden',
        format.suggestedById === actor.id
          ? 'Ce format est retenu pour un event : seul l’admin peut encore le modifier.'
          : 'Seuls l’auteur et l’admin peuvent modifier cette idée.',
      );
    }
    if (priceTier !== undefined && !isAdmin(actor)) {
      throw new IdeaError('forbidden', 'Seul l’admin peut corriger la tranche de prix.');
    }
    if (gameName !== undefined) {
      if (game.source !== 'custom') throw new IdeaError('invalid', 'Un jeu du catalogue garde son nom.');
      if (!canEditGame(actor, game)) throw new IdeaError('forbidden', 'Seuls l’admin et celui qui a ajouté ce jeu peuvent le renommer.');
    }
    if (changes.name !== undefined) {
      changes.name = requireName(changes.name, 'Le nom du format est obligatoire.');
      await this.assertNoDuplicate(format.gameId, changes.name, format.id);
    }
    if (changes.description !== undefined) changes.description = changes.description.trim();

    if (Object.keys(changes).length > 0) await this.ideas.updateFormat(format.id, changes);
    const gameChanges: GameChanges = {
      ...(priceTier !== undefined && { priceTier }),
      ...(gameName !== undefined && { name: requireName(gameName, 'Le nom du jeu est obligatoire.') }),
    };
    if (Object.keys(gameChanges).length > 0) await this.games.update(game.id, gameChanges);
    return this.view(format.id, actor);
  }

  async remove(actor: Actor, formatId: string): Promise<void> {
    if (!isAdmin(actor)) throw new IdeaError('forbidden', 'Réservé à l’admin.');
    if (!(await this.ideas.findFormat(formatId))) throw notFound();
    if (await this.ideas.isUsedByEvent(formatId)) {
      throw new IdeaError('in_use', 'Ce format est joué dans un event : on le garde pour l’historique.');
    }
    await this.ideas.deleteFormat(formatId);
  }

  /** Image d'un jeu saisi librement : PNG, JPEG ou WebP (vérifié sur le contenu), 2 Mo au plus. Remplace la précédente. */
  async setCover(actor: Actor, gameId: string, bytes: Uint8Array | undefined): Promise<Game> {
    const game = await this.editableGame(actor, gameId);
    if (!bytes || bytes.length === 0) throw new IdeaError('invalid', 'Choisis une image.');
    if (bytes.length > MAX_COVER_BYTES) throw new IdeaError('file_too_large', 'Image trop lourde : 2 Mo au maximum.');
    const type = detectCoverType(bytes);
    if (!type) throw new IdeaError('unsupported_file', 'Image refusée : seuls les PNG, JPEG et WebP sont acceptés.');

    const fileName = await this.covers.save(bytes, COVER_EXTENSIONS[type]);
    const updated = await this.games.update(game.id, { coverFile: fileName });
    if (game.coverFile) await this.covers.remove(game.coverFile);
    return updated;
  }

  async removeCover(actor: Actor, gameId: string): Promise<Game> {
    const game = await this.editableGame(actor, gameId);
    if (!game.coverFile) return game;
    const updated = await this.games.update(game.id, { coverFile: null });
    await this.covers.remove(game.coverFile);
    return updated;
  }

  /** L'image envoyée pour un jeu, ou `null` s'il n'en a pas. */
  async readCover(gameId: string): Promise<CoverImage | null> {
    const game = await this.games.findById(gameId);
    const contentType = game?.coverFile ? coverTypeOfFile(game.coverFile) : null;
    if (!game?.coverFile || !contentType) return null;
    const bytes = await this.covers.read(game.coverFile);
    return bytes ? { bytes, contentType } : null;
  }

  private async editableGame(actor: Actor, gameId: string): Promise<Game> {
    const game = await this.games.findById(gameId);
    if (!game) throw new IdeaError('not_found', 'Jeu introuvable.');
    if (game.source !== 'custom') throw new IdeaError('invalid', 'Un jeu du catalogue garde sa jaquette.');
    if (!canEditGame(actor, game)) {
      throw new IdeaError('forbidden', 'Seuls l’admin et celui qui a ajouté ce jeu peuvent changer son image.');
    }
    return game;
  }

  /** Trouve ou enregistre le jeu, et lui fixe sa tranche de prix s'il n'en a pas encore. */
  private async resolveGame(author: Actor, choice: GameChoice, priceTier: PriceTier | null): Promise<Game> {
    const existing = await this.findGame(choice);
    if (existing) {
      if (existing.priceTier) return existing;
      return this.games.update(existing.id, { priceTier: requirePriceTier(priceTier) });
    }
    if (choice.kind === 'existing') throw notFound();

    if (choice.kind === 'custom') {
      const name = requireName(choice.name, 'Le nom du jeu est obligatoire.');
      return this.games.create({
        source: 'custom',
        externalId: null,
        name,
        coverUrl: null,
        priceTier: requirePriceTier(priceTier),
        createdById: author.id,
      });
    }

    const tier = requirePriceTier(priceTier);
    let found;
    try {
      found = await this.catalog.findById(choice.externalId);
    } catch {
      throw new IdeaError('catalog_unavailable', 'Le catalogue de jeux ne répond pas : réessaie, ou saisis le jeu à la main.');
    }
    if (!found) throw notFound();
    return this.games.create({
      source: 'igdb',
      externalId: found.externalId,
      name: found.name,
      coverUrl: found.coverUrl,
      priceTier: tier,
      createdById: author.id,
    });
  }

  private findGame(choice: GameChoice): Promise<Game | null> {
    switch (choice.kind) {
      case 'existing':
        return this.games.findById(choice.gameId);
      case 'catalog':
        return this.games.findByExternalId('igdb', choice.externalId);
      case 'custom':
        return this.games.findCustomByName(normalizeName(choice.name));
    }
  }

  private async assertNoDuplicate(gameId: string, name: string, exceptFormatId?: string): Promise<void> {
    const wanted = normalizeName(name);
    const formats = await this.ideas.formatsOfGame(gameId);
    if (formats.some((format) => format.id !== exceptFormatId && normalizeName(format.name) === wanted)) {
      throw new IdeaError('duplicate', 'Ce format existe déjà pour ce jeu : upvote-le plutôt !');
    }
  }

  private async votableFormat(formatId: string): Promise<void> {
    const format = await this.ideas.findFormat(formatId);
    if (!format) throw notFound();
    if (format.status === 'selected') {
      throw new IdeaError('votes_frozen', 'Ce format est retenu pour un event : les votes sont gelés jusqu’à sa clôture.');
    }
  }

  private async view(formatId: string, viewer: Actor): Promise<IdeaView> {
    const idea = await this.ideas.findIdea(formatId, viewer.id);
    if (!idea) throw notFound();
    return withRights(idea, viewer);
  }
}

function withRights(idea: Idea, viewer: Actor): IdeaView {
  return { ...idea, canEdit: canEditFormat(viewer, idea), canEditGame: canEditGame(viewer, idea.game) };
}

function notFound(): IdeaError {
  return new IdeaError('not_found', 'Idée introuvable.');
}

function requireName(value: string, message: string): string {
  const name = cleanName(value);
  if (!name) throw new IdeaError('invalid', message);
  return name;
}

function requirePriceTier(priceTier: PriceTier | null): PriceTier {
  if (!priceTier) throw new IdeaError('price_tier_required', 'Choisis la tranche de prix du jeu.');
  return priceTier;
}
