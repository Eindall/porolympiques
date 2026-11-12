import { Route } from '@angular/router';
import { HomePage } from './home/home-page';

export const appRoutes: Route[] = [
  { path: '', component: HomePage, title: 'Porolympiques' },
  { path: '**', redirectTo: '' },
];
