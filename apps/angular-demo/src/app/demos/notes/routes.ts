import type { Routes } from '@angular/router';
import { NotesList, NotesNote } from './notes';

export const NOTES_ROUTES: Routes = [
  { path: '', component: NotesList },
  // A child of /notes, so the tree pushes it over the list, which keeps its scroll offset and its collapsed header.
  { path: ':id', component: NotesNote },
];
