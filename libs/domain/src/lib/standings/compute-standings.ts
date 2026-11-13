import { MIN_RANKED_PLAYERS_FOR_SIDE } from '../events/event';
import { assertScoringScale, pointsInHundredths } from './scoring';
import type {
  ScoredResult,
  ScoredResultStatus,
  StandingsEntry,
  StandingsEvent,
  StandingsInput,
  StandingsPlayer,
} from './standings';

/** Un résultat en cours de calcul : points en centièmes, pour additionner et comparer sans arrondi. */
interface Scoring {
  event: StandingsEvent;
  place: number | null;
  hundredths: number;
  status: ScoredResultStatus;
}

interface Tally {
  player: StandingsPlayer;
  score: number;
  /** Points des résultats écartés, du meilleur au moins bon. */
  discarded: number[];
  wins: number;
  scorings: Scoring[];
}

/**
 * Classement d'une saison, calculé à partir des places (rien n'est stocké) :
 *
 * - seuls les events terminés comptent ;
 * - un side ne compte que s'il est validé et réunit au moins 4 joueurs classés, sinon il est ignoré entièrement ;
 * - points d'un résultat : `barème[place] × coefficient`, zéro si non classé ;
 * - score : les `mainQuota` meilleurs mains et les `sideQuota` meilleurs sides ;
 * - départage : les résultats écartés, du meilleur au moins bon, puis le nombre de victoires (mains et sides
 *   comptés). Au-delà, la place est partagée ;
 * - apparaît au classement tout joueur avec un résultat dans un event terminé, même à zéro point.
 */
export function computeStandings({ season, events, results, players }: StandingsInput): StandingsEntry[] {
  assertScoringScale(season.scoringScale);

  const finished = new Map(events.filter((event) => event.status === 'finished').map((event) => [event.id, event]));
  const playersById = new Map(players.map((player) => [player.id, player]));

  const rankedCount = new Map<string, number>();
  for (const result of results) {
    if (finished.has(result.eventId) && result.place !== null) {
      rankedCount.set(result.eventId, (rankedCount.get(result.eventId) ?? 0) + 1);
    }
  }
  const counts = (event: StandingsEvent) =>
    event.type === 'main' || (event.validated && (rankedCount.get(event.id) ?? 0) >= MIN_RANKED_PLAYERS_FOR_SIDE);

  const byPlayer = new Map<string, Scoring[]>();
  for (const result of results) {
    const event = finished.get(result.eventId);
    if (!event) continue;
    if (!playersById.has(result.playerId)) {
      throw new Error(`Résultat d'un joueur inconnu : ${result.playerId}`);
    }
    const scorings = byPlayer.get(result.playerId) ?? [];
    byPlayer.set(result.playerId, scorings);
    if (!counts(event)) continue;
    scorings.push({
      event,
      place: result.place,
      hundredths: pointsInHundredths(season.scoringScale, result.place, event.coefficient),
      status: result.place === null ? 'unranked' : 'discarded',
    });
  }

  const tallies = [...byPlayer].map(([playerId, scorings]) =>
    tally(playersById.get(playerId) as StandingsPlayer, scorings, season.mainQuota, season.sideQuota),
  );

  tallies.sort((a, b) => compareTallies(a, b) || byPseudo(a, b));

  return tallies.map((current, index) => ({
    rank: rankAt(tallies, index),
    player: current.player,
    score: current.score / 100,
    wins: current.wins,
    results: current.scorings.sort(chronologically).map(toScoredResult),
  }));
}

function tally(player: StandingsPlayer, scorings: Scoring[], mainQuota: number, sideQuota: number): Tally {
  const ranked = scorings.filter((scoring) => scoring.place !== null).sort(bestFirst);
  for (const [type, quota] of [['main', mainQuota], ['side', sideQuota]] as const) {
    ranked
      .filter((scoring) => scoring.event.type === type)
      .slice(0, quota)
      .forEach((scoring) => (scoring.status = 'counted'));
  }
  const counted = ranked.filter((scoring) => scoring.status === 'counted');
  return {
    player,
    score: counted.reduce((sum, scoring) => sum + scoring.hundredths, 0),
    discarded: ranked.filter((scoring) => scoring.status === 'discarded').map((scoring) => scoring.hundredths),
    wins: ranked.filter((scoring) => scoring.place === 1).length,
    scorings,
  };
}

/** Meilleur résultat d'abord ; à points égaux, le plus ancien (pour un choix stable des résultats comptés). */
function bestFirst(a: Scoring, b: Scoring): number {
  return b.hundredths - a.hundredths || chronologically(a, b);
}

function chronologically(a: Scoring, b: Scoring): number {
  return a.event.endDate.getTime() - b.event.endDate.getTime() || a.event.label.localeCompare(b.event.label, 'fr');
}

/** Négatif si `a` est devant `b`, zéro en cas d'égalité parfaite. */
function compareTallies(a: Tally, b: Tally): number {
  if (a.score !== b.score) return b.score - a.score;
  // Résultats écartés, du meilleur au moins bon. Un résultat manquant vaut zéro.
  for (let i = 0; i < Math.max(a.discarded.length, b.discarded.length); i++) {
    const difference = (b.discarded[i] ?? 0) - (a.discarded[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return b.wins - a.wins;
}

function byPseudo(a: Tally, b: Tally): number {
  return a.player.pseudo.localeCompare(b.player.pseudo, 'fr', { sensitivity: 'base' }) || a.player.id.localeCompare(b.player.id);
}

/** Rang « olympique » : les ex æquo partagent le rang, le suivant saute d'autant (1, 2, 2, 4). */
function rankAt(sorted: Tally[], index: number): number {
  let first = index;
  while (first > 0 && compareTallies(sorted[first - 1], sorted[index]) === 0) first--;
  return first + 1;
}

function toScoredResult(scoring: Scoring): ScoredResult {
  return {
    eventId: scoring.event.id,
    label: scoring.event.label,
    type: scoring.event.type,
    endDate: scoring.event.endDate,
    place: scoring.place,
    points: scoring.hundredths / 100,
    status: scoring.status,
  };
}
