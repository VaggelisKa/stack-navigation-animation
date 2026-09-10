import type { Routes } from '@angular/router';
import { slowResolver } from '../routes';
import { LabDeep, LabHome, LabSlow, LabStress, LabWide } from './lab';

export const LAB_ROUTES: Routes = [
  { path: '', component: LabHome },
  { path: 'stress', component: LabStress },
  { path: 'deep/:n', component: LabDeep },
  { path: 'slow', component: LabSlow, resolve: { slowly: slowResolver } },
  { path: 'wide', component: LabWide },
];
