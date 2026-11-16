import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

/** Cadre des pages connectées : barre du haut avec le joueur, puis la page. */
@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-dvh bg-slate-50 text-slate-900">
      <header class="border-b border-slate-200 bg-white">
        <nav class="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div class="flex min-w-0 items-center gap-4">
            <a routerLink="/" class="shrink-0 text-lg font-bold tracking-tight">Porolympiques</a>
            <div class="flex gap-4 overflow-x-auto whitespace-nowrap text-sm font-medium text-slate-600 [scrollbar-width:none]">
              @for (link of links(); track link.path) {
                <a [routerLink]="link.path" routerLinkActive="text-slate-900 underline underline-offset-4" class="py-1 hover:text-slate-900">{{ link.label }}</a>
              }
            </div>
          </div>
          @if (auth.me(); as me) {
            <a routerLink="/profil" class="flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-1 hover:bg-slate-100 sm:pr-3" aria-label="Mon profil">
              <img [src]="me.avatarUrl" alt="" class="size-8 rounded-full" />
              <span class="hidden max-w-40 truncate text-sm font-medium sm:inline">{{ me.pseudo }}</span>
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
  protected readonly links = computed(() => [
    { path: '/events', label: 'Events' },
    { path: '/classement', label: 'Classement' },
    { path: '/idees', label: 'Boîte à idées' },
    { path: '/palmares', label: 'Palmarès' },
    { path: '/suggestions', label: 'Suggestions' },
    ...(this.auth.me()?.role === 'admin' ? [{ path: '/admin', label: 'Admin' }] : []),
  ]);
}
