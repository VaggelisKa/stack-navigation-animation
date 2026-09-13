import type { Routes } from '@angular/router';
import { DashActivity, DashMember, DashOverview, DashShell, DashTeam } from './dashboard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: DashShell,
    // Rendered by the stack inside the shell, not by the app's. Siblings, so a tab switch replaces.
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', component: DashOverview },
      { path: 'activity', component: DashActivity },
      { path: 'team', component: DashTeam },
    ],
  },
  // A top-level route, so it pushes over the whole shell.
  { path: 'team/:id', component: DashMember },
];
