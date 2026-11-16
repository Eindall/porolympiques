import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { HomeDto } from '@porolympiques/shared';
import { AuthService } from '../core/auth.service';
import { EventCard } from '../events/event-card';
import { EventsApi } from '../events/events.api';
import { errorMessage } from '../ideas/ideas.api';
import { StandingsTable } from '../standings/standings-table';

/** Accueil : events en cours, prochain event et top 5 de la saison. */
@Component({
  selector: 'app-home-page',
  imports: [EventCard, RouterLink, StandingsTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <h1 class="text-3xl font-bold tracking-tight">Salut {{ auth.me()?.pseudo }} !</h1>
      @if (error()) {
        <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
      }
      @if (home(); as h) {
        <section class="flex flex-col gap-2">
          <h2 class="text-lg font-semibold">En cours</h2>
          @for (event of h.ongoing; track event.id) {
            <app-event-card [event]="event" />
          } @empty {
            <p class="text-slate-600">Aucun event en cours. <a routerLink="/choix-du-jeu" class="underline">Où en est le prochain jeu ?</a></p>
          }
        </section>

        @if (h.next) {
          <section class="flex flex-col gap-2">
            <h2 class="text-lg font-semibold">Prochain event</h2>
            <app-event-card [event]="h.next" />
          </section>
        }

        <section class="flex flex-col gap-2">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-lg font-semibold">Top 5{{ h.season ? ' · ' + h.season.name : '' }}</h2>
            <a routerLink="/classement" class="text-sm font-medium underline">Classement complet</a>
          </div>
          @if (h.top.length > 0) {
            <app-standings-table [entries]="h.top" />
          } @else {
            <p class="text-slate-600">{{ h.season ? 'Pas encore de résultat cette saison.' : 'Pas de saison en cours.' }}</p>
          }
        </section>
      }
    </main>
  `,
})
export class HomePage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(EventsApi);

  protected readonly home = signal<HomeDto | null>(null);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.home.set(await this.api.home());
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
