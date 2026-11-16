import { ChangeDetectionStrategy, Component, computed, inject, input, type OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, type EventDto, PLAY_MODE_LABELS, TEAM_MODE_LABELS } from '@porolympiques/shared';
import { AuthService } from '../core/auth.service';
import { formatParis } from '../core/paris-time';
import { errorMessage } from '../ideas/ideas.api';
import { EventsApi } from './events.api';

/** Détail d'un event, avec l'inscription. Version simple : la page complète arrive avec les pages joueur. */
@Component({
  selector: 'app-event-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8">
      <a routerLink="/events" class="text-sm text-slate-600 hover:underline">← Events</a>
      @if (error()) {
        <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
      }
      @if (event(); as ev) {
        <header class="flex gap-4">
          @if (ev.game.coverUrl) {
            <img [src]="ev.game.coverUrl" alt="" class="h-28 w-21 shrink-0 rounded-md object-cover" />
          }
          <div class="flex flex-col gap-1">
            <p class="text-xs font-semibold uppercase text-slate-500">{{ typeLabels[ev.type] }} · {{ statusLabels[ev.status] }}</p>
            <h1 class="text-2xl font-bold">{{ ev.game.name }} — {{ ev.format.name }}</h1>
            <p class="text-sm text-slate-600">{{ teamLabels[ev.format.teamMode] }} · {{ playLabels[ev.format.playMode] }}@if (ev.host) { · Hôte : {{ ev.host.pseudo }} }</p>
            @if (isAdmin()) {
              <a [routerLink]="['/admin/events', ev.id]" class="text-sm text-slate-600 underline">Gérer l’event</a>
            }
          </div>
        </header>

        <dl class="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div><dt class="inline text-slate-500">Annonce : </dt><dd class="inline">{{ paris(ev.announceDate) }}</dd></div>
          <div><dt class="inline text-slate-500">Fin des inscriptions : </dt><dd class="inline">{{ paris(ev.registrationEnd) }}</dd></div>
          <div><dt class="inline text-slate-500">Fin de l’event : </dt><dd class="inline">{{ paris(ev.endDate) }}</dd></div>
          @if (ev.liveDate) {
            <div><dt class="inline text-slate-500">Live : </dt><dd class="inline">{{ paris(ev.liveDate) }}</dd></div>
          }
          @if (ev.challongeUrl) {
            <div><dt class="inline text-slate-500">Arbre : </dt><dd class="inline"><a [href]="ev.challongeUrl" target="_blank" rel="noopener" class="underline">Challonge</a></dd></div>
          }
        </dl>
        @if (ev.rules) {
          <p class="whitespace-pre-line rounded-xl bg-white p-4 text-sm">{{ ev.rules }}</p>
        }

        @if (ev.registeredByMe) {
          <p class="font-medium text-emerald-700">Tu es inscrit.</p>
        } @else if (ev.registrationOpen) {
          <button type="button" class="w-fit rounded-lg bg-slate-900 px-4 py-2 font-medium text-white" (click)="register()" [disabled]="busy()">S’inscrire</button>
          <p class="text-xs text-slate-500">L’inscription est définitive : pour te retirer, demande à l’admin.</p>
        } @else if (ev.status !== 'finished' && ev.status !== 'cancelled') {
          <p class="text-slate-600">Inscriptions fermées.</p>
        }

        <section class="flex flex-col gap-2">
          <h2 class="font-semibold">{{ ev.status === 'finished' ? 'Résultats' : 'Inscrits' }} ({{ ev.registrations.length }})</h2>
          <ol class="flex flex-col gap-1 text-sm">
            @for (row of rows(); track row.playerId) {
              <li class="flex items-center gap-2">
                @if (ev.status === 'finished') {
                  <span class="w-10 font-semibold">{{ row.place ?? '—' }}</span>
                }
                <img [src]="row.avatarUrl" alt="" class="size-6 rounded-full" />
                {{ row.pseudo }}
                @if (row.team) {
                  <span class="text-slate-500">· {{ row.team }}</span>
                }
              </li>
            }
          </ol>
        </section>
      }
    </main>
  `,
})
export class EventPage implements OnInit {
  private readonly api = inject(EventsApi);
  private readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  protected readonly event = signal<EventDto | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly isAdmin = computed(() => this.auth.me()?.role === 'admin');
  /** Inscrits avec leur équipe et leur place, classés d'abord une fois l'event terminé. */
  protected readonly rows = computed(() => {
    const event = this.event();
    if (!event) return [];
    const places = new Map(event.results.map((result) => [result.playerId, result.place]));
    const teams = new Map(event.teams.map((team) => [team.id, team.name]));
    const rows = event.registrations.map((registration) => ({
      ...registration,
      place: places.get(registration.playerId) ?? null,
      team: registration.teamId ? teams.get(registration.teamId) : undefined,
    }));
    return event.status === 'finished' ? rows.sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity)) : rows;
  });

  protected readonly typeLabels = EVENT_TYPE_LABELS;
  protected readonly statusLabels = EVENT_STATUS_LABELS;
  protected readonly teamLabels = TEAM_MODE_LABELS;
  protected readonly playLabels = PLAY_MODE_LABELS;
  protected readonly paris = formatParis;

  async ngOnInit(): Promise<void> {
    await this.run(async () => this.event.set(await this.api.event(this.id())));
  }

  async register(): Promise<void> {
    await this.run(async () => this.event.set(await this.api.register(this.id())));
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
