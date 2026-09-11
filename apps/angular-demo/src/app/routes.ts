import type { Routes } from '@angular/router';
import { Home } from './pages/home';
import { Item } from './pages/item';
import { Reviews } from './pages/reviews';
import { Settings } from './pages/settings';
import { About } from './pages/about';
import { DEMO_ROUTES } from './demos/routes';

export const routes: Routes = [
  { path: '', component: Home },
  // Feed, shop, messages, gallery, forms, search, dashboard and lab: one lazy route tree each.
  ...DEMO_ROUTES,
  // The route tree decides these: /items/:id is beneath / (push), and /items/:id/reviews beneath that.
  { path: 'items/:id', component: Item },
  { path: 'items/:id/reviews', component: Reviews, canDeactivate: [(page: Reviews) => !page.lock()] },
  // Numbered screens: /settings and /about sit at the same tree depth as /,
  // but their numbers place settings above home and about above settings.
  { path: 'settings', component: Settings, data: { stackLevel: 2 } },
  { path: 'about', component: About, data: { stackLevel: 3 } },
  { path: '**', redirectTo: '' },
];
