import type { StandingsService } from '../standings/standings.service';
import type { StandingsEntry } from '../standings/standings';
import type { Season } from '../seasons/season';
import type { Event, EventSummary } from './event';
import type { EventRepository } from './event.repository';
import { isOpen } from './events.service';

/** Place d'un event dans la timeline. */
export type TimelineGroup = 'upcoming' | 'ongoing' | 'past';

/** À venir : annonce dans le futur. En cours : annoncé, pas encore terminé. Passé : terminé ou annulé. */
export function timelineOf(event: Pick<Event, 'status' | 'announceDate'>, now: Date): TimelineGroup {
  if (!isOpen(event)) return 'past';
  return event.announceDate.getTime() > now.getTime() ? 'upcoming' : 'ongoing';
}

/** Nombre de joueurs du classement affichés sur l'accueil (plus, en cas d'ex æquo au 5e rang). */
export const HOME_TOP = 5;

export interface Home {
  /** Events annoncés, pas encore terminés, du plus proche de sa fin au plus lointain. */
  ongoing: EventSummary[];
  /** Le prochain event à annoncer. */
  next: EventSummary | null;
  season: Season | null;
  /** Les 5 premiers de la saison en cours (rangs 1 à 5, ex æquo compris). */
  top: StandingsEntry[];
}

/** Page d'accueil : events en cours, prochain event et top 5 du classement. */
export class HomeService {
  constructor(
    private readonly events: Pick<EventRepository, 'listOpen'>,
    private readonly standings: Pick<StandingsService, 'forActiveSeason'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async home(): Promise<Home> {
    const now = this.now();
    const [open, standings] = await Promise.all([this.events.listOpen(), this.standings.forActiveSeason()]);
    const ongoing = open
      .filter((event) => timelineOf(event, now) === 'ongoing')
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    const next = open
      .filter((event) => timelineOf(event, now) === 'upcoming')
      .sort((a, b) => a.announceDate.getTime() - b.announceDate.getTime())[0];
    return {
      ongoing,
      next: next ?? null,
      season: standings?.season ?? null,
      top: standings?.entries.filter((entry) => entry.rank <= HOME_TOP) ?? [],
    };
  }
}
