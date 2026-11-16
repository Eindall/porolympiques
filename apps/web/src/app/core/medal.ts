import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { EventTypeDto, MedalPlaceDto } from '@porolympiques/shared';

const NAMES: Record<MedalPlaceDto, string> = { 1: 'Or', 2: 'Argent', 3: 'Bronze' };
const EMOJIS: Record<MedalPlaceDto, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const SIDE_STYLES: Record<MedalPlaceDto, string> = {
  1: 'border-amber-300 text-amber-700',
  2: 'border-slate-300 text-slate-600',
  3: 'border-orange-300 text-orange-700',
};

/** Médaille d'un podium : pleine pour un main, plus discrète pour un side. */
@Component({
  selector: 'app-medal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (type() === 'main') {
      <span class="text-xl leading-none" role="img" [attr.aria-label]="label()">{{ emoji() }}</span>
    } @else {
      <span class="inline-flex size-6 items-center justify-center rounded-full border text-[10px] font-bold" [class]="sideStyle()" role="img" [attr.aria-label]="label()">
        {{ place() }}
      </span>
    }
  `,
})
export class Medal {
  readonly place = input.required<MedalPlaceDto>();
  readonly type = input.required<EventTypeDto>();
  protected readonly emoji = computed(() => EMOJIS[this.place()]);
  protected readonly sideStyle = computed(() => SIDE_STYLES[this.place()]);
  protected readonly label = computed(() => `Médaille ${NAMES[this.place()].toLowerCase()}${this.type() === 'side' ? ' (side)' : ''}`);
}
