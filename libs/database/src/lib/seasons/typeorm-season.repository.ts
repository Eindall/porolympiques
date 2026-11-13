import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Season, SeasonRepository } from '@porolympiques/domain';
import { Repository } from 'typeorm';
import { isUuid } from '../uuid';
import { SeasonEntity } from './season.entity';

function toSeason(row: SeasonEntity): Season {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    scoringScale: row.scoringScale,
    mainQuota: row.mainQuota,
    sideQuota: row.sideQuota,
    status: row.status,
  };
}

@Injectable()
export class TypeOrmSeasonRepository implements SeasonRepository {
  constructor(@InjectRepository(SeasonEntity) private readonly rows: Repository<SeasonEntity>) {}

  async findById(id: string): Promise<Season | null> {
    if (!isUuid(id)) return null;
    const row = await this.rows.findOneBy({ id });
    return row ? toSeason(row) : null;
  }

  async findActive(): Promise<Season | null> {
    const row = await this.rows.findOneBy({ status: 'active' });
    return row ? toSeason(row) : null;
  }
}
