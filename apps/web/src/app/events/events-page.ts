import { ChangeDetectionStrategy, Component, computed, inject, type OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EventSummaryDto, SeasonDto, TimelineGroupDto } from '@porolympiques/shared';
import { SeasonPicker, defaultSeason } from '../core/season-picker';
import { errorMessage } from '../ideas/ideas.api';
import { EventCard } from './event-card';
import { EventsApi } from './events.api';

const GROUPS: { key: TimelineGroupDto; title: string; empty: string }[] = [
  { key: 'ongoing', title: 'En cours', empty: 'Aucun event en cours.' },
  { key: 'upcoming', title: 'À venir', empty: 'Rien d’annoncé pour la suite.' },
  { key: 'past', title: 'Passés', empty: 'Aucun event terminé.' },
];

/** Timeline des events d'une saison : en cours, à venir, passés. La saison en cours par défaut. */
@Component({
  selector: 'app-events-page',
  imports: [EventCard, RouterLink, SeasonPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="text-3xl font-bold tracking-tight">Events</h1>
        <div class="flex items-center gap-3">
          <a routerLink="/choix-du-jeu" class="text-sm font-medium underline">Prochain jeu</a>
          <app-season-picker [seasons]="seasons()" [selected]="seasonId()" (picked)="load($event)" />
        </div>
      </div>
      @if (error()) {
        <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
      } @else if (loaded() && !seasonId()) {
        <p class="text-slate-600">Aucune saison pour l’instant.</p>
      } @else if (loaded()) {
        @for (group of groups; track group.key) {
          <section class="flex flex-col gap-2">
            <h2 class="text-lg font-semibold">{{ group.title }}</h2>
            <ul class="flex flex-col gap-2">
              @for (event of byGroup()[group.key]; track event.id) {
                <li><app-event-card [event]="event" /></li>
              } @empty {
                <li class="text-sm text-slate-500">{{ group.empty }}</li>
              }
            </ul>
          </section>
        }
      }
    </main>
  `,
})
export class EventsPage implements OnInit {
  private readonly api = inject(EventsApi);

  protected readonly seasons = signal<SeasonDto[]>([]);
  protected readonly seasonId = signal<string | null>(null);
  protected readonly events = signal<EventSummaryDto[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal('');
  protected readonly groups = GROUPS;
  /** Passés : du plus récent au plus ancien ; les autres dans l'ordre chronologique. */
  protected readonly byGroup = computed(() => {
    const groups: Record<TimelineGroupDto, EventSummaryDto[]> = { ongoing: [], upcoming: [], past: [] };
    for (const event of this.events()) groups[event.timeline].push(event);
    groups.past.reverse();
    return groups;
  });

  async ngOnInit(): Promise<void> {
    try {
      const seasons = await this.api.seasons();
      this.seasons.set(seasons);
      const season = defaultSeason(seasons);
      if (season) await this.load(season.id);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loaded.set(true);
    }
  }

  async load(seasonId: string): Promise<void> {
    this.error.set('');
    this.seasonId.set(seasonId);
    try {
      this.events.set(await this.api.seasonEvents(seasonId));
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
