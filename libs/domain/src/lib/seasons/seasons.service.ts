import { EventError } from '../events/event-error';
import type { Player } from '../players/player';
import { cleanName } from '../catalog/normalize';
import { scoringScaleErrors } from '../standings/scoring';
import {
  DEFAULT_MAIN_QUOTA,
  DEFAULT_SCORING_SCALE,
  DEFAULT_SIDE_QUOTA,
  type ScoringScale,
  type Season,
  type SeasonChanges,
} from './season';
import type { SeasonRepository } from './season.repository';

export type Actor = Pick<Player, 'id' | 'role'>;

export interface SeasonInput {
  name: string;
  startDate: Date;
  endDate: Date;
  /** Barème des specs par défaut. */
  scoringScale?: ScoringScale;
  mainQuota?: number;
  sideQuota?: number;
}

export type SeasonUpdate = Partial<SeasonInput>;

export function assertAdmin(actor: Actor): void {
  if (actor.role !== 'admin') throw new EventError('forbidden', 'Réservé à l’admin.');
}

/** Ordre d'affichage : les plus récentes d'abord. */
export function compareSeasons(a: Season, b: Season): number {
  return b.startDate.getTime() - a.startDate.getTime();
}

/** Les saisons : l'admin les crée, les démarre puis les termine. Une seule est active à la fois. */
export class SeasonsService {
  constructor(private readonly seasons: SeasonRepository) {}

  async list(): Promise<Season[]> {
    return (await this.seasons.list()).sort(compareSeasons);
  }

  async create(actor: Actor, input: SeasonInput): Promise<Season> {
    assertAdmin(actor);
    const season = {
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      scoringScale: input.scoringScale ?? DEFAULT_SCORING_SCALE,
      mainQuota: input.mainQuota ?? DEFAULT_MAIN_QUOTA,
      sideQuota: input.sideQuota ?? DEFAULT_SIDE_QUOTA,
    };
    return this.seasons.create({ ...season, ...checked(season) });
  }

  /** Le barème et les quotas restent modifiables : le classement se recalcule à partir des places. */
  async update(actor: Actor, id: string, update: SeasonUpdate): Promise<Season> {
    assertAdmin(actor);
    const season = await this.find(id);
    const changes: SeasonChanges = Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined));
    return this.seasons.update(id, checked({ ...season, ...changes }, changes));
  }

  async start(actor: Actor, id: string): Promise<Season> {
    assertAdmin(actor);
    const season = await this.find(id);
    if (season.status !== 'upcoming') throw new EventError('conflict', 'Seule une saison à venir peut démarrer.');
    const active = await this.seasons.findActive();
    if (active) throw new EventError('conflict', `La saison « ${active.name} » est encore en cours : termine-la d’abord.`);
    return this.seasons.update(id, { status: 'active' });
  }

  async finish(actor: Actor, id: string): Promise<Season> {
    assertAdmin(actor);
    const season = await this.find(id);
    if (season.status !== 'active') throw new EventError('conflict', 'Seule la saison en cours peut se terminer.');
    return this.seasons.update(id, { status: 'finished' });
  }

  private async find(id: string): Promise<Season> {
    const season = await this.seasons.findById(id);
    if (!season) throw new EventError('not_found', 'Saison introuvable.');
    return season;
  }
}

/** Vérifie la saison complète ; renvoie les changements (ou la saison) avec le nom nettoyé. */
function checked<T extends SeasonChanges>(
  season: Omit<Season, 'id' | 'status'>,
  changes: T = season as unknown as T,
): T {
  const name = cleanName(season.name);
  if (!name) throw new EventError('invalid', 'Le nom de la saison est obligatoire.');
  if (!(season.endDate.getTime() > season.startDate.getTime())) {
    throw new EventError('invalid', 'La saison doit finir après son début.');
  }
  for (const quota of [season.mainQuota, season.sideQuota]) {
    if (!Number.isInteger(quota) || quota < 0 || quota > 20) {
      throw new EventError('invalid', 'Les quotas sont des nombres entiers entre 0 et 20.');
    }
  }
  const errors = scoringScaleErrors(season.scoringScale);
  if (errors.length > 0) throw new EventError('invalid', `Barème invalide : ${errors.join(', ')}.`);
  return changes.name === undefined ? changes : { ...changes, name };
}
