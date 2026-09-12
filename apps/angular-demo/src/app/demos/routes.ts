import type { ResolveFn, Routes } from '@angular/router';

/**
 * Every demo is a lazily loaded route tree under its own prefix, so the first
 * navigation into one also exercises `loadChildren` through the outlet.
 */
export const DEMO_ROUTES: Routes = [
  { path: 'feed', loadChildren: () => import('./feed/routes').then((m) => m.FEED_ROUTES) },
  { path: 'shop', loadChildren: () => import('./shop/routes').then((m) => m.SHOP_ROUTES) },
  { path: 'messages', loadChildren: () => import('./chat/routes').then((m) => m.CHAT_ROUTES) },
  { path: 'gallery', loadChildren: () => import('./gallery/routes').then((m) => m.GALLERY_ROUTES) },
  { path: 'forms', loadChildren: () => import('./forms/routes').then((m) => m.FORMS_ROUTES) },
  { path: 'search', loadChildren: () => import('./search/routes').then((m) => m.SEARCH_ROUTES) },
  { path: 'dashboard', loadChildren: () => import('./dashboard/routes').then((m) => m.DASHBOARD_ROUTES) },
  { path: 'mail', loadChildren: () => import('./mail/routes').then((m) => m.MAIL_ROUTES) },
  { path: 'lab', loadChildren: () => import('./lab/routes').then((m) => m.LAB_ROUTES) },
];

/** For the Lab: a resolver that deliberately takes a long time. */
export const slowResolver: ResolveFn<{ ms: number; word: string }> = () => new Promise((resolve) => setTimeout(() => resolve({ ms: 2000, word: 'patience' }), 2000));
