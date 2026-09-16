import { provideZonelessChangeDetection } from '@angular/core';

/**
 * The providers every TestBed in this package starts with. There is no zone.js
 * here: the library never patches one and never depends on one, and zoneless
 * keeps the tests to explicit `detectChanges()` calls.
 */
export default [provideZonelessChangeDetection()];
