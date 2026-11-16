import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, type EventSummaryDto, type SeasonDto } from '@porolympiques/shared';
import { formatParis } from '../core/paris-time';
import { errorMessage } from '../ideas/ideas.api';
import { EventsApi } from './events.api';

/** Les events de la saison en cours. Version simple : la timeline arrive avec les pages joueur. */
@Component({
  selector: 'app-events-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="text-3xl font-bold tracking-tight">Events{{ season() ? ' · ' + season()?.name : '' }}</h1>
        <a routerLink="/choix-du-jeu" class="text-sm font-medium underline">Choix du prochain jeu</a>
      </div>
      @if (error()) {
        <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
      } @else if (!season()) {
        <p class="text-slate-600">Pas de saison en cours.</p>
      }
      <ul class="flex flex-col gap-2">
        @for (event of events(); track event.id) {
          <li>
            <a [routerLink]="['/events', event.id]" class="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 hover:bg-slate-50">
              <span class="text-xs font-semibold uppercase text-slate-500">{{ typeLabels[event.type] }}</span>
              <span class="font-semibold">{{ event.game.name }} — {{ event.format.name }}</span>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{{ statusLabels[event.status] }}</span>
              <span class="text-sm text-slate-500">Inscriptions jusqu’au {{ paris(event.registrationEnd) }} · {{ event.registrationCount }} inscrit(s)</span>
            </a>
          </li>
        } @empty {
          @if (season()) {
            <li class="text-slate-600">Aucun event pour l’instant.</li>
          }
        }
      </ul>
    </main>
  `,
})
export class EventsPage implements OnInit {
  private readonly api = inject(EventsApi);

  protected readonly season = signal<SeasonDto | null>(null);
  protected readonly events = signal<EventSummaryDto[]>([]);
  protected readonly error = signal('');
  protected readonly typeLabels = EVENT_TYPE_LABELS;
  protected readonly statusLabels = EVENT_STATUS_LABELS;
  protected readonly paris = formatParis;

  async ngOnInit(): Promise<void> {
    try {
      const season = (await this.api.seasons()).find((item) => item.status === 'active') ?? null;
      this.season.set(season);
      if (season) this.events.set(await this.api.seasonEvents(season.id));
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
