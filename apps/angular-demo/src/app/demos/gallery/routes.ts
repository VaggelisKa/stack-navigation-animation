import type { Routes } from '@angular/router';
import { GalleryGrid, GalleryPhoto } from './gallery';

export const GALLERY_ROUTES: Routes = [
  { path: '', component: GalleryGrid },
  { path: ':id', component: GalleryPhoto },
];
