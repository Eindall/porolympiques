import type { PlayMode, TeamMode } from '../catalog/catalog';
import type { EventStatus, EventType } from '../events/event';
import { DEFAULT_MAIN_QUOTA, DEFAULT_SCORING_SCALE, DEFAULT_SIDE_QUOTA, type ScoringScale } from '../seasons/season';

/**
 * Saison fictive : données de test du classement, partagées par les tests unitaires, le test d'intégration de
 * la route et le script `npm run db:seed`. Rien à voir avec une vraie saison.
 *
 * Chaque cas des specs y apparaît : ex æquo, non classé, event par équipe, side non validé, side à 3 classés,
 * events en cours ou annulés (ignorés), et les trois étages du départage.
 */

export interface FictionalPlayer {
  key: string;
  pseudo: string;
}

export interface FictionalTeam {
  name: string;
  members: string[];
  place: number | null;
}

export interface FictionalEvent {
  key: string;
  game: string;
  format: string;
  teamMode: TeamMode;
  playMode: PlayMode;
  type: EventType;
  status: EventStatus;
  validated: boolean;
  /** Date de fin, ISO 8601 en UTC. */
  endDate: string;
  /** Places individuelles, par clé de joueur (`null` : inscrit mais non classé). */
  places?: Record<string, number | null>;
  /** Event par équipe : chaque membre prend la place de son équipe. */
  teams?: FictionalTeam[];
}

export interface FictionalStanding {
  rank: number;
  player: string;
  score: number;
  wins: number;
}

export interface FictionalSeason {
  name: string;
  startDate: string;
  endDate: string;
  scoringScale: ScoringScale;
  mainQuota: number;
  sideQuota: number;
  players: FictionalPlayer[];
  events: FictionalEvent[];
  expected: FictionalStanding[];
}

const solo = { teamMode: 'solo', playMode: 'async' } as const;

