import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  type IdeaDto,
  PLAY_MODE_LABELS,
  PLAY_MODES,
  PRICE_TIER_LABELS,
  PRICE_TIERS,
  type PlayModeDto,
  type PriceTierDto,
  TEAM_MODE_LABELS,
  TEAM_MODES,
  type TeamModeDto,
  type UpdateIdeaRequest,
} from '@porolympiques/shared';
import { CoverPicker } from './cover-picker';
import { IdeasApi, errorMessage } from './ideas.api';

/**
 * Une idée de la liste : jeu, format, badges et vote. Son auteur (tant qu'elle n'est pas retenue) et l'admin
 * peuvent la modifier ; le créateur d'un jeu saisi librement gère aussi son nom et son image. L'admin la supprime.
 */
@Component({
  selector: 'app-idea-card',
  imports: [CoverPicker, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = idea();
    <article class="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
      @if (item.game.coverUrl) {
        <img [src]="item.game.coverUrl" alt="" class="h-24 w-18 shrink-0 rounded-md object-cover" />
      } @else {
        <div class="flex h-24 w-18 shrink-0 items-center justify-center rounded-md bg-slate-100 text-2xl" aria-hidden="true">🎮</div>
      }

      <div class="flex min-w-0 flex-1 flex-col gap-2">
        @if (!editing()) {
          <div>
            <p class="text-sm text-slate-500">{{ item.game.name }}</p>
            <h2 class="text-lg font-semibold leading-tight">{{ item.name }}</h2>
          </div>
          <ul class="flex flex-wrap gap-1.5 text-xs font-medium">
            @if (item.game.priceTier) {
              <li class="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">{{ priceLabels[item.game.priceTier] }}</li>
            }
            <li class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{{ teamLabels[item.teamMode] }}</li>
            <li class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{{ playLabels[item.playMode] }}</li>
            @if (item.status === 'selected') {
              <li class="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Retenu</li>
            }
            @if (item.playedCount > 0) {
              <li class="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-800">Joué {{ item.playedCount }} fois</li>
            }
          </ul>
          @if (item.description) {
            <p class="whitespace-pre-line text-sm text-slate-700">{{ item.description }}</p>
          }
          @if (item.suggestedBy) {
            <p class="text-xs text-slate-500">Proposé par {{ item.suggestedBy.pseudo }}</p>
          }
          @if (item.canEdit || isAdmin()) {
            <div class="flex gap-3 text-sm">
              @if (item.canEdit) {
                <button type="button" class="font-medium text-slate-600 hover:text-slate-900" (click)="startEdit()">Modifier</button>
              }
              @if (isAdmin()) {
                <button type="button" class="font-medium text-red-600 hover:text-red-800" (click)="remove()" [disabled]="busy()">Supprimer</button>
              }
            </div>
          }
        } @else {
          <form class="flex flex-col gap-2 text-sm" (ngSubmit)="save()">
            @if (item.game.canEdit) {
              <label class="flex flex-col gap-1">Jeu
                <input name="gameName" [(ngModel)]="draft.gameName" required maxlength="200" class="rounded-md border border-slate-300 px-2 py-1" />
              </label>
              <app-cover-picker [current]="item.game.coverUrl" [removable]="true" (picked)="cover = $event" />
            }
            <label class="flex flex-col gap-1">Format
              <input name="name" [(ngModel)]="draft.name" required maxlength="100" class="rounded-md border border-slate-300 px-2 py-1" />
            </label>
            <label class="flex flex-col gap-1">Description
              <textarea name="description" [(ngModel)]="draft.description" maxlength="1000" rows="3" class="rounded-md border border-slate-300 px-2 py-1"></textarea>
            </label>
            <div class="flex flex-wrap gap-2">
              @if (isAdmin()) {
                <select name="priceTier" [(ngModel)]="draft.priceTier" aria-label="Tranche de prix" class="rounded-md border border-slate-300 px-2 py-1">
                  @for (tier of priceTiers; track tier) {
                    <option [value]="tier">{{ priceLabels[tier] }}</option>
                  }
                </select>
              }
              <select name="teamMode" [(ngModel)]="draft.teamMode" aria-label="Solo ou équipe" class="rounded-md border border-slate-300 px-2 py-1">
                @for (mode of teamModes; track mode) {
                  <option [value]="mode">{{ teamLabels[mode] }}</option>
                }
              </select>
              <select name="playMode" [(ngModel)]="draft.playMode" aria-label="Asynchrone ou live" class="rounded-md border border-slate-300 px-2 py-1">
                @for (mode of playModes; track mode) {
                  <option [value]="mode">{{ playLabels[mode] }}</option>
                }
              </select>
            </div>
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

      <button
        type="button"
        class="flex h-fit min-w-14 flex-col items-center rounded-lg border px-2 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        [class]="item.votedByMe ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'"
        [attr.aria-pressed]="item.votedByMe"
        [attr.aria-label]="voteLabel()"
        [title]="frozen() ? 'Retenu pour un event : votes gelés jusqu’à sa clôture' : ''"
        [disabled]="busy() || frozen()"
        (click)="toggleVote()"
      >
        <span aria-hidden="true">▲</span>
        <span>{{ item.votes }}</span>
      </button>
    </article>
  `,
})
export class IdeaCard {
  private readonly api = inject(IdeasApi);

  readonly idea = input.required<IdeaDto>();
  readonly isAdmin = input(false);
  readonly changed = output<IdeaDto>();
  readonly removed = output<string>();

  protected readonly busy = signal(false);
  protected readonly editing = signal(false);
  protected readonly error = signal('');
  protected readonly frozen = computed(() => this.idea().status === 'selected');
  protected readonly voteLabel = computed(() => {
    const { votes, votedByMe } = this.idea();
    return `${votes} vote${votes > 1 ? 's' : ''}${votedByMe ? ', retirer mon vote' : ', voter'}`;
  });

  protected readonly priceTiers = PRICE_TIERS;
  protected readonly teamModes = TEAM_MODES;
  protected readonly playModes = PLAY_MODES;
  protected readonly priceLabels = PRICE_TIER_LABELS;
  protected readonly teamLabels = TEAM_MODE_LABELS;
  protected readonly playLabels = PLAY_MODE_LABELS;

  protected draft: {
    name: string;
    description: string;
    teamMode: TeamModeDto;
    playMode: PlayModeDto;
    priceTier: PriceTierDto;
    gameName: string;
  } = { name: '', description: '', teamMode: 'solo', playMode: 'async', priceTier: 'free', gameName: '' };
  /** Image choisie pendant la modification : un fichier à envoyer, `null` pour retirer l'image, rien sinon. */
  protected cover: File | null | undefined;

  async toggleVote(): Promise<void> {
    await this.run(async () => this.changed.emit(await this.api.vote(this.idea().id, !this.idea().votedByMe)));
  }

  startEdit(): void {
    const idea = this.idea();
    this.draft = {
      name: idea.name,
      description: idea.description,
      teamMode: idea.teamMode,
      playMode: idea.playMode,
      priceTier: idea.game.priceTier ?? 'free',
      gameName: idea.game.name,
    };
    this.cover = undefined;
    this.error.set('');
    this.editing.set(true);
  }

  async save(): Promise<void> {
    const { gameName, priceTier, name, description, teamMode, playMode } = this.draft;
    const { game } = this.idea();
    const request: UpdateIdeaRequest = {
      name,
      description,
      teamMode,
      playMode,
      ...(this.isAdmin() && { priceTier }),
      ...(game.canEdit && { gameName }),
    };
    await this.run(async () => {
      let idea = await this.api.update(this.idea().id, request);
      if (game.canEdit && this.cover !== undefined) {
        const updatedGame = this.cover ? await this.api.uploadCover(game.id, this.cover) : await this.api.removeCover(game.id);
        idea = { ...idea, game: updatedGame };
      }
      this.changed.emit(idea);
      this.editing.set(false);
    });
  }

  async remove(): Promise<void> {
    if (!confirm(`Supprimer « ${this.idea().name} » (${this.idea().game.name}) et ses votes ?`)) return;
    await this.run(async () => {
      await this.api.remove(this.idea().id);
      this.removed.emit(this.idea().id);
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
