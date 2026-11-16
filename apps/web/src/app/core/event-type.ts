import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { EventTypeDto } from '@porolympiques/shared';

/** Couleurs d'un type d'event, partagées par le badge et le classement : indigo pour un main, teal pour un side. */
export const EVENT_TYPE_COLORS: Record<EventTypeDto, { badge: string; pill: string }> = {
  main: { badge: 'bg-indigo-600 text-white', pill: 'bg-indigo-50 text-indigo-800' },
  side: { badge: 'bg-teal-100 text-teal-800 ring-1 ring-inset ring-teal-300', pill: 'bg-teal-50 text-teal-800' },
};

const SHORT_LABELS: Record<EventTypeDto, string> = { main: 'Main', side: 'Side' };

/** Badge « Main » ou « Side », de couleur différente. */
@Component({
  selector: 'app-event-type',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="inline-block rounded px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none tracking-wide" [class]="colors[type()].badge">{{ labels[type()] }}</span>`,
})
export class EventType {
  readonly type = input.required<EventTypeDto>();
  protected readonly colors = EVENT_TYPE_COLORS;
  protected readonly labels = SHORT_LABELS;
}
