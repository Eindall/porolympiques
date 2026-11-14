import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { coverFileError } from './ideas.api';

/** Choix d'une image de jeu (PNG, JPEG ou WebP, 2 Mo au plus), avec aperçu. Émet le fichier retenu, ou `null`. */
@Component({
  selector: 'app-cover-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-3">
      @if (preview() ?? current(); as src) {
        <img [src]="src" alt="Aperçu de l’image du jeu" class="h-20 w-15 rounded-md object-cover" />
      } @else {
        <div class="flex h-20 w-15 items-center justify-center rounded-md bg-slate-100 text-2xl" aria-hidden="true">🎮</div>
      }
      <div class="flex flex-col gap-1 text-sm">
        <label class="w-fit cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1 font-medium hover:bg-slate-50">
          {{ current() || preview() ? 'Changer l’image' : 'Choisir une image' }}
          <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" (change)="pick($any($event.target))" />
        </label>
        @if (preview() || (current() && removable())) {
          <button type="button" class="w-fit text-slate-600 hover:text-slate-900" (click)="clear()">Retirer l’image</button>
        }
        <p class="text-slate-500">PNG, JPEG ou WebP, 2 Mo au maximum.</p>
        @if (error()) {
          <p role="alert" class="text-red-700">{{ error() }}</p>
        }
      </div>
    </div>
  `,
})
export class CoverPicker {
  /** Image actuelle du jeu, s'il en a une. */
  readonly current = input<string | null>(null);
  /** Propose de retirer l'image actuelle. */
  readonly removable = input(false);
  /** Fichier choisi (`File`), image actuelle à retirer (`null`). */
  readonly picked = output<File | null>();

  protected readonly preview = signal<string | null>(null);
  protected readonly error = signal('');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  pick(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const error = coverFileError(file);
    this.error.set(error ?? '');
    if (error) return;
    this.revoke();
    this.preview.set(typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null);
    this.picked.emit(file);
  }

  clear(): void {
    this.revoke();
    this.preview.set(null);
    this.error.set('');
    this.picked.emit(null);
  }

  private revoke(): void {
    const url = this.preview();
    if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
  }
}
