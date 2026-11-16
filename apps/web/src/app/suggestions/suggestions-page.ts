import { ChangeDetectionStrategy, Component, computed, inject, type OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  type RoadmapDto,
  SUGGESTION_CATEGORIES,
  SUGGESTION_CATEGORY_LABELS,
  SUGGESTION_DESCRIPTION_MAX,
  SUGGESTION_STATUSES,
  SUGGESTION_TITLE_MAX,
  type SuggestionCategoryDto,
  type SuggestionDto,
  type SuggestionStatusDto,
} from '@porolympiques/shared';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../ideas/ideas.api';
import { SuggestionCard } from './suggestion-card';
import { type SuggestionFilters, SuggestionsApi } from './suggestions.api';

/** Suggestions d'amélioration : la roadmap (prévu, livré), puis les suggestions par score, avec filtres et formulaire. */
@Component({
  selector: 'app-suggestions-page',
  imports: [FormsModule, SuggestionCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">Suggestions</h1>
          <p class="text-slate-600">Une idée pour améliorer le format, le site, le bot ou l’organisation ? Propose-la, vote pour ou contre.</p>
        </div>
        @if (!formOpen()) {
          <button type="button" class="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700" (click)="formOpen.set(true)">Proposer une amélioration</button>
        }
      </div>

      @if (formOpen()) {
        <form class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4" (ngSubmit)="propose()">
          <h2 class="text-lg font-semibold">Nouvelle suggestion</h2>
          <label class="flex flex-col gap-1 text-sm font-medium">Titre
            <input name="title" [(ngModel)]="draft.title" required [maxlength]="titleMax" class="rounded-md border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label class="flex flex-col gap-1 text-sm font-medium">Description
            <textarea name="description" [(ngModel)]="draft.description" [maxlength]="descriptionMax" rows="4" class="rounded-md border border-slate-300 px-3 py-2 font-normal"></textarea>
          </label>
          <label class="flex flex-col gap-1 text-sm font-medium">Catégorie
            <select name="category" [(ngModel)]="draft.category" class="w-fit rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
              @for (category of categories; track category) {
                <option [value]="category">{{ categoryLabels[category] }}</option>
              }
            </select>
          </label>
          @if (formError()) {
            <p role="alert" class="text-sm text-red-700">{{ formError() }}</p>
          }
          <div class="flex gap-2">
            <button type="submit" [disabled]="sending() || !draft.title.trim()" class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">Proposer</button>
            <button type="button" class="rounded-md border border-slate-300 px-4 py-2 font-medium" (click)="formOpen.set(false)">Annuler</button>
          </div>
        </form>
      }

      @if (error()) {
        <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
      }

      @if (roadmap(); as road) {
        <section class="flex flex-col gap-3" aria-labelledby="roadmap-title">
          <h2 id="roadmap-title" class="text-xl font-semibold">Roadmap</h2>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="flex flex-col gap-2">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-amber-700">Prévu</h3>
              @for (item of road.planned; track item.id) {
                <app-suggestion-card [suggestion]="item" [isAdmin]="isAdmin()" (changed)="onChanged($event)" (removed)="onRemoved($event)" />
              } @empty {
                <p class="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">Rien de prévu pour l’instant.</p>
              }
            </div>
            <div class="flex flex-col gap-2">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-emerald-700">Livré</h3>
              @for (item of road.done; track item.id) {
                <app-suggestion-card [suggestion]="item" [isAdmin]="isAdmin()" (changed)="onChanged($event)" (removed)="onRemoved($event)" />
              } @empty {
                <p class="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">Rien de livré pour l’instant.</p>
              }
            </div>
          </div>
        </section>
      }

      <section class="flex flex-col gap-3" aria-labelledby="list-title">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 id="list-title" class="text-xl font-semibold">Toutes les suggestions</h2>
          <div class="flex flex-wrap gap-2 text-sm">
            <select aria-label="Catégorie" class="rounded-md border border-slate-300 bg-white px-2 py-1.5" (change)="filter('category', $any($event.target).value)">
              <option value="">Toutes les catégories</option>
              @for (category of categories; track category) {
                <option [value]="category">{{ categoryLabels[category] }}</option>
              }
            </select>
            <select aria-label="Statut" class="rounded-md border border-slate-300 bg-white px-2 py-1.5" (change)="filter('status', $any($event.target).value)">
              @for (status of statuses; track status) {
                <option [value]="status" [selected]="status === filters().status">{{ statusFilterLabels[status] }}</option>
              }
              <option value="">Tous les statuts</option>
            </select>
          </div>
        </div>
        @if (loading()) {
          <p class="text-slate-500">Chargement…</p>
        } @else {
          @for (item of suggestions(); track item.id) {
            <app-suggestion-card [suggestion]="item" [isAdmin]="isAdmin()" (changed)="onChanged($event)" (removed)="onRemoved($event)" />
          } @empty {
            <p class="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-600">Aucune suggestion {{ filtered() ? 'avec ces filtres' : 'pour l’instant' }}.</p>
          }
        }
      </section>
    </main>
  `,
})
export class SuggestionsPage implements OnInit {
  private readonly api = inject(SuggestionsApi);
  private readonly auth = inject(AuthService);

  protected readonly roadmap = signal<RoadmapDto | null>(null);
  protected readonly suggestions = signal<SuggestionDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  /** Par défaut, la liste montre les suggestions proposées : la roadmap est juste au-dessus. */
  protected readonly filters = signal<SuggestionFilters>({ status: 'proposed' });
  protected readonly filtered = computed(() => Boolean(this.filters().category) || this.filters().status !== 'proposed');
  protected readonly isAdmin = computed(() => this.auth.me()?.role === 'admin');

  protected readonly formOpen = signal(false);
  protected readonly sending = signal(false);
  protected readonly formError = signal('');
  protected draft: { title: string; description: string; category: SuggestionCategoryDto } = { title: '', description: '', category: 'site' };

  protected readonly categories = SUGGESTION_CATEGORIES;
  protected readonly statuses = SUGGESTION_STATUSES;
  protected readonly categoryLabels = SUGGESTION_CATEGORY_LABELS;
  protected readonly statusFilterLabels: Record<SuggestionStatusDto, string> = { proposed: 'Proposées', planned: 'Dans la roadmap', done: 'Livrées' };
  protected readonly titleMax = SUGGESTION_TITLE_MAX;
  protected readonly descriptionMax = SUGGESTION_DESCRIPTION_MAX;

  ngOnInit(): void {
    void this.loadAll();
  }

  filter(key: keyof SuggestionFilters, value: string): void {
    this.filters.update((filters) => ({ ...filters, [key]: value || undefined }));
    void this.loadList();
  }

  async propose(): Promise<void> {
    this.sending.set(true);
    this.formError.set('');
    try {
      await this.api.propose(this.draft);
      this.draft = { title: '', description: '', category: 'site' };
      this.formOpen.set(false);
      await this.loadList();
    } catch (error) {
      this.formError.set(errorMessage(error));
    } finally {
      this.sending.set(false);
    }
  }

  /** Un vote ou une correction : remplacée sur place, sans réordonner sous le doigt. Un changement de statut recharge tout. */
  onChanged(updated: SuggestionDto): void {
    const known = [...this.suggestions(), ...(this.roadmap()?.planned ?? []), ...(this.roadmap()?.done ?? [])].find((item) => item.id === updated.id);
    if (known && known.status !== updated.status) {
      void this.loadAll();
      return;
    }
    const swap = (items: SuggestionDto[]) => items.map((item) => (item.id === updated.id ? updated : item));
    this.suggestions.update(swap);
    this.roadmap.update((road) => road && { planned: swap(road.planned), done: swap(road.done) });
  }

  onRemoved(id: string): void {
    const keep = (items: SuggestionDto[]) => items.filter((item) => item.id !== id);
    this.suggestions.update(keep);
    this.roadmap.update((road) => road && { planned: keep(road.planned), done: keep(road.done) });
  }

  private async loadAll(): Promise<void> {
    await Promise.all([this.loadRoadmap(), this.loadList()]);
  }

  private async loadRoadmap(): Promise<void> {
    try {
      this.roadmap.set(await this.api.roadmap());
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  private async loadList(): Promise<void> {
    this.loading.set(true);
    try {
      this.suggestions.set(await this.api.list(this.filters()));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
