import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AuthErrorCode } from '@porolympiques/shared';

const MESSAGES: Record<AuthErrorCode, string> = {
  not_member: "Ce compte Discord n'est pas membre du serveur Porolympiques. Rejoins le serveur, puis réessaie.",
  state: 'La connexion a expiré. Réessaie.',
  discord: "Discord n'a pas pu valider la connexion. Réessaie dans un instant.",
};

/** Seule page accessible sans session. Le bouton lance le flux OAuth (navigation complète, pas un appel XHR). */
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-dvh flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center text-slate-900">
      <div class="flex flex-col gap-2">
        <h1 class="text-4xl font-bold tracking-tight">Porolympiques</h1>
        <p class="text-slate-600">Le circuit de tournois entre potes. Réservé aux membres du serveur Discord.</p>
      </div>

      @if (message(); as text) {
        <p role="alert" class="max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ text }}</p>
      }

      <a
        href="/api/auth/discord"
        class="rounded-lg bg-[#5865F2] px-5 py-3 font-semibold text-white shadow-sm hover:bg-[#4752C4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
      >
        Se connecter avec Discord
      </a>
    </main>
  `,
})
export class LoginPage {
  /** `?error=…` posé par l'API à la fin d'un flux raté. */
  readonly error = input<string>();

  readonly message = computed(() => {
    const code = this.error();
    return code && code in MESSAGES ? MESSAGES[code as AuthErrorCode] : null;
  });
}
