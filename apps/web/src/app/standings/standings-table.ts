import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { StandingsEntryDto } from '@porolympiques/shared';
import { EVENT_TYPE_COLORS } from '../core/event-type';

/** Tableau du classement : rang, joueur, score, et en option le détail des résultats (écartés en grisé). */
@Component({
  selector: 'app-standings-table',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      @for (entry of entries(); track entry.player.id) {
        <li class="flex flex-col gap-1.5 px-3 py-2.5">
          <div class="flex items-center gap-3">
            <span class="w-7 text-right text-lg font-bold tabular-nums" [class.text-amber-600]="entry.rank === 1">{{ entry.rank }}</span>
            <img [src]="entry.player.avatarUrl" alt="" class="size-8 rounded-full" />
            <a [routerLink]="['/joueurs', entry.player.id]" class="min-w-0 grow truncate font-medium hover:underline" [class.text-slate-400]="!entry.player.active">
              {{ entry.player.pseudo }}
            </a>
            <span class="font-semibold tabular-nums">{{ entry.score }} pts</span>
          </div>
          @if (detailed() && entry.results.length > 0) {
            <ul class="ml-10 flex flex-wrap gap-1.5 text-xs">
              @for (result of entry.results; track result.eventId) {
                <li
                  class="flex items-center gap-1 rounded-full px-2 py-0.5"
                  [class]="result.status === 'counted' ? colors[result.type].pill : 'bg-slate-100 text-slate-400 line-through decoration-slate-300'"
                  [title]="result.status === 'counted' ? 'Compté' : result.status === 'discarded' ? 'Écarté (hors quotas)' : 'Non classé'"
                >
                  <span class="text-[10px] font-bold uppercase" [class.opacity-60]="result.status === 'counted'">{{ result.type === 'main' ? 'Main' : 'Side' }}</span>
                  {{ result.label }} · {{ result.place ? result.place + (result.place === 1 ? 'er' : 'e') : 'non classé' }} · {{ result.points }} pt{{ result.points > 1 ? 's' : '' }}
                </li>
              }
            </ul>
          }
        </li>
      }
    </ol>
  `,
})
export class StandingsTable {
  readonly entries = input.required<StandingsEntryDto[]>();
  readonly detailed = input(false);
  protected readonly colors = EVENT_TYPE_COLORS;
}
