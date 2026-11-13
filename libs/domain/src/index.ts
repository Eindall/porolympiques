// Règles métier, sans dépendance à Discord, IGDB, NestJS ni TypeORM.
// Les besoins extérieurs passent par des ports (interfaces) implémentés dans les libs `database` et `bot`.
export * from './lib/players/player';
export * from './lib/players/player-rules';
export * from './lib/players/member-sync';
export * from './lib/players/player.repository';
export * from './lib/players/guild-directory';
export * from './lib/players/players.service';
export * from './lib/sessions/session.store';
export * from './lib/seasons/season';
export * from './lib/seasons/season.repository';
export * from './lib/events/event';
export * from './lib/catalog/catalog';
export * from './lib/suggestions/suggestion';
export * from './lib/standings/standings';
export * from './lib/standings/scoring';
export * from './lib/standings/compute-standings';
export * from './lib/standings/standings.reader';
export * from './lib/standings/standings.service';
export * from './lib/standings/fictional-season';
