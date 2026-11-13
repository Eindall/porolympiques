import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../core/auth.service';

/** Page d'accueil provisoire : le contenu (events, classement) arrive en phase 5. */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-10">
      <h1 class="text-3xl font-bold tracking-tight">Salut {{ auth.me()?.pseudo }} !</h1>
      <p class="text-slate-600">Le circuit de tournois entre potes arrive bientôt.</p>
    </main>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
}
