import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';
import { HomePage } from './home/home-page';
import { Shell } from './layout/shell';
import { LoginPage } from './login/login-page';
import { ProfilePage } from './profile/profile-page';

export const appRoutes: Route[] = [
  { path: 'login', component: LoginPage, canActivate: [guestGuard], title: 'Connexion · Porolympiques' },
  {
    // Mur de connexion : aucune page n'est publique, à part /login.
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', component: HomePage, title: 'Porolympiques' },
      { path: 'profil', component: ProfilePage, title: 'Mon profil · Porolympiques' },
    ],
  },
  { path: '**', redirectTo: '' },
];
