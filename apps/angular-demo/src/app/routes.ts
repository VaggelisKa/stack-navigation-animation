import type { Routes } from '@angular/router';
import { Home } from './pages/home';
import { Item } from './pages/item';
import { Reviews } from './pages/reviews';
import { Settings } from './pages/settings';
import { About } from './pages/about';

export const routes: Routes = [
  { path: '', component: Home },
  // The route tree decides these: /items/:id is beneath / (push), /items/:id/reviews beneath that.
  { path: 'items/:id', component: Item },
  { path: 'items/:id/reviews', component: Reviews, canDeactivate: [(page: Reviews) => !page.lock()] },
  // Numbered screens: /settings and /about sit at the same tree depth as /,
  // but their numbers say settings is above home and about is above settings.
  { path: 'settings', component: Settings, data: { stackLevel: 2 } },
  { path: 'about', component: About, data: { stackLevel: 3 } },
  { path: '**', redirectTo: '' },
];
