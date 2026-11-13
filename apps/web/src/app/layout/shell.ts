import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

/** Cadre des pages connectées : barre du haut avec le joueur, puis la page. */
@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-dvh bg-slate-50 text-slate-900">
      <header class="border-b border-slate-200 bg-white">
        <nav class="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <a routerLink="/" class="text-lg font-bold tracking-tight">Porolympiques</a>
          @if (auth.me(); as me) {
            <a routerLink="/profil" class="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-slate-100">
              <img [src]="me.avatarUrl" alt="" class="size-8 rounded-full" />
              <span class="max-w-40 truncate text-sm font-medium">{{ me.pseudo }}</span>
            </a>
          }
        </nav>
      </header>
      <router-outlet />
    </div>
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
}
