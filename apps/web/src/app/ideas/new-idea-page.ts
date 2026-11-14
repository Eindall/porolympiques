import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  type GameChoiceDto,
  type GameSearchResultDto,
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
} from '@porolympiques/shared';
import { CoverPicker } from './cover-picker';
import { IdeasApi, errorMessage } from './ideas.api';

/** Délai après la dernière frappe avant de lancer la recherche. */
export const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_LENGTH = 2;

/** Le jeu choisi : un résultat de l'autocomplete, ou un nom saisi librement. */
type ChosenGame = { kind: 'result'; result: GameSearchResultDto } | { kind: 'custom'; name: string };

/** Formulaire de suggestion : le jeu par autocomplete (ou saisi librement), puis le format. */
@Component({
  selector: 'app-new-idea-page',
  imports: [CoverPicker, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <a routerLink="/idees" class="text-sm text-slate-500 hover:text-slate-800">← Boîte à idées</a>
        <h1 class="text-3xl font-bold tracking-tight">Proposer une idée</h1>
        <p class="text-slate-600">Un jeu, et une façon d'y jouer ensemble. Ton vote est compté d'office.</p>
      </div>

      <section class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold">1. Le jeu</h2>
        @if (game(); as chosen) {
          <div class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            @if (chosen.kind === 'result' && chosen.result.coverUrl) {
              <img [src]="chosen.result.coverUrl" alt="" class="h-16 w-12 rounded object-cover" />
            }
            <div class="flex-1">
              <p class="font-semibold" data-testid="chosen-game">{{ gameName() }}</p>
              <p class="text-sm text-slate-500">{{ chosen.kind === 'custom' ? 'Saisi à la main (hors catalogue)' : chosen.result.year ?? '' }}</p>
            </div>
            <button type="button" class="text-sm font-medium text-slate-600 hover:text-slate-900" (click)="changeGame()">Changer</button>
          </div>

          @if (chosen.kind === 'custom') {
            <div class="flex flex-col gap-1">
              <p class="font-medium">Image du jeu <span class="text-sm font-normal text-slate-500">(facultative)</span></p>
              <app-cover-picker (picked)="cover = $event" />
            </div>
          }

          @if (existing().length > 0) {
            <div class="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <p class="font-medium">Déjà proposés pour ce jeu : un vote vaut peut-être mieux qu'un doublon.</p>
              <ul class="mt-1 list-inside list-disc" data-testid="existing-formats">
                @for (idea of existing(); track idea.id) {
                  <li>{{ idea.name }} · {{ idea.votes }} vote{{ idea.votes > 1 ? 's' : '' }}</li>
                }
              </ul>
            </div>
          }
        } @else {
          <div class="relative">
            <input
              type="search"
              role="combobox"
              aria-label="Rechercher un jeu"
              aria-autocomplete="list"
              aria-controls="game-results"
              [attr.aria-expanded]="query().trim().length >= minLength"
              placeholder="Rechercher un jeu…"
              autocomplete="off"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              [value]="query()"
              (input)="onQuery($any($event.target).value)"
            />
            @if (query().trim().length >= minLength) {
              <ul id="game-results" role="listbox" class="mt-2 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
                @if (searching()) {
                  <li class="px-3 py-2 text-sm text-slate-500">Recherche…</li>
                }
                @for (result of results(); track (result.gameId ?? '') + (result.externalId ?? '')) {
                  <li role="option" aria-selected="false">
                    <button type="button" class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50" (click)="choose(result)">
                      @if (result.coverUrl) {
                        <img [src]="result.coverUrl" alt="" class="h-10 w-8 rounded object-cover" />
                      } @else {
                        <span class="flex h-10 w-8 items-center justify-center rounded bg-slate-100" aria-hidden="true">🎮</span>
                      }
                      <span class="flex-1">
                        {{ result.name }}
                        @if (result.year) {
                          <span class="text-slate-500">({{ result.year }})</span>
                        }
                      </span>
                      @if (result.gameId) {
                        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Déjà sur le site</span>
                      }
                    </button>
                  </li>
                }
                <li role="option" aria-selected="false" class="border-t border-slate-100">
                  <button type="button" class="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" (click)="chooseCustom()">
                    Pas dans la liste ? Ajouter « {{ query().trim() }} » à la main
                  </button>
                </li>
              </ul>
              @if (!catalogAvailable()) {
                <p class="mt-2 text-sm text-amber-800">Le catalogue de jeux ne répond pas : seuls les jeux déjà sur le site sont proposés.</p>
              }
            }
          </div>
        }
      </section>

      @if (saved()) {
        <div class="flex flex-col gap-2 rounded-xl bg-amber-50 p-4 text-amber-900">
          <p role="alert">{{ error() }}</p>
          <a routerLink="/idees" class="font-medium underline">Voir la boîte à idées</a>
        </div>
      } @else if (game()) {
        <form class="flex flex-col gap-4" (ngSubmit)="submit()">
          <h2 class="text-lg font-semibold">2. Le format</h2>

          @if (lockedPriceTier(); as tier) {
            <p class="text-sm text-slate-600">Prix : <span class="font-medium">{{ priceLabels[tier] }}</span> (déjà fixé pour ce jeu)</p>
          } @else {
            <fieldset class="flex flex-col gap-2">
              <legend class="mb-1 font-medium">Prix du jeu</legend>
              <div class="flex flex-wrap gap-2">
                @for (tier of priceTiers; track tier) {
                  <label class="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 has-checked:border-slate-900">
                    <input type="radio" name="priceTier" [value]="tier" [(ngModel)]="priceTier" required /> {{ priceLabels[tier] }}
                  </label>
                }
              </div>
            </fieldset>
          }

          <label class="flex flex-col gap-1 font-medium">
            Nom du format
            <input name="name" [(ngModel)]="name" required maxlength="100" placeholder="Speedrun any%, Fallen Kingdom…" class="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" />
          </label>
          <label class="flex flex-col gap-1 font-medium">
            Description <span class="text-sm font-normal text-slate-500">(facultative)</span>
            <textarea name="description" [(ngModel)]="description" maxlength="1000" rows="4" placeholder="Les règles en deux mots, comment on départage…" class="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"></textarea>
          </label>

          <div class="flex flex-wrap gap-6">
            <fieldset class="flex flex-col gap-1">
              <legend class="mb-1 font-medium">Solo ou équipe</legend>
              @for (mode of teamModes; track mode) {
                <label class="flex items-center gap-2"><input type="radio" name="teamMode" [value]="mode" [(ngModel)]="teamMode" /> {{ teamLabels[mode] }}</label>
              }
            </fieldset>
            <fieldset class="flex flex-col gap-1">
              <legend class="mb-1 font-medium">Asynchrone ou live</legend>
              @for (mode of playModes; track mode) {
                <label class="flex items-center gap-2"><input type="radio" name="playMode" [value]="mode" [(ngModel)]="playMode" /> {{ playLabels[mode] }}</label>
              }
            </fieldset>
          </div>

          @if (error()) {
            <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
          }
          <button type="submit" [disabled]="submitting()" class="self-start rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            Proposer
          </button>
        </form>
      }
    </main>
  `,
})
export class NewIdeaPage {
  private readonly api = inject(IdeasApi);
  private readonly router = inject(Router);

  protected readonly minLength = SEARCH_MIN_LENGTH;
  protected readonly query = signal('');
  protected readonly results = signal<GameSearchResultDto[]>([]);
  protected readonly catalogAvailable = signal(true);
  protected readonly searching = signal(false);
  protected readonly game = signal<ChosenGame | null>(null);
  protected readonly existing = signal<IdeaDto[]>([]);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  /** Idée enregistrée, mais pas son image : on reste sur la page pour le dire. */
  protected readonly saved = signal(false);
  /** Image facultative pour un jeu saisi librement. */
  protected cover: File | null = null;

  protected readonly gameName = computed(() => {
    const game = this.game();
    return game?.kind === 'custom' ? game.name : (game?.result.name ?? '');
  });
  protected readonly lockedPriceTier = computed(() => {
    const game = this.game();
    return game?.kind === 'result' ? game.result.priceTier : null;
  });

  protected priceTier: PriceTierDto | null = null;
  protected name = '';
  protected description = '';
  protected teamMode: TeamModeDto = 'solo';
  protected playMode: PlayModeDto = 'async';

  protected readonly priceTiers = PRICE_TIERS;
  protected readonly teamModes = TEAM_MODES;
  protected readonly playModes = PLAY_MODES;
  protected readonly priceLabels = PRICE_TIER_LABELS;
  protected readonly teamLabels = TEAM_MODE_LABELS;
  protected readonly playLabels = PLAY_MODE_LABELS;

  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Numéro de la dernière recherche lancée : une réponse plus ancienne, arrivée en retard, est ignorée. */
  private searchId = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  onQuery(value: string): void {
    this.query.set(value);
    clearTimeout(this.timer);
    if (value.trim().length < SEARCH_MIN_LENGTH) {
      this.results.set([]);
      return;
    }
    this.timer = setTimeout(() => void this.search(value.trim()), SEARCH_DEBOUNCE_MS);
  }

  choose(result: GameSearchResultDto): void {
    this.game.set({ kind: 'result', result });
    void this.loadExisting(result.gameId);
  }

  chooseCustom(): void {
    this.game.set({ kind: 'custom', name: this.query().trim() });
    this.existing.set([]);
  }

  changeGame(): void {
    this.game.set(null);
    this.existing.set([]);
    this.priceTier = null;
    this.cover = null;
  }

  async submit(): Promise<void> {
    const game = this.game();
    if (!game) return;
    if (!this.name.trim()) return this.error.set('Donne un nom au format.');
    if (!this.lockedPriceTier() && !this.priceTier) return this.error.set('Choisis la tranche de prix du jeu.');

    this.submitting.set(true);
    this.error.set('');
    try {
      const idea = await this.api.suggest({
        game: toGameChoice(game),
        priceTier: this.lockedPriceTier() ? null : this.priceTier,
        name: this.name,
        description: this.description,
        teamMode: this.teamMode,
        playMode: this.playMode,
      });
      if (this.cover && !(await this.sendCover(idea))) return;
      await this.router.navigateByUrl('/idees');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

  /** Envoie l'image du jeu saisi librement. Faux si elle n'a pas pu l'être : l'idée, elle, est déjà enregistrée. */
  private async sendCover(idea: IdeaDto): Promise<boolean> {
    if (!idea.game.canEdit) {
      this.error.set('Ton idée est enregistrée. Ce jeu existait déjà sur le site : son image est gérée par celui qui l’a ajouté.');
      this.saved.set(true);
      return false;
    }
    try {
      await this.api.uploadCover(idea.game.id, this.cover as File);
      return true;
    } catch (error) {
      this.error.set(`Ton idée est enregistrée, mais pas l’image : ${errorMessage(error)} Tu peux la remettre avec « Modifier ».`);
      this.saved.set(true);
      return false;
    }
  }

  private async search(query: string): Promise<void> {
    const id = ++this.searchId;
    this.searching.set(true);
    try {
      const { results, catalogAvailable } = await this.api.searchGames(query);
      if (id !== this.searchId) return;
      this.results.set(results);
      this.catalogAvailable.set(catalogAvailable);
    } catch {
      if (id !== this.searchId) return;
      this.results.set([]);
      this.catalogAvailable.set(false);
    } finally {
      if (id === this.searchId) this.searching.set(false);
    }
  }

  private async loadExisting(gameId: string | null): Promise<void> {
    this.existing.set([]);
    if (!gameId) return;
    try {
      this.existing.set(await this.api.list({ gameId }));
    } catch {
      // Simple aide contre les doublons : sans elle, le serveur refuse quand même un doublon exact.
    }
  }
}

function toGameChoice(game: ChosenGame): GameChoiceDto {
  if (game.kind === 'custom') return { kind: 'custom', name: game.name };
  const { gameId, externalId } = game.result;
  if (gameId) return { kind: 'existing', gameId };
  return { kind: 'catalog', externalId: externalId as string };
}
