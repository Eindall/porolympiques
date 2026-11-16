import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type Game,
  type GameChanges,
  type GameRepository,
  type GameSource,
  type NewGame,
  normalizeName,
} from '@porolympiques/domain';
import { Repository } from 'typeorm';
import { isUuid } from '../uuid';
import { GameEntity } from './game.entity';

export function toGame(row: GameEntity): Game {
  return {
    id: row.id,
    source: row.source,
    externalId: row.externalId,
    name: row.name,
    coverUrl: row.coverUrl,
    priceTier: row.priceTier,
    createdById: row.createdById,
    coverFile: row.coverFile,
  };
}

/** Échappe les jokers de LIKE (`%`, `_`, `\`) dans une recherche. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

@Injectable()
export class TypeOrmGameRepository implements GameRepository {
  constructor(@InjectRepository(GameEntity) private readonly rows: Repository<GameEntity>) {}

  async findById(id: string): Promise<Game | null> {
    if (!isUuid(id)) return null;
    const row = await this.rows.findOneBy({ id });
    return row ? toGame(row) : null;
  }

  async findByExternalId(source: GameSource, externalId: string): Promise<Game | null> {
    const row = await this.rows.findOneBy({ source, externalId });
    return row ? toGame(row) : null;
  }

  async findCustomByName(normalizedName: string): Promise<Game | null> {
    const row = await this.rows.findOne({ where: { source: 'custom', searchName: normalizedName }, order: { createdAt: 'ASC' } });
    return row ? toGame(row) : null;
  }

  async searchByName(normalizedQuery: string, limit: number): Promise<Game[]> {
    const pattern = escapeLike(normalizedQuery);
    const rows = await this.rows
      .createQueryBuilder('game')
      .where('game.search_name LIKE :contains', { contains: `%${pattern}%` })
      .orderBy('CASE WHEN game.search_name LIKE :prefix THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy('game.search_name', 'ASC')
      .setParameter('prefix', `${pattern}%`)
      .limit(limit)
      .getMany();
    return rows.map(toGame);
  }

  async create(game: NewGame): Promise<Game> {
    return toGame(await this.rows.save(this.rows.create({ ...game, searchName: normalizeName(game.name) })));
  }

  async update(id: string, changes: GameChanges): Promise<Game> {
    await this.rows.update({ id }, { ...changes, ...(changes.name !== undefined && { searchName: normalizeName(changes.name) }) });
    return toGame(await this.rows.findOneByOrFail({ id }));
  }
}
