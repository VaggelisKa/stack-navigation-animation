import type { ResolveFn, Routes } from '@angular/router';

/**
 * Every demo is a lazily loaded route tree under its own prefix, so the first
 * navigation into one also exercises `loadChildren` through the outlet.
 */
export const DEMO_ROUTES: Routes = [
  { path: 'feed', loadChildren: () => import('./feed/routes').then((m) => m.FEED_ROUTES) },
  { path: 'gallery', loadChildren: () => import('./gallery/routes').then((m) => m.GALLERY_ROUTES) },
  { path: 'mail', loadChildren: () => import('./mail/routes').then((m) => m.MAIL_ROUTES) },
  { path: 'notes', loadChildren: () => import('./notes/routes').then((m) => m.NOTES_ROUTES) },
  { path: 'lab', loadChildren: () => import('./lab/routes').then((m) => m.LAB_ROUTES) },
];

/** For the Lab: a resolver that deliberately takes a long time. */
export const slowResolver: ResolveFn<{ ms: number; word: string }> = () =>
  new Promise((resolve) => setTimeout(() => resolve({ ms: 2000, word: 'patience' }), 2000));
