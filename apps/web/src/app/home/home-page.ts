import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Page d'accueil provisoire (phase 1) : elle prouve seulement que le site est en ligne. */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center text-slate-900">
      <h1 class="text-4xl font-bold tracking-tight">Porolympiques</h1>
      <p class="text-slate-600">Le circuit de tournois entre potes arrive bientôt.</p>
    </main>
  `,
})
export class HomePage {}
