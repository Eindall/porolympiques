import { Route } from '@angular/router';
import { AdminEventPage } from './admin/admin-event-page';
import { AdminPage } from './admin/admin-page';
import { adminGuard, authGuard, guestGuard } from './core/auth.guard';
import { EventPage } from './events/event-page';
import { EventsPage } from './events/events-page';
import { GameChoicePage } from './events/game-choice-page';
import { HomePage } from './home/home-page';
import { IdeasPage } from './ideas/ideas-page';
import { NewIdeaPage } from './ideas/new-idea-page';
import { HallOfFamePage } from './players/hall-of-fame-page';
import { PlayerPage } from './players/player-page';
import { StandingsPage } from './standings/standings-page';
import { SuggestionsPage } from './suggestions/suggestions-page';
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
      { path: 'idees', component: IdeasPage, title: 'Boîte à idées · Porolympiques' },
      { path: 'idees/nouvelle', component: NewIdeaPage, title: 'Proposer une idée · Porolympiques' },
      { path: 'events', component: EventsPage, title: 'Events · Porolympiques' },
      { path: 'events/:id', component: EventPage, title: 'Event · Porolympiques' },
      { path: 'classement', component: StandingsPage, title: 'Classement · Porolympiques' },
      { path: 'joueurs/:id', component: PlayerPage, title: 'Joueur · Porolympiques' },
      { path: 'suggestions', component: SuggestionsPage, title: 'Suggestions · Porolympiques' },
      { path: 'palmares', component: HallOfFamePage, title: 'Palmarès · Porolympiques' },
      { path: 'choix-du-jeu', component: GameChoicePage, title: 'Prochain jeu · Porolympiques' },
      { path: 'profil', component: ProfilePage, title: 'Mon profil · Porolympiques' },
      { path: 'admin', component: AdminPage, canActivate: [adminGuard], title: 'Admin · Porolympiques' },
      { path: 'admin/events/:id', component: AdminEventPage, canActivate: [adminGuard], title: 'Gérer un event · Porolympiques' },
    ],
  },
  { path: '**', redirectTo: '' },
];
