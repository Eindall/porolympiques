import { FICTIONAL_SEASON, fictionalCoefficient, fictionalPlaces, type SeasonStatus } from '@porolympiques/domain';
import { type DataSource, type EntityManager, In } from 'typeorm';
import { FormatEntity } from '../catalog/format.entity';
import { GameEntity } from '../catalog/game.entity';
import { EventEntity } from '../events/event.entity';
import { RegistrationEntity } from '../events/registration.entity';
import { ResultEntity } from '../events/result.entity';
import { TeamEntity } from '../events/team.entity';
import { PlayerEntity } from '../players/player.entity';
import { SeasonEntity } from '../seasons/season.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Identifiants Discord des joueurs fictifs : 18 chiffres commençant par 9999, hors de portée des vrais
 * identifiants actuels. La synchro du bot les désactive (ils ne sont pas sur le serveur) : ils restent affichés.
 */
export const fictionalDiscordId = (index: number) => `99990000000000${String(index + 1).padStart(4, '0')}`;

export interface SeededFictionalSeason {
  seasonId: string;
  status: SeasonStatus;
  /** Identifiant de chaque joueur fictif, par clé (`alice`, `bruno`…). */
  playerIds: Record<string, string>;
}

/**
 * Charge la saison fictive (`FICTIONAL_SEASON`) en base, après avoir supprimé une éventuelle version précédente.
 * Elle devient la saison active, sauf si une autre l'est déjà : elle est alors marquée terminée.
 * Pour la base de dev et les tests uniquement.
 */
export async function seedFictionalSeason(dataSource: DataSource): Promise<SeededFictionalSeason> {
  return dataSource.transaction(async (manager) => {
    await removeFictionalSeason(manager);

    const players = await manager.save(
      PlayerEntity,
      FICTIONAL_SEASON.players.map((player, index) =>
        manager.create(PlayerEntity, {
          discordId: fictionalDiscordId(index),
          pseudo: player.pseudo,
          avatarUrl: `https://cdn.discordapp.com/embed/avatars/${index % 6}.png`,
          role: 'player',
          active: true,
        }),
      ),
    );
    const playerIds = Object.fromEntries(FICTIONAL_SEASON.players.map((player, index) => [player.key, players[index].id]));

    const status: SeasonStatus = (await manager.existsBy(SeasonEntity, { status: 'active' })) ? 'finished' : 'active';
    const season = await manager.save(
      manager.create(SeasonEntity, {
        name: FICTIONAL_SEASON.name,
        startDate: new Date(FICTIONAL_SEASON.startDate),
        endDate: new Date(FICTIONAL_SEASON.endDate),
        scoringScale: FICTIONAL_SEASON.scoringScale,
        mainQuota: FICTIONAL_SEASON.mainQuota,
        sideQuota: FICTIONAL_SEASON.sideQuota,
        status,
      }),
    );

    const eventIds: Record<string, string> = {};
    const teamIds = new Map<string, string>();
    for (const fixture of FICTIONAL_SEASON.events) {
      const game = await manager.save(manager.create(GameEntity, { source: 'custom', name: fixture.game, priceTier: 'free' }));
      const format = await manager.save(
        manager.create(FormatEntity, {
          gameId: game.id,
          name: fixture.format,
          teamMode: fixture.teamMode,
          playMode: fixture.playMode,
          suggestedById: playerIds[FICTIONAL_SEASON.players[0].key],
        }),
      );
      const endDate = new Date(fixture.endDate);
      const event = await manager.save(
        manager.create(EventEntity, {
          seasonId: season.id,
          formatId: format.id,
          type: fixture.type,
          coefficient: fictionalCoefficient(fixture),
          status: fixture.status,
          announceDate: new Date(endDate.getTime() - 30 * DAY_MS),
          registrationEnd: new Date(endDate.getTime() - 21 * DAY_MS),
          endDate,
          validated: fixture.validated,
        }),
      );
      eventIds[fixture.key] = event.id;
      for (const team of fixture.teams ?? []) {
        const saved = await manager.save(manager.create(TeamEntity, { eventId: event.id, name: team.name }));
        for (const member of team.members) teamIds.set(`${fixture.key}/${member}`, saved.id);
      }
    }

    const places = fictionalPlaces();
    await manager.save(
      RegistrationEntity,
      places.map(({ event, player }) =>
        manager.create(RegistrationEntity, {
          eventId: eventIds[event],
          playerId: playerIds[player],
          teamId: teamIds.get(`${event}/${player}`) ?? null,
        }),
      ),
    );
    await manager.save(
      ResultEntity,
      places.map(({ event, player, place }) =>
        manager.create(ResultEntity, { eventId: eventIds[event], playerId: playerIds[player], place }),
      ),
    );

    return { seasonId: season.id, status, playerIds };
  });
}

/** Supprime la saison fictive, ses events (et en cascade leurs équipes, inscriptions et résultats), ses jeux et ses joueurs. */
async function removeFictionalSeason(manager: EntityManager): Promise<void> {
  const seasons = await manager.findBy(SeasonEntity, { name: FICTIONAL_SEASON.name });
  if (seasons.length > 0) {
    await manager.delete(EventEntity, { seasonId: In(seasons.map((season) => season.id)) });
    await manager.delete(SeasonEntity, { id: In(seasons.map((season) => season.id)) });
  }
  const players = await manager.findBy(PlayerEntity, {
    discordId: In(FICTIONAL_SEASON.players.map((_player, index) => fictionalDiscordId(index))),
  });
  if (players.length > 0) {
    const formats = await manager.findBy(FormatEntity, { suggestedById: In(players.map((player) => player.id)) });
    if (formats.length > 0) {
      await manager.delete(FormatEntity, { id: In(formats.map((format) => format.id)) });
      await manager.delete(GameEntity, { id: In([...new Set(formats.map((format) => format.gameId))]), source: 'custom' });
    }
    await manager.delete(PlayerEntity, { id: In(players.map((player) => player.id)) });
  }
}
