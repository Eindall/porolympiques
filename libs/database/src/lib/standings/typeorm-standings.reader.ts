import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { SeasonResults, StandingsReader } from '@porolympiques/domain';
import { In, Repository } from 'typeorm';
import { EventEntity } from '../events/event.entity';
import { ResultEntity } from '../events/result.entity';
import { PlayerEntity } from '../players/player.entity';

/**
 * Lit tous les events d'une saison, leurs résultats et les joueurs concernés, sans rien filtrer :
 * le choix de ce qui compte (events terminés, sides retenus) est une règle du domaine.
 */
@Injectable()
export class TypeOrmStandingsReader implements StandingsReader {
  constructor(
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(ResultEntity) private readonly results: Repository<ResultEntity>,
    @InjectRepository(PlayerEntity) private readonly players: Repository<PlayerEntity>,
  ) {}

  async loadSeasonResults(seasonId: string): Promise<SeasonResults> {
    const events = await this.events.find({ where: { seasonId }, relations: { format: { game: true } } });
    if (events.length === 0) return { events: [], results: [], players: [] };

    const results = await this.results.findBy({ eventId: In(events.map((event) => event.id)) });
    const playerIds = [...new Set(results.map((result) => result.playerId))];
    const players = playerIds.length > 0 ? await this.players.findBy({ id: In(playerIds) }) : [];

    return {
      events: events.map((event) => ({
        id: event.id,
        label: `${event.format?.game?.name} — ${event.format?.name}`,
        type: event.type,
        coefficient: event.coefficient,
        status: event.status,
        validated: event.validated,
        endDate: event.endDate,
      })),
      results: results.map(({ eventId, playerId, place }) => ({ eventId, playerId, place })),
      players: players.map(({ id, pseudo, avatarUrl, active }) => ({ id, pseudo, avatarUrl, active })),
    };
  }
}
