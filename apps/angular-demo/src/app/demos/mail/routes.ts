import type { Routes } from '@angular/router';
import { MailCompose, MailFolder, MailThread } from './mail';

/**
 * Every route is a sibling, so the route tree alone would call the folder
 * switch a push and a reply from a thread a replace. Each route names itself
 * in `data.animation`, as Angular's route-transition recipe does, and the
 * `fromAnimationData(MAIL_TRANSITIONS)` strategy in main.ts reads the pair.
 */
export const MAIL_ROUTES: Routes = [
  { path: '', component: MailFolder, data: { animation: 'Inbox', folder: 'inbox' } },
  { path: 'sent', component: MailFolder, data: { animation: 'Sent', folder: 'sent' } },
  { path: 'thread/:id', component: MailThread, data: { animation: 'Thread' } },
  { path: 'compose', component: MailCompose, data: { animation: 'Compose' } },
];
