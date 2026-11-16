import { ChangeDetectionStrategy, Component, computed, inject, type OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  type IdeaDto,
  PLAY_MODE_LABELS,
  PLAY_MODES,
  PRICE_TIER_LABELS,
  PRICE_TIERS,
  TEAM_MODE_LABELS,
  TEAM_MODES,
} from '@porolympiques/shared';
import { AuthService } from '../core/auth.service';
import { IdeaCard } from './idea-card';
import { type IdeaFilters, IdeasApi, errorMessage } from './ideas.api';

/** La boîte à idées : formats triés par upvotes, avec filtres. */
@Component({
  selector: 'app-ideas-page',
  imports: [IdeaCard, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">Boîte à idées</h1>
          <p class="text-slate-600">On upvote un format, pas un jeu. Le vainqueur du dernier main choisit dans le top 5.</p>
        </div>
        <a routerLink="/idees/nouvelle" class="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">Proposer une idée</a>
      </div>

      <div class="flex flex-wrap gap-2 text-sm">
        <select aria-label="Tranche de prix" class="rounded-md border border-slate-300 bg-white px-2 py-1.5" (change)="filter('priceTier', $any($event.target).value)">
          <option value="">Tous les prix</option>
          @for (tier of priceTiers; track tier) {
            <option [value]="tier">{{ priceLabels[tier] }}</option>
          }
        </select>
        <select aria-label="Solo ou équipe" class="rounded-md border border-slate-300 bg-white px-2 py-1.5" (change)="filter('teamMode', $any($event.target).value)">
          <option value="">Solo et équipe</option>
          @for (mode of teamModes; track mode) {
            <option [value]="mode">{{ teamLabels[mode] }}</option>
          }
        </select>
        <select aria-label="Asynchrone ou live" class="rounded-md border border-slate-300 bg-white px-2 py-1.5" (change)="filter('playMode', $any($event.target).value)">
          <option value="">Asynchrone et live</option>
          @for (mode of playModes; track mode) {
            <option [value]="mode">{{ playLabels[mode] }}</option>
          }
        </select>
      </div>

      @if (error()) {
        <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
      } @else if (loading()) {
        <p class="text-slate-500">Chargement…</p>
      } @else if (ideas().length === 0) {
        <p class="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-600">
          Aucune idée {{ filtered() ? 'avec ces filtres' : 'pour l’instant' }}. <a routerLink="/idees/nouvelle" class="font-medium underline">Lance la première !</a>
        </p>
      } @else {
        <ol class="flex flex-col gap-3">
          @for (idea of ideas(); track idea.id) {
            <li><app-idea-card [idea]="idea" [isAdmin]="isAdmin()" (changed)="replace($event)" (removed)="drop($event)" /></li>
          }
        </ol>
      }
    </main>
  `,
})
export class IdeasPage implements OnInit {
  private readonly api = inject(IdeasApi);
  private readonly auth = inject(AuthService);

  protected readonly ideas = signal<IdeaDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly filters = signal<IdeaFilters>({});
  protected readonly filtered = computed(() => Object.values(this.filters()).some(Boolean));
  protected readonly isAdmin = computed(() => this.auth.me()?.role === 'admin');

  protected readonly priceTiers = PRICE_TIERS;
  protected readonly teamModes = TEAM_MODES;
  protected readonly playModes = PLAY_MODES;
  protected readonly priceLabels = PRICE_TIER_LABELS;
  protected readonly teamLabels = TEAM_MODE_LABELS;
  protected readonly playLabels = PLAY_MODE_LABELS;

  ngOnInit(): void {
    void this.load();
  }

  /** Filtre choisi dans une liste déroulante (valeur vide : pas de filtre). */
  filter(key: Exclude<keyof IdeaFilters, 'gameId'>, value: string): void {
    this.filters.update((filters) => ({ ...filters, [key]: value || undefined }));
    void this.load();
  }

  /** Une idée mise à jour (vote, correction) : remplacée sur place, sans réordonner la liste sous le doigt. */
  replace(idea: IdeaDto): void {
    this.ideas.update((ideas) => ideas.map((item) => (item.id === idea.id ? idea : item)));
  }

  drop(id: string): void {
    this.ideas.update((ideas) => ideas.filter((item) => item.id !== id));
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.ideas.set(await this.api.list(this.filters()));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