export const FICTIONAL_SEASON: FictionalSeason = {
  name: 'Saison fictive',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-07-01T00:00:00.000Z',
  scoringScale: DEFAULT_SCORING_SCALE,
  mainQuota: DEFAULT_MAIN_QUOTA,
  sideQuota: DEFAULT_SIDE_QUOTA,

  players: [
    { key: 'alice', pseudo: 'Alice' },
    { key: 'bruno', pseudo: 'Bruno' },
    { key: 'chloe', pseudo: 'Chloé' },
    { key: 'david', pseudo: 'David' },
    { key: 'emma', pseudo: 'Emma' },
    { key: 'farid', pseudo: 'Farid' },
    { key: 'gaspard', pseudo: 'Gaspard' },
    { key: 'hugo', pseudo: 'Hugo' },
    { key: 'ines', pseudo: 'Inès' },
  ],

  events: [
    {
      // Ex æquo à la 3e place (demi-finalistes sans petite finale), un non classé.
      key: 'm1', game: 'Trackmania', format: 'Contre-la-montre', ...solo, type: 'main', status: 'finished',
      validated: false, endDate: '2026-01-31T20:00:00.000Z',
      places: { alice: 1, bruno: 2, chloe: 3, david: 3, emma: 5, farid: 6, gaspard: null },
    },
    {
      key: 'm2', game: 'Tetris 99', format: 'Meilleur score', ...solo, type: 'main', status: 'finished',
      validated: false, endDate: '2026-02-28T20:00:00.000Z',
      places: { bruno: 1, alice: 2, chloe: 3, david: 3, farid: 5, emma: 6, ines: null },
    },
    {
      // Event par équipe.
      key: 'm3', game: 'Overcooked 2', format: 'Relais en cuisine', teamMode: 'team', playMode: 'live', type: 'main',
      status: 'finished', validated: false, endDate: '2026-03-31T20:00:00.000Z',
      teams: [
        { name: 'Les Toqués', members: ['chloe', 'david'], place: 1 },
        { name: 'Les Flambés', members: ['emma', 'farid'], place: 2 },
        { name: 'Les Cramés', members: ['alice', 'bruno'], place: 3 },
      ],
    },
    {
      key: 'm4', game: 'Celeste', format: 'Speedrun any%', ...solo, type: 'main', status: 'finished',
      validated: false, endDate: '2026-04-30T20:00:00.000Z',
      places: { gaspard: 1, hugo: 2, alice: 3, bruno: 4, emma: null, farid: null },
    },
    {
      // En cours : ignoré, même avec des places saisies.
      key: 'm5', game: 'Mario Kart 8', format: 'Grand Prix 150cc', ...solo, type: 'main', status: 'in_progress',
      validated: false, endDate: '2026-05-31T20:00:00.000Z',
      places: { farid: 1, emma: 2 },
    },
    {
      // Annulé : ignoré.
      key: 'm6', game: 'GeoGuessr', format: 'Duels', ...solo, type: 'main', status: 'cancelled',
      validated: false, endDate: '2026-06-30T20:00:00.000Z',
      places: { emma: 1, farid: 2 },
    },
    {
      // Side validé, 4 classés : compte.
      key: 's1', game: 'Wikipédia', format: 'Speedrun de liens', ...solo, type: 'side', status: 'finished',
      validated: true, endDate: '2026-02-14T20:00:00.000Z',
      places: { chloe: 1, alice: 2, david: 3, hugo: 4, gaspard: null },
    },
    {
      // Side non validé : ignoré (il casserait l'égalité entre Emma et Farid).
      key: 's2', game: 'Worms Armageddon', format: 'Deathmatch', teamMode: 'solo', playMode: 'live', type: 'side',
      status: 'finished', validated: false, endDate: '2026-03-14T20:00:00.000Z',
      places: { farid: 1, emma: 2, gaspard: 3, hugo: 4 },
    },
    {
      // Side validé mais seulement 3 classés : ignoré (il casserait l'égalité entre Chloé et David).
      key: 's3', game: 'Puissance 4', format: 'Tournoi éclair', teamMode: 'solo', playMode: 'live', type: 'side',
      status: 'finished', validated: true, endDate: '2026-04-11T20:00:00.000Z',
      places: { david: 1, chloe: 2, bruno: 3, alice: null },
    },
    {
      // Side validé, 5 classés, ex æquo à la 3e place.
      key: 's4', game: 'Fall Guys', format: 'Course à la couronne', teamMode: 'solo', playMode: 'live', type: 'side',
      status: 'finished', validated: true, endDate: '2026-05-16T20:00:00.000Z',
      places: { hugo: 1, bruno: 2, emma: 3, farid: 3, david: 5 },
    },
  ],

  /**
   * Classement attendu, calculé à la main (barème 24-18-14-12-10-8-6-4-2, sides à moitié, quotas 3 et 2) :
   *
   * - Alice   : mains 24 + 18 + 14 (M1, M2, M3), écarté 14 (M4) ; side 9 (S1)          → 65, 1 victoire
   * - Bruno   : mains 24 + 18 + 14 (M2, M1, M3), écarté 12 (M4) ; side 9 (S4)          → 65, 1 victoire
   *   Égalité au score : Alice passe devant grâce à son meilleur résultat écarté (14 contre 12).
   * - Chloé   : mains 24 + 14 + 14 (M3, M1, M2) ; side 12 (S1)                         → 64, 2 victoires
   * - David   : mains 24 + 14 + 14 (M3, M1, M2) ; sides 7 + 5 (S1, S4)                 → 64, 1 victoire
   *   Égalité au score, aucun résultat écarté : Chloé passe devant au nombre de victoires.
   * - Emma    : mains 18 + 10 + 8 (M3, M1, M2), non classée en M4 ; side 7 (S4)        → 43, 0 victoire
   * - Farid   : mains 18 + 10 + 8 (M3, M2, M1), non classé en M4 ; side 7 (S4)         → 43, 0 victoire
   *   Égalité parfaite : 5e place partagée.
   * - Hugo    : main 18 (M4) ; sides 12 + 6 (S4, S1)                                   → 36
   * - Gaspard : main 24 (M4), non classé en M1 et S1                                   → 24
   * - Inès    : seulement non classée (M2)                                             → 0
   */
  expected: [
    { rank: 1, player: 'alice', score: 65, wins: 1 },
    { rank: 2, player: 'bruno', score: 65, wins: 1 },
    { rank: 3, player: 'chloe', score: 64, wins: 2 },
    { rank: 4, player: 'david', score: 64, wins: 1 },
    { rank: 5, player: 'emma', score: 43, wins: 0 },
    { rank: 5, player: 'farid', score: 43, wins: 0 },
    { rank: 7, player: 'hugo', score: 36, wins: 1 },
    { rank: 8, player: 'gaspard', score: 24, wins: 1 },
    { rank: 9, player: 'ines', score: 0, wins: 0 },
  ],
};

/** Coefficient de la saison fictive : celui par défaut du type d'event. */
export const fictionalCoefficient = (event: FictionalEvent) => (event.type === 'main' ? 1 : 0.5);

/** Les places de la saison fictive à plat, une par joueur et par event (les membres d'une équipe prennent sa place). */
export function fictionalPlaces(): { event: string; player: string; place: number | null }[] {
  return FICTIONAL_SEASON.events.flatMap((event) => [
    ...Object.entries(event.places ?? {}).map(([player, place]) => ({ event: event.key, player, place })),
    ...(event.teams ?? []).flatMap((team) =>
      team.members.map((player) => ({ event: event.key, player, place: team.place })),
    ),
  ]);
}
