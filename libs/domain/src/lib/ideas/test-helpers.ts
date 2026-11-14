import type { GameSource } from '../catalog/catalog';
import type { CachedSearch, CatalogSearchCache } from '../catalog/catalog-search-cache';
import type { CoverStorage } from '../catalog/cover-storage';
import type { CatalogGame, Game, GameChanges, NewGame } from '../catalog/game';
import type { GameCatalog } from '../catalog/game-catalog';
import type { GameRepository } from '../catalog/game.repository';
import { normalizeName } from '../catalog/normalize';
import type { Format, FormatChanges, Idea, IdeaFilters, NewFormat } from './idea';
import type { IdeaRepository } from './idea.repository';

export class InMemoryGames implements GameRepository {
  rows = new Map<string, Game>();
  private next = 1;

  constructor(initial: Game[] = []) {
    for (const game of initial) this.rows.set(game.id, game);
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByExternalId(source: GameSource, externalId: string) {
    return [...this.rows.values()].find((game) => game.source === source && game.externalId === externalId) ?? null;
  }
  async findCustomByName(normalizedName: string) {
    return [...this.rows.values()].find((game) => game.source === 'custom' && normalizeName(game.name) === normalizedName) ?? null;
  }
  async searchByName(query: string, limit: number) {
    return [...this.rows.values()].filter((game) => normalizeName(game.name).includes(query)).slice(0, limit);
  }
  async create(game: NewGame) {
    const created: Game = { ...game, id: `g-new-${this.next++}`, coverFile: null };
    this.rows.set(created.id, created);
    return created;
  }
  async update(id: string, changes: GameChanges) {
    const updated = { ...(this.rows.get(id) as Game), ...changes };
    this.rows.set(id, updated);
    return updated;
  }
}

export class InMemoryIdeas implements IdeaRepository {
  formats = new Map<string, Format>();
  votes = new Set<string>();
  usedByEvents = new Set<string>();
  played = new Map<string, number>();
  private next = 1;

  constructor(
    private readonly games: InMemoryGames,
    private readonly pseudos: Record<string, string> = {},
  ) {}

  async list(viewerId: string, filters: IdeaFilters) {
    return [...this.formats.values()]
      .map((format) => this.toIdea(format, viewerId))
      .filter(
        (idea) =>
          (!filters.gameId || idea.gameId === filters.gameId) &&
          (!filters.priceTier || idea.game.priceTier === filters.priceTier) &&
          (!filters.teamMode || idea.teamMode === filters.teamMode) &&
          (!filters.playMode || idea.playMode === filters.playMode),
      );
  }
  async findIdea(id: string, viewerId: string) {
    const format = this.formats.get(id);
    return format ? this.toIdea(format, viewerId) : null;
  }
  async findFormat(id: string) {
    return this.formats.get(id) ?? null;
  }
  async formatsOfGame(gameId: string) {
    return [...this.formats.values()].filter((format) => format.gameId === gameId);
  }
  async createWithVote(format: NewFormat, voterId: string) {
    const created: Format = { ...format, id: `f-${this.next}`, status: 'proposed', createdAt: new Date(2026, 0, this.next) };
    this.next++;
    this.formats.set(created.id, created);
    this.votes.add(`${voterId}/${created.id}`);
    return created;
  }
  async updateFormat(id: string, changes: FormatChanges) {
    this.formats.set(id, { ...(this.formats.get(id) as Format), ...changes });
  }
  async deleteFormat(id: string) {
    this.formats.delete(id);
    for (const vote of [...this.votes]) if (vote.endsWith(`/${id}`)) this.votes.delete(vote);
  }
  async isUsedByEvent(formatId: string) {
    return this.usedByEvents.has(formatId);
  }
  async addVote(playerId: string, formatId: string) {
    this.votes.add(`${playerId}/${formatId}`);
  }
  async removeVote(playerId: string, formatId: string) {
    this.votes.delete(`${playerId}/${formatId}`);
  }

  private toIdea(format: Format, viewerId: string): Idea {
    const votes = [...this.votes].filter((vote) => vote.endsWith(`/${format.id}`));
    return {
      ...format,
      game: this.games.rows.get(format.gameId) as Game,
      suggestedBy: format.suggestedById
        ? { id: format.suggestedById, pseudo: this.pseudos[format.suggestedById] ?? format.suggestedById }
        : null,
      votes: votes.length,
      votedByMe: votes.includes(`${viewerId}/${format.id}`),
      playedCount: this.played.get(format.id) ?? 0,
    };
  }
}

/** Catalogue simulé : une liste de jeux, et un interrupteur de panne. */
export class FakeCatalog implements GameCatalog {
  down = false;
  searches: string[] = [];

  constructor(public games: CatalogGame[] = []) {}

  async search(query: string) {
    this.searches.push(query);
    if (this.down) throw new Error('catalogue injoignable');
    return this.games.filter((game) => normalizeName(game.name).includes(query));
  }
  async findById(externalId: string) {
    if (this.down) throw new Error('catalogue injoignable');
    return this.games.find((game) => game.externalId === externalId) ?? null;
  }
}

export class InMemorySearchCache implements CatalogSearchCache {
  entries = new Map<string, CachedSearch>();

  async get(query: string) {
    return this.entries.get(query) ?? null;
  }
  async put(query: string, search: CachedSearch) {
    this.entries.set(query, search);
  }
}

/** Stockage d'images en mémoire. */
export class InMemoryCovers implements CoverStorage {
  files = new Map<string, Uint8Array>();
  private next = 1;

  async save(bytes: Uint8Array, extension: string) {
    const name = `cover-${this.next++}.${extension}`;
    this.files.set(name, bytes);
    return name;
  }
  async read(fileName: string) {
    return this.files.get(fileName) ?? null;
  }
  async remove(fileName: string) {
    this.files.delete(fileName);
  }
}

/** Octets d'images minimales, reconnues par leur signature. */
export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
export const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
export const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

export const catalogGame = (externalId: string, name: string, year: number | null = 2020): CatalogGame => ({
  externalId,
  name,
  coverUrl: `https://images.igdb.com/igdb/image/upload/t_cover_big/${externalId}.jpg`,
  year,
});

export const customGame = (id: string, name: string, overrides: Partial<Game> = {}): Game => ({
  id,
  source: 'custom',
  externalId: null,
  name,
  coverUrl: null,
  priceTier: 'free',
  createdById: null,
  coverFile: null,
  ...overrides,
});
