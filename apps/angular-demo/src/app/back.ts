import { Location } from '@angular/common';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * App-level back button: history back when this app navigated here, else
 * (after a deep link) go to `fallback` as a pop, replacing the entry so the
 * user is not stuck. Nothing here is library API; it is Router and Location.
 */
export function useBack(): (fallback: readonly unknown[]) => void {
  const router = inject(Router);
  const location = inject(Location);
  return (fallback) => {
    if (router.lastSuccessfulNavigation()?.previousNavigation) location.back();
    else void router.navigate([...fallback], { replaceUrl: true, info: { stacknav: 'pop' } });
  };
}
