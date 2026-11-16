import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { HallOfFameDto } from '@porolympiques/shared';
import { formatParisDate } from '../core/paris-time';
import { EventsApi } from '../events/events.api';
import { errorMessage } from '../ideas/ideas.api';

/** Palmarès : champions et podiums des saisons terminées. */
@Component({
  selector: 'app-hall-of-fame-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8">
      <h1 class="text-3xl font-bold tracking-tight">Palmarès</h1>
      @if (error()) {
        <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
      }
      @if (hall(); as h) {
        @for (item of h.seasons; track item.season.id) {
          <article class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div class="flex flex-wrap items-baseline gap-2">
              <h2 class="text-lg font-semibold">{{ item.season.name }}</h2>
              <span class="text-sm text-slate-500">{{ day(item.season.startDate) }} → {{ day(item.season.endDate) }}</span>
            </div>
            <ol class="flex flex-col gap-2">
              @for (entry of item.podium; track entry.player.id) {
                <li class="flex items-center gap-3">
                  <span class="w-8 text-xl" role="img" [attr.aria-label]="entry.rank + 'e place'">{{ icons[entry.rank] }}</span>
                  <img [src]="entry.player.avatarUrl" alt="" class="size-8 rounded-full" />
                  <a [routerLink]="['/joueurs', entry.player.id]" class="grow font-medium hover:underline" [class.text-lg]="entry.rank === 1">
                    {{ entry.player.pseudo }}
                  </a>
                  <span class="tabular-nums text-slate-600">{{ entry.score }} pts</span>
                </li>
              }
            </ol>
          </article>
        } @empty {
          <p class="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-600">
            Aucune saison terminée pour l’instant : le premier champion reste à couronner.
          </p>
        }
      }
    </main>
  `,
})
export class HallOfFamePage implements OnInit {
  private readonly api = inject(EventsApi);

  protected readonly hall = signal<HallOfFameDto | null>(null);
  protected readonly error = signal('');
  protected readonly day = formatParisDate;
  protected readonly icons: Record<number, string> = { 1: '🏆', 2: '🥈', 3: '🥉' };

  async ngOnInit(): Promise<void> {
    try {
      this.hall.set(await this.api.hallOfFame());
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
