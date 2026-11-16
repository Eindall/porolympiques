import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SUGGESTION_CATEGORIES,
  SUGGESTION_CATEGORY_LABELS,
  SUGGESTION_DESCRIPTION_MAX,
  SUGGESTION_STATUS_LABELS,
  SUGGESTION_TITLE_MAX,
  type SuggestionCategoryDto,
  type SuggestionDto,
  type SuggestionStatusDto,
  type SuggestionVoteDto,
} from '@porolympiques/shared';
import { errorMessage } from '../ideas/ideas.api';
import { formatParisDate } from '../core/paris-time';
import { SuggestionsApi } from './suggestions.api';

const STATUS_STYLES: Record<SuggestionStatusDto, string> = {
  proposed: 'bg-slate-100 text-slate-700',
  planned: 'bg-amber-100 text-amber-800',
  done: 'bg-emerald-100 text-emerald-800',
};

/**
 * Une suggestion : titre, catégorie, statut, description et vote pour ou contre (recliquer retire le vote).
 * L'auteur la modifie ou la supprime tant qu'elle est proposée ; l'admin toujours, et il gère la roadmap.
 */
@Component({
  selector: 'app-suggestion-card',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = suggestion();
    <article class="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div class="flex shrink-0 flex-col items-center gap-0.5" role="group" aria-label="Vote">
        <button
          type="button"
          class="rounded-md px-1.5 py-0.5 text-lg leading-none disabled:cursor-not-allowed disabled:opacity-40"
          [class]="item.myVote === 1 ? 'bg-emerald-100' : 'hover:bg-slate-100'"
          [attr.aria-pressed]="item.myVote === 1"
          [attr.aria-label]="item.myVote === 1 ? 'Retirer mon vote pour' : 'Voter pour'"
          [disabled]="busy() || !item.canVote"
          (click)="vote(1)"
        >👍</button>
        <span class="font-semibold tabular-nums" [class.text-emerald-700]="item.score > 0" [class.text-red-700]="item.score < 0" [title]="item.upvotes + ' pour, ' + item.downvotes + ' contre'">
          {{ item.score > 0 ? '+' : '' }}{{ item.score }}
        </span>
        <button
          type="button"
          class="rounded-md px-1.5 py-0.5 text-lg leading-none disabled:cursor-not-allowed disabled:opacity-40"
          [class]="item.myVote === -1 ? 'bg-red-100' : 'hover:bg-slate-100'"
          [attr.aria-pressed]="item.myVote === -1"
          [attr.aria-label]="item.myVote === -1 ? 'Retirer mon vote contre' : 'Voter contre'"
          [disabled]="busy() || !item.canVote"
          (click)="vote(-1)"
        >👎</button>
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        @if (!editing()) {
          <h3 class="font-semibold leading-tight">{{ item.title }}</h3>
          <ul class="flex flex-wrap gap-1.5 text-xs font-medium">
            <li class="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-800">{{ categoryLabels[item.category] }}</li>
            <li class="rounded-full px-2 py-0.5" [class]="statusStyles[item.status]">{{ statusLabels[item.status] }}</li>
          </ul>
          @if (item.description) {
            <p class="whitespace-pre-line text-sm text-slate-700">{{ item.description }}</p>
          }
          <p class="text-xs text-slate-500">Proposée par {{ item.author.pseudo }} le {{ date(item.createdAt) }}</p>
          @if (item.canEdit || item.canDelete || isAdmin()) {
            <div class="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              @if (isAdmin()) {
                @switch (item.status) {
                  @case ('proposed') {
                    <button type="button" class="font-medium text-amber-700 hover:text-amber-900" [disabled]="busy()" (click)="setStatus('planned')">Ajouter à la roadmap</button>
                  }
                  @case ('planned') {
                    <button type="button" class="font-medium text-emerald-700 hover:text-emerald-900" [disabled]="busy()" (click)="setStatus('done')">Marquer livrée</button>
                    <button type="button" class="font-medium text-slate-600 hover:text-slate-900" [disabled]="busy()" (click)="setStatus('proposed')">Retirer de la roadmap</button>
                  }
                  @case ('done') {
                    <button type="button" class="font-medium text-slate-600 hover:text-slate-900" [disabled]="busy()" (click)="setStatus('planned')">Remettre dans la roadmap</button>
                  }
                }
              }
              @if (item.canEdit) {
                <button type="button" class="font-medium text-slate-600 hover:text-slate-900" (click)="startEdit()">Modifier</button>
              }
              @if (item.canDelete) {
                <button type="button" class="font-medium text-red-600 hover:text-red-800" [disabled]="busy()" (click)="remove()">Supprimer</button>
              }
            </div>
          }
        } @else {
          <form class="flex flex-col gap-2 text-sm" (ngSubmit)="save()">
            <label class="flex flex-col gap-1">Titre
              <input name="title" [(ngModel)]="draft.title" required [maxlength]="titleMax" class="rounded-md border border-slate-300 px-2 py-1" />
            </label>
            <label class="flex flex-col gap-1">Description
              <textarea name="description" [(ngModel)]="draft.description" [maxlength]="descriptionMax" rows="3" class="rounded-md border border-slate-300 px-2 py-1"></textarea>
            </label>
            <select name="category" [(ngModel)]="draft.category" aria-label="Catégorie" class="w-fit rounded-md border border-slate-300 px-2 py-1">
              @for (category of categories; track category) {
                <option [value]="category">{{ categoryLabels[category] }}</option>
              }
            </select>
            <div class="flex gap-2">
              <button type="submit" [disabled]="busy()" class="rounded-md bg-slate-900 px-3 py-1 font-medium text-white disabled:opacity-50">Enregistrer</button>
              <button type="button" (click)="editing.set(false)" class="rounded-md border border-slate-300 px-3 py-1 font-medium">Annuler</button>
            </div>
          </form>
        }
        @if (error()) {
          <p role="alert" class="text-sm text-red-700">{{ error() }}</p>
        }
      </div>
    </article>
  `,
})
export class SuggestionCard {
  private readonly api = inject(SuggestionsApi);

  readonly suggestion = input.required<SuggestionDto>();
  readonly isAdmin = input(false);
  readonly changed = output<SuggestionDto>();
  readonly removed = output<string>();

  protected readonly busy = signal(false);
  protected readonly editing = signal(false);
  protected readonly error = signal('');

  protected readonly categories = SUGGESTION_CATEGORIES;
  protected readonly categoryLabels = SUGGESTION_CATEGORY_LABELS;
  protected readonly statusLabels = SUGGESTION_STATUS_LABELS;
  protected readonly statusStyles = STATUS_STYLES;
  protected readonly titleMax = SUGGESTION_TITLE_MAX;
  protected readonly descriptionMax = SUGGESTION_DESCRIPTION_MAX;
  protected readonly date = formatParisDate;

  protected draft: { title: string; description: string; category: SuggestionCategoryDto } = { title: '', description: '', category: 'site' };

  /** Recliquer sur son vote le retire. */
  async vote(value: SuggestionVoteDto): Promise<void> {
    const next = this.suggestion().myVote === value ? null : value;
    await this.run(async () => this.changed.emit(await this.api.vote(this.suggestion().id, next)));
  }

  async setStatus(status: SuggestionStatusDto): Promise<void> {
    await this.run(async () => this.changed.emit(await this.api.setStatus(this.suggestion().id, status)));
  }

  startEdit(): void {
    const { title, description, category } = this.suggestion();
    this.draft = { title, description, category };
    this.error.set('');
    this.editing.set(true);
  }

  async save(): Promise<void> {
    await this.run(async () => {
      this.changed.emit(await this.api.update(this.suggestion().id, this.draft));
      this.editing.set(false);
    });
  }

  async remove(): Promise<void> {
    if (!confirm(`Supprimer « ${this.suggestion().title} » ?`)) return;
    await this.run(async () => {
      await this.api.remove(this.suggestion().id);
      this.removed.emit(this.suggestion().id);
    });
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
