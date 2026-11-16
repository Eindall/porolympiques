import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  type EventSummaryDto,
  type IdeaDto,
  type NextGameDto,
  type PlayerDto,
  SEASON_STATUS_LABELS,
  type SeasonDto,
} from '@porolympiques/shared';
import { formatParis, fromParisInput } from '../core/paris-time';
import { EventsApi } from '../events/events.api';
import { IdeasApi, errorMessage } from '../ideas/ideas.api';

/** Barème saisi en liste (« 24, 18, 14… ») : place 1, 2, 3…, la dernière valant pour les suivantes. */
export function parseScale(value: string): Record<string, number> | null {
  const points = value.split(/[,;\s]+/).filter(Boolean).map(Number);
  if (points.length === 0 || points.some((point) => !Number.isFinite(point) || point < 0)) return null;
  return Object.fromEntries(points.map((point, index) => [String(index + 1), point]));
}

export const scaleText = (scale: Record<string, number>) =>
  Object.keys(scale)
    .sort((a, b) => Number(a) - Number(b))
    .map((place) => scale[place])
    .join(', ');

/** Page admin : saisons, puis les events de la saison choisie. Le détail d'un event a sa propre page. */
@Component({
  selector: 'app-admin-page',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <h1 class="text-3xl font-bold tracking-tight">Admin</h1>
      @if (error()) {
        <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
      }

      <section class="flex flex-col gap-3">
        <h2 class="text-xl font-semibold">Saisons</h2>
        <ul class="flex flex-col gap-2">
          @for (season of seasons(); track season.id) {
            <li class="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3" [class.border-slate-900]="season.id === selected()?.id">
              <button type="button" class="font-semibold hover:underline" (click)="select(season)">{{ season.name }}</button>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{{ seasonLabels[season.status] }}</span>
              <span class="text-sm text-slate-500">{{ paris(season.startDate) }} → {{ paris(season.endDate) }}</span>
              <span class="text-sm text-slate-500">Quotas {{ season.mainQuota }} + {{ season.sideQuota }} · Barème {{ scaleText(season.scoringScale) }}</span>
              <span class="ml-auto flex gap-2 text-sm">
                @if (season.status === 'upcoming') {
                  <button type="button" class="rounded-md border px-2 py-1" (click)="seasonAction(season, 'start')" [disabled]="busy()">Démarrer</button>
                }
                @if (season.status === 'active') {
                  <button type="button" class="rounded-md border px-2 py-1" (click)="seasonAction(season, 'finish')" [disabled]="busy()">Terminer</button>
                }
              </span>
            </li>
          } @empty {
            <li class="text-slate-500">Aucune saison pour l’instant.</li>
          }
        </ul>

        <form class="grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm sm:grid-cols-2" (ngSubmit)="createSeason()">
          <label class="flex flex-col gap-1">Nom
            <input name="seasonName" [(ngModel)]="seasonDraft.name" required maxlength="100" class="rounded-md border px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">Barème (points des places 1, 2, 3…)
            <input name="seasonScale" [(ngModel)]="seasonDraft.scale" class="rounded-md border px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">Début (heure de Paris)
            <input name="seasonStart" type="datetime-local" [(ngModel)]="seasonDraft.start" required class="rounded-md border px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">Fin
            <input name="seasonEnd" type="datetime-local" [(ngModel)]="seasonDraft.end" required class="rounded-md border px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">Mains comptés
            <input name="mainQuota" type="number" min="0" [(ngModel)]="seasonDraft.mainQuota" class="rounded-md border px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">Sides comptés
            <input name="sideQuota" type="number" min="0" [(ngModel)]="seasonDraft.sideQuota" class="rounded-md border px-2 py-1" />
          </label>
          <button type="submit" class="w-fit rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white" [disabled]="busy()">Créer la saison</button>
        </form>
      </section>

      @if (selected(); as season) {
        <section class="flex flex-col gap-3">
          <h2 class="text-xl font-semibold">Events · {{ season.name }}</h2>
          <ul class="flex flex-col gap-2">
            @for (event of events(); track event.id) {
              <li>
                <a [routerLink]="['/admin/events', event.id]" class="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 hover:bg-slate-50">
                  <span class="text-xs font-semibold uppercase text-slate-500">{{ typeLabels[event.type] }}</span>
                  <span class="font-semibold">{{ event.game.name }} — {{ event.format.name }}</span>
                  <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{{ statusLabels[event.status] }}</span>
                  <span class="text-sm text-slate-500">{{ event.registrationCount }} inscrit(s) · fin {{ paris(event.endDate) }}</span>
                </a>
              </li>
            } @empty {
              <li class="text-slate-500">Aucun event dans cette saison.</li>
            }
          </ul>

          @if (season.status !== 'finished') {
            <form class="grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm sm:grid-cols-2" (ngSubmit)="createEvent(season)">
              <h3 class="font-semibold sm:col-span-2">Nouvel event</h3>
              @if (nextGame(); as next) {
                <p class="text-slate-600 sm:col-span-2">
                  @switch (next.status) {
                    @case ('chosen') { Jeu choisi par le vainqueur : {{ next.pick?.game?.name }} — {{ next.pick?.name }}. }
                    @case ('open') { Le vainqueur choisit encore, jusqu’au {{ paris(next.deadline) }}. }
                    @case ('default') { Format le plus upvoté : {{ next.pick?.game?.name }} — {{ next.pick?.name }}. }
                    @case ('scheduled') { Un main est déjà prévu. }
                  }
                </p>
              }
              <label class="flex flex-col gap-1">Type
                <select name="type" [(ngModel)]="eventDraft.type" (ngModelChange)="prefill()" class="rounded-md border px-2 py-1">
                  <option value="main">Main event</option>
                  <option value="side">Side event</option>
                </select>
              </label>
              <label class="flex flex-col gap-1">Format
                <select name="formatId" [(ngModel)]="eventDraft.formatId" required class="rounded-md border px-2 py-1">
                  <option value="" disabled>Choisir un format</option>
                  @for (idea of formats(); track idea.id) {
                    <option [value]="idea.id">{{ idea.game.name }} — {{ idea.name }} ({{ idea.votes }} vote{{ idea.votes > 1 ? 's' : '' }})</option>
                  }
                </select>
                <a routerLink="/idees/nouvelle" class="text-xs text-slate-500 underline">Format absent ? Le créer dans la boîte à idées</a>
              </label>
              <label class="flex flex-col gap-1">Annonce
                <input name="announceDate" type="datetime-local" [(ngModel)]="eventDraft.announce" required class="rounded-md border px-2 py-1" />
              </label>
              <label class="flex flex-col gap-1">Fin des inscriptions
                <input name="registrationEnd" type="datetime-local" [(ngModel)]="eventDraft.registrationEnd" required class="rounded-md border px-2 py-1" />
              </label>
              <label class="flex flex-col gap-1">Fin de l’event
                <input name="endDate" type="datetime-local" [(ngModel)]="eventDraft.end" required class="rounded-md border px-2 py-1" />
              </label>
              <label class="flex flex-col gap-1">Live (facultatif)
                <input name="liveDate" type="datetime-local" [(ngModel)]="eventDraft.live" class="rounded-md border px-2 py-1" />
              </label>
              <label class="flex flex-col gap-1">Hôte
                <select name="hostId" [(ngModel)]="eventDraft.hostId" class="rounded-md border px-2 py-1">
                  <option value="">Aucun</option>
                  @for (player of activePlayers(); track player.id) {
                    <option [value]="player.id">{{ player.pseudo }}</option>
                  }
                </select>
              </label>
              <label class="flex flex-col gap-1">Lien Challonge
                <input name="challongeUrl" [(ngModel)]="eventDraft.challongeUrl" placeholder="https://challonge.com/…" class="rounded-md border px-2 py-1" />
              </label>
              <label class="flex flex-col gap-1 sm:col-span-2">Règles
                <textarea name="rules" [(ngModel)]="eventDraft.rules" rows="3" maxlength="5000" class="rounded-md border px-2 py-1"></textarea>
              </label>
              <button type="submit" class="w-fit rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white" [disabled]="busy()">Créer l’event</button>
            </form>
          }
        </section>
      }
    </main>
  `,
})
export class AdminPage implements OnInit {
  private readonly api = inject(EventsApi);
  private readonly ideasApi = inject(IdeasApi);

  protected readonly seasons = signal<SeasonDto[]>([]);
  protected readonly selected = signal<SeasonDto | null>(null);
  protected readonly events = signal<EventSummaryDto[]>([]);
  protected readonly formats = signal<IdeaDto[]>([]);
  protected readonly activePlayers = signal<PlayerDto[]>([]);
  protected readonly nextGame = signal<NextGameDto | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly seasonLabels = SEASON_STATUS_LABELS;
  protected readonly statusLabels = EVENT_STATUS_LABELS;
  protected readonly typeLabels = EVENT_TYPE_LABELS;
  protected readonly paris = formatParis;
  protected readonly scaleText = scaleText;

  protected seasonDraft = { name: '', scale: '24, 18, 14, 12, 10, 8, 6, 4, 2', start: '', end: '', mainQuota: 3, sideQuota: 2 };
  protected eventDraft = emptyEvent();

  async ngOnInit(): Promise<void> {
    await this.run(async () => {
      const [seasons, players] = await Promise.all([this.api.seasons(), this.api.players(), this.loadFormats()]);
      this.seasons.set(seasons);
      this.activePlayers.set(players.filter((player) => player.active));
      const current = seasons.find((season) => season.status === 'active') ?? seasons[0];
      if (current) await this.loadEvents(current);
      this.prefill();
    });
  }

  async select(season: SeasonDto): Promise<void> {
    await this.run(() => this.loadEvents(season));
  }

  /** Main : format choisi par le vainqueur, sinon le plus upvoté. */
  prefill(): void {
    const pick = this.nextGame()?.pick;
    if (this.eventDraft.type === 'main' && pick && !this.eventDraft.formatId) this.eventDraft.formatId = pick.id;
  }

  async createSeason(): Promise<void> {
    const { name, scale, start, end, mainQuota, sideQuota } = this.seasonDraft;
    const scoringScale = parseScale(scale);
    const startDate = fromParisInput(start);
    const endDate = fromParisInput(end);
    if (!scoringScale || !startDate || !endDate) {
      this.error.set('Vérifie les dates et le barème (des nombres séparés par des virgules).');
      return;
    }
    await this.run(async () => {
      const season = await this.api.createSeason({ name, startDate, endDate, scoringScale, mainQuota, sideQuota });
      this.seasons.update((seasons) => [season, ...seasons]);
      this.seasonDraft = { ...this.seasonDraft, name: '', start: '', end: '' };
      await this.loadEvents(season);
    });
  }

  async seasonAction(season: SeasonDto, action: 'start' | 'finish'): Promise<void> {
    if (action === 'finish' && !confirm(`Terminer la saison « ${season.name} » ?`)) return;
    await this.run(async () => {
      const updated = await this.api.seasonAction(season.id, action);
      this.seasons.update((seasons) => seasons.map((item) => (item.id === updated.id ? updated : item)));
      if (this.selected()?.id === updated.id) this.selected.set(updated);
    });
  }

  async createEvent(season: SeasonDto): Promise<void> {
    const draft = this.eventDraft;
    const [announceDate, registrationEnd, endDate] = [draft.announce, draft.registrationEnd, draft.end].map(fromParisInput);
    if (!announceDate || !registrationEnd || !endDate || !draft.formatId) {
      this.error.set('Choisis un format et remplis les trois dates.');
      return;
    }
    await this.run(async () => {
      await this.api.createEvent({
        seasonId: season.id,
        type: draft.type,
        format: { kind: 'existing', formatId: draft.formatId },
        announceDate,
        registrationEnd,
        endDate,
        liveDate: fromParisInput(draft.live),
        hostId: draft.hostId || null,
        challongeUrl: draft.challongeUrl.trim() || null,
        rules: draft.rules,
      });
      this.eventDraft = emptyEvent();
      await Promise.all([this.loadEvents(season), this.loadFormats()]);
      this.prefill();
    });
  }

  /** Formats disponibles : proposés, plus celui choisi par le vainqueur (déjà retenu). */
  private async loadFormats(): Promise<void> {
    const [ideas, nextGame] = await Promise.all([this.ideasApi.list(), this.api.nextGame()]);
    this.formats.set(ideas.filter((idea) => idea.status === 'proposed' || idea.id === nextGame.pick?.id));
    this.nextGame.set(nextGame);
  }

  private async loadEvents(season: SeasonDto): Promise<void> {
    this.selected.set(season);
    this.events.set(await this.api.seasonEvents(season.id));
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

function emptyEvent() {
  return {
    type: 'main' as 'main' | 'side',
    formatId: '',
    announce: '',
    registrationEnd: '',
    end: '',
    live: '',
    hostId: '',
    challongeUrl: '',
    rules: '',
  };
}
