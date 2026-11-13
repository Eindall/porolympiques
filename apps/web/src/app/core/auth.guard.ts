import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// `inject()` n'est permis qu'avant le premier `await` : les dépendances sont donc récupérées en tête de garde.

/** Toutes les pages sauf /login : sans session, direction la page de connexion. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const me = auth.me() ?? (await auth.load());
  return me ? true : router.createUrlTree(['/login']);
};

/** /login : déjà connecté, direction l'accueil. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const me = auth.me() ?? (await auth.load());
  return me ? router.createUrlTree(['/']) : true;
};
