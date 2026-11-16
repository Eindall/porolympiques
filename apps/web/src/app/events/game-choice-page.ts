import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { NextGameDto } from '@porolympiques/shared';
import { formatParis } from '../core/paris-time';
import { errorMessage } from '../ideas/ideas.api';
import { EventsApi } from './events.api';

/** Choix du jeu du prochain main : le vainqueur du dernier main choisit parmi les 5 formats les plus upvotés. */
@Component({
  selector: 'app-game-choice-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8">
      <h1 class="text-3xl font-bold tracking-tight">Prochain jeu</h1>
      @if (error()) {
        <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
      }
      @if (state(); as s) {
        @switch (s.status) {
          @case ('scheduled') {
            <p>Le prochain main est prévu :
              <a [routerLink]="['/events', s.nextMain?.id]" class="font-medium underline">{{ s.nextMain?.game?.name }} — {{ s.nextMain?.format?.name }}</a>.
            </p>
          }
          @case ('chosen') {
            <p>Le jeu du prochain main est choisi : <strong>{{ s.pick?.game?.name }} — {{ s.pick?.name }}</strong>.</p>
          }
          @case ('open') {
            <p>
              {{ choosers(s) }} {{ s.choosers.length > 1 ? 'choisissent' : 'choisit' }} le jeu du prochain main jusqu’au {{ paris(s.deadline) }}.
              Sans choix d’ici là, le format le plus upvoté passe.
            </p>
          }
          @case ('default') {
            <p>
              @if (s.pick) {
                Faute de choix du vainqueur, le prochain main se jouera sur le format le plus upvoté :
                <strong>{{ s.pick.game.name }} — {{ s.pick.name }}</strong>.
              } @else {
                La boîte à idées est vide : <a routerLink="/idees/nouvelle" class="underline">propose un format</a>.
              }
            </p>
          }
        }

        @if (s.status !== 'scheduled' && s.candidates.length > 0) {
          <section class="flex flex-col gap-2">
            <h2 class="font-semibold">Top {{ s.candidates.length }} de la boîte à idées</h2>
            <ol class="flex flex-col gap-2">
              @for (idea of s.candidates; track idea.id; let rank = $index) {
                <li class="flex items-center gap-3 rounded-xl border bg-white p-3">
                  <span class="w-6 font-semibold text-slate-500">{{ rank + 1 }}</span>
                  <span class="grow">{{ idea.game.name }} — <strong>{{ idea.name }}</strong> · {{ idea.votes }} vote{{ idea.votes > 1 ? 's' : '' }}</span>
                  @if (s.canChoose) {
                    <button type="button" class="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white" (click)="choose(idea.id, idea.name)" [disabled]="busy()">Choisir</button>
                  }
                </li>
              }
            </ol>
          </section>
        }
      }
    </main>
  `,
})
export class GameChoicePage implements OnInit {
  private readonly api = inject(EventsApi);

  protected readonly state = signal<NextGameDto | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly paris = formatParis;

  protected choosers(state: NextGameDto): string {
    return state.choosers.map((chooser) => chooser.pseudo).join(' ou ');
  }

  async ngOnInit(): Promise<void> {
    await this.run(async () => this.state.set(await this.api.nextGame()));
  }

  async choose(formatId: string, name: string): Promise<void> {
    if (!confirm(`Choisir « ${name} » pour le prochain main ? C’est définitif.`)) return;
    await this.run(async () => this.state.set(await this.api.chooseGame(formatId)));
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
