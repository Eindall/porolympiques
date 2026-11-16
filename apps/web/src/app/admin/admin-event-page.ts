import { ChangeDetectionStrategy, Component, computed, inject, input, type OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, type EventDto, type IdeaDto, type PlayerDto } from '@porolympiques/shared';
import { formatParis, fromParisInput, toParisInput } from '../core/paris-time';
import { EventsApi } from '../events/events.api';
import { IdeasApi, errorMessage } from '../ideas/ideas.api';

const OPEN = ['announced', 'registration', 'in_progress'];

/**
 * Gestion d'un event par l'admin : infos, jeu, inscrits, équipes, places finales et validation d'un side.
 * Une place vide laisse le participant non classé.
 */
@Component({
  selector: 'app-admin-event-page',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <a routerLink="/admin" class="text-sm text-slate-600 hover:underline">← Admin</a>
      @if (error()) {
        <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
      }
      @if (event(); as ev) {
        <header class="flex flex-wrap items-center gap-3">
          <span class="text-xs font-semibold uppercase text-slate-500">{{ typeLabels[ev.type] }}</span>
          <h1 class="text-2xl font-bold">{{ ev.game.name }} — {{ ev.format.name }}</h1>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{{ statusLabels[ev.status] }}</span>
          <a [routerLink]="['/events', ev.id]" class="text-sm text-slate-600 underline">Page joueur</a>
        </header>

        @if (open()) {
          <div class="flex flex-wrap gap-2 text-sm">
            @if (ev.status !== 'in_progress') {
              <button type="button" class="rounded-md border px-3 py-1" (click)="act('start')" [disabled]="busy()">Démarrer (fin des inscriptions)</button>
            }
            <button type="button" class="rounded-md border border-red-300 px-3 py-1 text-red-700" (click)="act('cancel')" [disabled]="busy()">Annuler l’event</button>
          </div>
        }

        @if (ev.type === 'side') {
          <section class="flex flex-col gap-2 rounded-xl border bg-white p-4 text-sm">
            <h2 class="font-semibold">Validation du side</h2>
            @for (warning of ev.sideWarnings; track warning) {
              <p class="text-amber-800">⚠ {{ warning }}</p>
            }
            <label class="flex items-center gap-2">
              <input type="checkbox" [checked]="ev.validated" (change)="validate($any($event.target).checked)" [disabled]="busy()" />
              Validé par l’admin (compte au classement s’il réunit au moins 4 classés)
            </label>
          </section>
        }

        <form class="grid gap-2 rounded-xl border bg-white p-4 text-sm sm:grid-cols-2" (ngSubmit)="saveDetails()">
          <h2 class="font-semibold sm:col-span-2">Infos</h2>
          <label class="flex flex-col gap-1">Annonce
            <input name="announce" type="datetime-local" [(ngModel)]="details.announce" required class="rounded-md border px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">Fin des inscriptions
            <input name="registrationEnd" type="datetime-local" [(ngModel)]="details.registrationEnd" required class="rounded-md border px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">Fin de l’event
            <input name="end" type="datetime-local" [(ngModel)]="details.end" required class="rounded-md border px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">Live (facultatif)
            <input name="live" type="datetime-local" [(ngModel)]="details.live" class="rounded-md border px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">Hôte
            <select name="hostId" [(ngModel)]="details.hostId" class="rounded-md border px-2 py-1">
              <option value="">Aucun</option>
              @for (player of activePlayers(); track player.id) {
                <option [value]="player.id">{{ player.pseudo }}</option>
              }
            </select>
          </label>
          <label class="flex flex-col gap-1">Coefficient
            <input name="coefficient" type="number" step="0.1" min="0.1" [(ngModel)]="details.coefficient" class="rounded-md border px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1 sm:col-span-2">Lien Challonge
            <input name="challongeUrl" [(ngModel)]="details.challongeUrl" class="rounded-md border px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1 sm:col-span-2">Règles
            <textarea name="rules" [(ngModel)]="details.rules" rows="4" maxlength="5000" class="rounded-md border px-2 py-1"></textarea>
          </label>
          <button type="submit" class="w-fit rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white" [disabled]="busy()">Enregistrer</button>
        </form>

        @if (open()) {
          <form class="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-4 text-sm" (ngSubmit)="changeFormat()">
            <label class="flex grow flex-col gap-1">Changer le jeu
              <select name="newFormat" [(ngModel)]="newFormatId" class="rounded-md border px-2 py-1">
                <option value="">Choisir un autre format</option>
                @for (idea of formats(); track idea.id) {
                  <option [value]="idea.id">{{ idea.game.name }} — {{ idea.name }}</option>
                }
              </select>
            </label>
            <button type="submit" class="rounded-md border px-3 py-1.5" [disabled]="busy() || !newFormatId">Changer</button>
          </form>
        }

        <section class="flex flex-col gap-3 rounded-xl border bg-white p-4 text-sm">
          <h2 class="font-semibold">Inscrits ({{ ev.registrations.length }})</h2>
          @if (isTeam() && open()) {
            <form class="flex gap-2" (ngSubmit)="createTeam()">
              <input name="teamName" [(ngModel)]="teamName" placeholder="Nom de l’équipe" maxlength="100" class="rounded-md border px-2 py-1" />
              <button type="submit" class="rounded-md border px-3 py-1" [disabled]="busy() || !teamName.trim()">Créer l’équipe</button>
            </form>
            <ul class="flex flex-wrap gap-2">
              @for (team of ev.teams; track team.id) {
                <li class="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                  {{ team.name }}
                  <button type="button" class="text-red-700" [attr.aria-label]="'Supprimer l’équipe ' + team.name" (click)="deleteTeam(team.id)">×</button>
                </li>
              }
            </ul>
          }

          <form (ngSubmit)="saveResults()" class="flex flex-col gap-2">
            <table class="w-full text-left">
              <thead class="text-xs uppercase text-slate-500">
                <tr><th class="py-1">Joueur</th>@if (isTeam()) {<th>Équipe</th>} @else {<th>Place</th>}<th></th></tr>
              </thead>
              <tbody>
                @for (registration of ev.registrations; track registration.playerId) {
                  <tr class="border-t">
                    <td class="py-1.5">{{ registration.pseudo }}</td>
                    @if (isTeam()) {
                      <td>
                        <select [attr.aria-label]="'Équipe de ' + registration.pseudo" [disabled]="!open() || busy()" (change)="assign(registration.playerId, $any($event.target).value)" class="rounded-md border px-2 py-1">
                          <option value="" [selected]="!registration.teamId">Sans équipe</option>
                          @for (team of ev.teams; track team.id) {
                            <option [value]="team.id" [selected]="team.id === registration.teamId">{{ team.name }}</option>
                          }
                        </select>
                      </td>
                    } @else {
                      <td>
                        <input type="number" min="1" [name]="'place-' + registration.playerId" [(ngModel)]="places[registration.playerId]" [attr.aria-label]="'Place de ' + registration.pseudo" class="w-20 rounded-md border px-2 py-1" />
                      </td>
                    }
                    <td class="text-right">
                      @if (open()) {
                        <button type="button" class="text-red-700" (click)="unregister(registration.playerId)" [disabled]="busy()">Retirer</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (isTeam()) {
              <div class="flex flex-wrap gap-3">
                @for (team of ev.teams; track team.id) {
                  <label class="flex items-center gap-2">Place {{ team.name }}
                    <input type="number" min="1" [name]="'team-' + team.id" [(ngModel)]="places[team.id]" [attr.aria-label]="'Place de l’équipe ' + team.name" class="w-20 rounded-md border px-2 py-1" />
                  </label>
                }
              </div>
            }
            @if (ev.status !== 'cancelled') {
              <button type="submit" class="w-fit rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white" [disabled]="busy()">
                {{ ev.status === 'finished' ? 'Corriger les places' : 'Enregistrer les places et clore l’event' }}
              </button>
            }
          </form>

          @if (open()) {
            <div class="flex gap-2">
              <select name="addPlayer" [(ngModel)]="playerToAdd" aria-label="Joueur à inscrire" class="rounded-md border px-2 py-1">
                <option value="">Inscrire un joueur…</option>
                @for (player of notRegistered(); track player.id) {
                  <option [value]="player.id">{{ player.pseudo }}</option>
                }
              </select>
              <button type="button" class="rounded-md border px-3 py-1" (click)="register()" [disabled]="busy() || !playerToAdd">Inscrire</button>
            </div>
          }
        </section>
      } @else if (!error()) {
        <p class="text-slate-500">Chargement…</p>
      }
    </main>
  `,
})
export class AdminEventPage implements OnInit {
  private readonly api = inject(EventsApi);
  private readonly ideasApi = inject(IdeasApi);

  readonly id = input.required<string>();

  protected readonly event = signal<EventDto | null>(null);
  protected readonly activePlayers = signal<PlayerDto[]>([]);
  protected readonly formats = signal<IdeaDto[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly open = computed(() => OPEN.includes(this.event()?.status ?? ''));
  protected readonly isTeam = computed(() => this.event()?.format.teamMode === 'team');
  protected readonly notRegistered = computed(() => {
    const registered = new Set(this.event()?.registrations.map((registration) => registration.playerId));
    return this.activePlayers().filter((player) => !registered.has(player.id));
  });

  protected readonly statusLabels = EVENT_STATUS_LABELS;
  protected readonly typeLabels = EVENT_TYPE_LABELS;
  protected readonly paris = formatParis;

  protected details = { announce: '', registrationEnd: '', end: '', live: '', hostId: '', coefficient: 1, challongeUrl: '', rules: '' };
  /** Places saisies, par joueur (solo) ou par équipe. */
  protected places: Record<string, number | null> = {};
  protected newFormatId = '';
  protected teamName = '';
  protected playerToAdd = '';

  async ngOnInit(): Promise<void> {
    await this.run(async () => {
      const [event, players, ideas] = await Promise.all([this.api.event(this.id()), this.api.players(), this.ideasApi.list()]);
      this.activePlayers.set(players.filter((player) => player.active));
      this.formats.set(ideas.filter((idea) => idea.status === 'proposed'));
      this.show(event, true);
    });
  }

  act(action: 'start' | 'cancel'): Promise<void> {
    if (action === 'cancel' && !confirm('Annuler cet event ? Son format redevient proposé.')) return Promise.resolve();
    return this.update(() => this.api.eventAction(this.id(), action));
  }

  validate(validated: boolean): Promise<void> {
    return this.update(() => this.api.validate(this.id(), validated));
  }

  saveDetails(): Promise<void> {
    const d = this.details;
    const [announceDate, registrationEnd, endDate] = [d.announce, d.registrationEnd, d.end].map(fromParisInput);
    if (!announceDate || !registrationEnd || !endDate) {
      this.error.set('Remplis les trois dates.');
      return Promise.resolve();
    }
    return this.update(() =>
      this.api.updateEvent(this.id(), {
        announceDate,
        registrationEnd,
        endDate,
        liveDate: fromParisInput(d.live),
        hostId: d.hostId || null,
        coefficient: Number(d.coefficient),
        challongeUrl: d.challongeUrl.trim() || null,
        rules: d.rules,
      }),
      true,
    );
  }

  async changeFormat(): Promise<void> {
    const formatId = this.newFormatId;
    await this.update(() => this.api.changeFormat(this.id(), { kind: 'existing', formatId }));
    this.newFormatId = '';
    this.formats.set((await this.ideasApi.list()).filter((idea) => idea.status === 'proposed'));
  }

  async createTeam(): Promise<void> {
    await this.update(() => this.api.createTeam(this.id(), this.teamName));
    if (!this.error()) this.teamName = '';
  }

  deleteTeam(teamId: string): Promise<void> {
    return this.update(() => this.api.deleteTeam(this.id(), teamId));
  }

  assign(playerId: string, teamId: string): Promise<void> {
    return this.update(() => this.api.assignTeam(this.id(), playerId, teamId || null));
  }

  async register(): Promise<void> {
    await this.update(() => this.api.addRegistration(this.id(), this.playerToAdd));
    this.playerToAdd = '';
  }

  unregister(playerId: string): Promise<void> {
    return this.update(() => this.api.removeRegistration(this.id(), playerId));
  }

  saveResults(): Promise<void> {
    const event = this.event();
    if (!event) return Promise.resolve();
    const place = (id: string) => {
      const value = this.places[id];
      return value === null || value === undefined || String(value) === '' ? null : Number(value);
    };
    const request = this.isTeam()
      ? { teams: event.teams.map((team) => ({ teamId: team.id, place: place(team.id) })) }
      : { players: event.registrations.map(({ playerId }) => ({ playerId, place: place(playerId) })) };
    if (event.status !== 'finished' && !confirm('Enregistrer ces places et clore l’event ? Les votes de son format repartent de zéro.')) {
      return Promise.resolve();
    }
    return this.update(() => this.api.saveResults(this.id(), request));
  }

  private update(call: () => Promise<EventDto>, resetForm = false): Promise<void> {
    return this.run(async () => this.show(await call(), resetForm));
  }

  /** Affiche l'event ; remplit le formulaire des infos au chargement et après son enregistrement. */
  private show(event: EventDto, resetForm: boolean): void {
    this.event.set(event);
    if (resetForm) {
      this.details = {
        announce: toParisInput(event.announceDate),
        registrationEnd: toParisInput(event.registrationEnd),
        end: toParisInput(event.endDate),
        live: toParisInput(event.liveDate),
        hostId: event.host?.id ?? '',
        coefficient: event.coefficient,
        challongeUrl: event.challongeUrl ?? '',
        rules: event.rules,
      };
    }
    const places: Record<string, number | null> = {};
    for (const result of event.results) places[result.playerId] = result.place;
    if (event.format.teamMode === 'team') {
      for (const team of event.teams) {
        const member = event.registrations.find((registration) => registration.teamId === team.id);
        places[team.id] = event.results.find((result) => result.playerId === member?.playerId)?.place ?? this.places[team.id] ?? null;
      }
    }
    this.places = { ...this.places, ...places };
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
