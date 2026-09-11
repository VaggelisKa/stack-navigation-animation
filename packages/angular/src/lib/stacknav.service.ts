import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, Router, type NavigationExtras, type UrlTree } from '@angular/router';
import type { Direction } from '@stacknav/core';
import { filter, firstValueFrom, map } from 'rxjs';
import { STACKNAV_CONFIG } from './config';
import { StackNavHistory } from './history';

export interface StackNavExtras extends NavigationExtras {
  /** Sets the direction for this navigation instead of resolving it. */
  direction?: Direction | 'auto';
  /** Skip the animation for this navigation. */
  animated?: boolean;
}

/**
 * Router calls with a direction attached. Plain `router.navigate()` works too;
 * this only adds the per-navigation hint that `fromHint()` reads.
 */
@Injectable({ providedIn: 'root' })
export class StackNav {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly history = inject(StackNavHistory);
  private readonly config = inject(STACKNAV_CONFIG);

  navigate(commands: readonly unknown[], extras: StackNavExtras = {}): Promise<boolean> {
    return this.router.navigate(commands as unknown[], this.withHint(extras));
  }

  navigateByUrl(url: string | UrlTree, extras: StackNavExtras = {}): Promise<boolean> {
    return this.router.navigateByUrl(url, this.withHint(extras));
  }

  push(commands: readonly unknown[], extras: StackNavExtras = {}): Promise<boolean> {
    return this.navigate(commands, { ...extras, direction: 'push' });
  }

  replace(commands: readonly unknown[], extras: StackNavExtras = {}): Promise<boolean> {
    return this.navigate(commands, { ...extras, direction: 'replace' });
  }

  /**
   * Goes back through browser history when there is somewhere to go, otherwise
   * to `fallback`, replacing the history entry so the user does not get stuck.
   * Resolves `false` when neither is possible.
   */
  async pop(fallback?: readonly unknown[] | string | UrlTree, extras: StackNavExtras = {}): Promise<boolean> {
    if (this.history.canGoBack) {
      const done = firstValueFrom(
        this.router.events.pipe(
          filter((e) => e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError || e instanceof NavigationSkipped),
          map((e) => e instanceof NavigationEnd),
        ),
      );
      this.location.back();
      return done;
    }
    if (fallback == null) return false;
    const hinted: StackNavExtras = { replaceUrl: true, ...extras, direction: 'pop' };
    return Array.isArray(fallback) ? this.navigate(fallback, hinted) : this.navigateByUrl(fallback as string | UrlTree, hinted);
  }

  private withHint({ direction, animated, ...extras }: StackNavExtras): NavigationExtras {
    if (direction === undefined && animated === undefined) return extras;
    return { ...extras, state: { ...(extras.state ?? {}), [this.config.stateKey]: { direction, animated } } };
  }
}
