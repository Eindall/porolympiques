import { type EventSummary, OPEN_EVENT_STATUSES } from '../events/event';
import type { EventRepository } from '../events/event.repository';
import { registrationOpen } from '../events/events.service';
import type { StandingsService } from '../standings/standings.service';
import { type EventAnnouncement, type EventAnnouncer, type EventObserver, type ResultLine, type ResultsAnnouncement, SILENT_MESSAGE_ID } from './event-announcer';

/** Haut du classement de saison affiché dans le message de clôture (ex æquo compris). */
export const RESULTS_STANDINGS_TOP = 10;

type Events = Pick<EventRepository, 'findSummary' | 'listOpen' | 'update' | 'registrations' | 'teams' | 'results'>;

/**
 * Messages d'event dans Discord :
 * - l'annonce est postée quand sa date arrive (tout de suite si elle est déjà passée), puis suit l'event :
 *   inscrits, dates, inscriptions closes, annulation, clôture ;
 * - à la clôture, les places et le haut du classement de saison sont postés, puis modifiés si l'admin corrige.
 *
 * Un event créé avant le bot (`SILENT_MESSAGE_ID`) reste sans message.
 * Les opérations passent une par une (file d'attente), pour ne jamais poster deux fois le même message. Une
 * erreur de Discord n'interrompt pas le site : elle est signalée, et le prochain passage (`tick`) rattrape.
 */
export class AnnouncementsService implements EventObserver {
  private queue: Promise<unknown> = Promise.resolve();
  private lastTick: Date | null = null;

  constructor(
    private readonly events: Events,
    private readonly standings: Pick<StandingsService, 'forSeason'>,
    private readonly announcer: EventAnnouncer,
    private readonly onError: (message: string) => void = () => undefined,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Passage régulier (chaque minute) : annonces arrivées à échéance, et inscriptions closes depuis le dernier passage. */
  tick(): Promise<void> {
    return this.enqueue('passage régulier', async () => {
      if (!this.announcer.isReady()) return;
      const now = this.now();
      const since = this.lastTick;
      for (const event of await this.events.listOpen()) {
        if (event.announceDate.getTime() > now.getTime()) continue;
        const closedSince = since === null || (event.registrationEnd.getTime() > since.getTime() && event.registrationEnd.getTime() <= now.getTime());
        if (!event.announcementMessageId || closedSince) await this.syncAnnouncement(event);
      }
      this.lastTick = now;
    });
  }

  eventChanged(eventId: string): Promise<void> {
    return this.enqueue(`mise à jour de l’event ${eventId}`, async () => {
      if (!this.announcer.isReady()) return;
      const event = await this.events.findSummary(eventId);
      if (!event) return;
      const announced = event.announceDate.getTime() <= this.now().getTime();
      // Un event pas encore annoncé reste secret ; annulé ou terminé sans annonce, il n'est pas annoncé après coup.
      if (event.announcementMessageId || (announced && OPEN_EVENT_STATUSES.includes(event.status))) await this.syncAnnouncement(event);
      if (event.status === 'finished') await this.syncResults(event);
    });
  }

  private async syncAnnouncement(event: EventSummary): Promise<void> {
    if (event.announcementMessageId === SILENT_MESSAGE_ID) return;
    const announcement: EventAnnouncement = { event, registrationOpen: registrationOpen(event, this.now()) };
    if (event.announcementMessageId && (await this.announcer.editAnnouncement(event.announcementMessageId, announcement))) return;
    if (!OPEN_EVENT_STATUSES.includes(event.status)) return;
    const messageId = await this.announcer.postAnnouncement(announcement);
    await this.events.update(event.id, { announcementMessageId: messageId });
  }

  private async syncResults(event: EventSummary): Promise<void> {
    if (event.resultsMessageId === SILENT_MESSAGE_ID) return;
    const results = await this.resultsOf(event);
    if (event.resultsMessageId && (await this.announcer.editResults(event.resultsMessageId, results))) return;
    const messageId = await this.announcer.postResults(results);
    await this.events.update(event.id, { resultsMessageId: messageId });
  }

  private async resultsOf(event: EventSummary): Promise<ResultsAnnouncement> {
    const [results, registrations, teams, standings] = await Promise.all([
      this.events.results(event.id),
      this.events.registrations(event.id),
      this.events.teams(event.id),
      this.standings.forSeason(event.seasonId),
    ]);
    const pseudo = new Map(registrations.map((registration) => [registration.playerId, registration.pseudo]));
    const place = new Map(results.map((result) => [result.playerId, result.place]));
    let lines: ResultLine[];
    let unranked: number;
    if (event.format.teamMode === 'team') {
      const participants = teams.map((team) => {
        const members = registrations.filter((registration) => registration.teamId === team.id);
        return {
          place: members.map((member) => place.get(member.playerId) ?? null).find((value) => value !== null) ?? null,
          label: team.name,
          members: members.map((member) => member.pseudo),
        };
      });
      lines = participants.filter((line): line is ResultLine => line.place !== null);
      unranked = participants.length - lines.length;
    } else {
      lines = results
        .filter((result): result is { playerId: string; place: number } => result.place !== null)
        .map((result) => ({ place: result.place, label: pseudo.get(result.playerId) ?? '?', members: [] }));
      unranked = results.length - lines.length;
    }
    lines.sort((a, b) => a.place - b.place || a.label.localeCompare(b.label, 'fr'));
    return {
      event,
      lines,
      unranked,
      season: standings?.season ?? null,
      standings: (standings?.entries ?? []).filter((entry) => entry.rank <= RESULTS_STANDINGS_TOP),
    };
  }

  /** Attend la fin des opérations en cours (tests, arrêt propre). */
  async settled(): Promise<void> {
    await this.queue;
  }

  private enqueue(what: string, action: () => Promise<void>): Promise<void> {
    const run = this.queue.then(action).catch((error: unknown) => {
      this.onError(`Discord, ${what} : ${error instanceof Error ? error.message : String(error)}`);
    });
    this.queue = run;
    return run;
  }
}
