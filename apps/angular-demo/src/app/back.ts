import { Location } from '@angular/common';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * App-level back button: goes back through history when there is a same-origin
 * entry behind this one, otherwise, after a deep link, navigates to `fallback`
 * as a pop, replacing the entry so the user does not get stuck. None of this is
 * library API; it uses Router, Location and the browser.
 */
export function useBack(): (fallback: readonly unknown[]) => void {
  const router = inject(Router);
  const location = inject(Location);
  return (fallback) => {
    if (canGoBack()) location.back();
    else void router.navigate([...fallback], { replaceUrl: true, info: { stacknav: 'pop' } });
  };
}

/**
 * The Navigation API lists only the same-origin entries contiguous with the
 * current one, so `canGoBack` is false right after a deep link from elsewhere.
 * Browsers without it fall back to an estimate from `history.length`.
 */
function canGoBack(): boolean {
  const nav = (globalThis as { navigation?: { canGoBack: boolean } }).navigation;
  return nav ? nav.canGoBack : history.length > 1;
}
