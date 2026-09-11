import type { Routes } from '@angular/router';
import { FeedHome, FeedPost, FeedProfile } from './feed';

export const FEED_ROUTES: Routes = [
  { path: '', component: FeedHome },
  // Both are children of /feed, so the tree pushes them. Relative to each other
  // they are siblings, so the cards push explicitly with [pushTo].
  { path: 'post/:id', component: FeedPost },
  { path: 'user/:handle', component: FeedProfile },
];
