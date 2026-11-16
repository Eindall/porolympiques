import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type PlayerRecordDto, SEASON_STATUS_LABELS } from '@porolympiques/shared';
import { Medal } from '../core/medal';
import { formatParisDate } from '../core/paris-time';
import { EventsApi } from '../events/events.api';
import { errorMessage } from '../ideas/ideas.api';

/** Page d'un joueur : trophées de saison, médailles et historique des résultats. */
@Component({
  selector: 'app-player-page',
  imports: [Medal, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      @if (error()) {
        <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
      }
      @if (record(); as r) {
        <header class="flex items-center gap-4">
          <img [src]="r.player.avatarUrl" alt="" class="size-20 rounded-full" />
          <div>
            <h1 class="text-2xl font-bold tracking-tight">{{ r.player.pseudo }}</h1>
            @if (!r.player.active) {
              <p class="text-sm text-slate-500">N’est plus sur le serveur.</p>
            }
          </div>
        </header>

        <section class="flex flex-wrap gap-3" aria-label="Palmarès">
          @for (season of r.trophies; track season.id) {
            <span class="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-900">🏆 Champion · {{ season.name }}</span>
          }
          <span class="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm ring-1 ring-slate-200">
            🥇 {{ count().gold }} · 🥈 {{ count().silver }} · 🥉 {{ count().bronze }}
            @if (count().side > 0) { <span class="text-slate-500">· {{ count().side }} podium{{ count().side > 1 ? 's' : '' }} en side</span> }
          </span>
        </section>

        @if (r.medals.length > 0) {
          <section class="flex flex-col gap-2">
            <h2 class="text-lg font-semibold">Médailles</h2>
            <ul class="flex flex-col gap-1.5">
              @for (medal of r.medals; track medal.eventId) {
                <li class="flex items-center gap-3 text-sm">
                  <app-medal [place]="medal.place" [type]="medal.type" />
                  <a [routerLink]="['/events', medal.eventId]" class="hover:underline">{{ medal.label }}</a>
                  <span class="text-slate-500">{{ day(medal.endDate) }}</span>
                </li>
              }
            </ul>
          </section>
        }

        <section class="flex flex-col gap-3">
          <h2 class="text-lg font-semibold">Saisons</h2>
          @for (item of r.seasons; track item.season.id) {
            <article class="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
              <div class="flex flex-wrap items-baseline gap-2">
                <h3 class="font-semibold">{{ item.season.name }}</h3>
                <span class="text-xs text-slate-500">{{ statusLabels[item.season.status] }}</span>
                <span class="ml-auto font-semibold">{{ item.rank }}{{ item.rank === 1 ? 'er' : 'e' }} · {{ item.score }} pts</span>
              </div>
              <ul class="flex flex-col gap-1 text-sm">
                @for (result of item.results; track result.eventId) {
                  <li class="flex flex-wrap gap-x-2" [class.text-slate-400]="result.status !== 'counted'">
                    <a [routerLink]="['/events', result.eventId]" class="hover:underline">{{ result.label }}</a>
                    @if (result.type === 'side') { <span>(side)</span> }
                    <span>· {{ result.place ? result.place + (result.place === 1 ? 'er' : 'e') : 'non classé' }}</span>
                    <span>· {{ result.points }} pt{{ result.points > 1 ? 's' : '' }}</span>
                    @if (result.status === 'discarded') { <span>· écarté</span> }
                  </li>
                }
              </ul>
            </article>
          } @empty {
            <p class="text-slate-600">Pas encore de résultat.</p>
          }
        </section>
      }
    </main>
  `,
})
export class PlayerPage {
  private readonly api = inject(EventsApi);

  readonly id = input.required<string>();

  protected readonly record = signal<PlayerRecordDto | null>(null);
  protected readonly error = signal('');
  protected readonly statusLabels = SEASON_STATUS_LABELS;
  protected readonly day = formatParisDate;
  protected readonly count = computed(() => {
    const medals = this.record()?.medals ?? [];
    const main = medals.filter((medal) => medal.type === 'main');
    return {
      gold: main.filter((medal) => medal.place === 1).length,
      silver: main.filter((medal) => medal.place === 2).length,
      bronze: main.filter((medal) => medal.place === 3).length,
      side: medals.length - main.length,
    };
  });

  constructor() {
    // Rechargée quand on passe d'un joueur à l'autre sans quitter la page.
    effect(() => void this.load(this.id()));
  }

  private async load(id: string): Promise<void> {
    this.error.set('');
    try {
      this.record.set(await this.api.player(id));
    } catch (error) {
      this.record.set(null);
      this.error.set(errorMessage(error));
    }
  }
}
