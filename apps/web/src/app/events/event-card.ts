import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EVENT_STATUS_LABELS, type EventSummaryDto } from '@porolympiques/shared';
import { EventType } from '../core/event-type';
import { formatParis } from '../core/paris-time';

/** Un event dans une liste : jeu, format, type, statut et dates clés. */
@Component({
  selector: 'app-event-card',
  imports: [EventType, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let ev = event();
    <a [routerLink]="['/events', ev.id]" class="flex gap-3 rounded-xl border border-slate-200 p-3" [class]="ev.status === 'cancelled' ? 'bg-slate-50 opacity-60 grayscale hover:opacity-100' : 'bg-white hover:bg-slate-50'">
      @if (ev.game.coverUrl) {
        <img [src]="ev.game.coverUrl" alt="" class="h-16 w-12 shrink-0 rounded object-cover" />
      } @else {
        <div class="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-slate-100 text-xl" aria-hidden="true">🎮</div>
      }
      <div class="flex min-w-0 flex-col gap-0.5">
        <p class="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
          <app-event-type [type]="ev.type" /> {{ statusLabels[ev.status] }}
          @if (ev.type === 'side' && ev.validated) { · validé }
        </p>
        <p class="truncate font-semibold">{{ ev.game.name }} — {{ ev.format.name }}</p>
        <p class="text-sm text-slate-600">
          @switch (ev.timeline) {
            @case ('upcoming') { Annonce le {{ paris(ev.announceDate) }} }
            @case ('ongoing') { Inscriptions jusqu’au {{ paris(ev.registrationEnd) }} · fin le {{ paris(ev.endDate) }} }
            @case ('past') { {{ ev.status === 'cancelled' ? 'Annulé' : 'Terminé le ' + paris(ev.finishedAt ?? ev.endDate) }} }
          }
          · {{ ev.registrationCount }} inscrit{{ ev.registrationCount > 1 ? 's' : '' }}
        </p>
      </div>
    </a>
  `,
})
export class EventCard {
  readonly event = input.required<EventSummaryDto>();
  protected readonly statusLabels = EVENT_STATUS_LABELS;
  protected readonly paris = formatParis;
}
