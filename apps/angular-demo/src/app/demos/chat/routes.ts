import type { Routes } from '@angular/router';
import { ChatInbox, ChatThread } from './chat';

export const CHAT_ROUTES: Routes = [
  { path: '', component: ChatInbox },
  { path: ':id', component: ChatThread },
];
