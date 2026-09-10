import type { Routes } from '@angular/router';
import { FormsDone, FormsHome, FormsPreferences, FormsProfile, FormsWizard } from './forms';

export const FORMS_ROUTES: Routes = [
  { path: '', component: FormsHome },
  { path: 'profile', component: FormsProfile },
  { path: 'preferences', component: FormsPreferences },
  // The wizard's steps are siblings in the tree; their numbers order them.
  // `step` reaches the component as an input through data binding.
  { path: 'wizard/1', component: FormsWizard, data: { step: '1', stackLevel: 1 } },
  { path: 'wizard/2', component: FormsWizard, data: { step: '2', stackLevel: 2 } },
  { path: 'wizard/3', component: FormsWizard, data: { step: '3', stackLevel: 3 } },
  { path: 'wizard/done', component: FormsDone, data: { stackLevel: 4 } },
];
