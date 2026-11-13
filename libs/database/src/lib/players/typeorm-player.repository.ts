import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { NewPlayer, Player, PlayerChanges, PlayerRepository } from '@porolympiques/domain';
import { Repository } from 'typeorm';
import { PlayerEntity } from './player.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toPlayer(row: PlayerEntity): Player {
  return {
    id: row.id,
    discordId: row.discordId,
    pseudo: row.pseudo,
    avatarUrl: row.avatarUrl,
    role: row.role,
    active: row.active,
  };
}

@Injectable()
export class TypeOrmPlayerRepository implements PlayerRepository {
  constructor(@InjectRepository(PlayerEntity) private readonly rows: Repository<PlayerEntity>) {}

  async findById(id: string): Promise<Player | null> {
    if (!UUID.test(id)) return null;
    const row = await this.rows.findOneBy({ id });
    return row ? toPlayer(row) : null;
  }

  async findByDiscordId(discordId: string): Promise<Player | null> {
    const row = await this.rows.findOneBy({ discordId });
    return row ? toPlayer(row) : null;
  }

  async findAll(): Promise<Player[]> {
    return (await this.rows.find({ order: { createdAt: 'ASC' } })).map(toPlayer);
  }

  async create(player: NewPlayer): Promise<Player> {
    return toPlayer(await this.rows.save(this.rows.create(player)));
  }

  async update(id: string, changes: PlayerChanges): Promise<Player> {
    await this.rows.update({ id }, changes);
    return toPlayer(await this.rows.findOneByOrFail({ id }));
  }
}
