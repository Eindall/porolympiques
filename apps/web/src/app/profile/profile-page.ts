import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';

/** Profil minimal : pseudo et avatar (repris de Discord), et déconnexion. */
@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col items-start gap-6 px-4 py-10">
      @if (auth.me(); as me) {
        <div class="flex items-center gap-4">
          <img [src]="me.avatarUrl" alt="" class="size-20 rounded-full" />
          <div class="flex flex-col gap-1">
            <h1 class="text-2xl font-bold tracking-tight">{{ me.pseudo }}</h1>
            @if (me.role === 'admin') {
              <span class="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Admin</span>
            }
          </div>
        </div>
        <p class="text-sm text-slate-600">Ton pseudo et ton avatar viennent du serveur Discord et se mettent à jour tout seuls.</p>
      }
      <button
        type="button"
        (click)="logout()"
        [disabled]="leaving()"
        class="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium hover:bg-slate-100 disabled:opacity-50"
      >
        Se déconnecter
      </button>
    </main>
  `,
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
  protected readonly leaving = signal(false);

  async logout(): Promise<void> {
    this.leaving.set(true);
    try {
      await this.auth.logout();
    } finally {
      this.leaving.set(false);
    }
  }
}
