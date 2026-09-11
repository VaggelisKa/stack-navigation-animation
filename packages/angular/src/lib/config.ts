import { InjectionToken, type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import type { ActivatedRouteSnapshot } from '@angular/router';
import {
  createDirectionResolver,
  defaultStrategies,
  type Direction,
  type DirectionResolver,
  type DirectionStrategy,
  type EdgePanGestureOptions,
  type IOSTransitionOptions,
} from '@stacknav/core';

/** Everything `provideStackNav()` accepts. All optional. */
export interface StackNavConfig {
  /**
   * How to decide push / pop / replace for a navigation, in the order you
   * trust them. Defaults to the core's `defaultStrategies()`: an explicit
   * hint, then browser history, then the kept stack, then route numbering
   * (`data.stackLevel`), then the route tree. Pass a resolver function to
   * take over completely.
   */
  direction?: readonly DirectionStrategy[] | DirectionResolver;
  /** What to do when no strategy has an opinion. Default `push`. */
  fallbackDirection?: Direction;
  /**
   * Where a route's number comes from, for the numbering strategy.
   * Default: `snapshot.data['stackLevel']`.
   */
  levelOf?: (snapshot: ActivatedRouteSnapshot) => number | null | undefined;
  /**
   * What identifies a page, so a later navigation to the same key pops back
   * to the kept page. Default: the route's full URL path (with matrix params).
   */
  keyOf?: (snapshot: ActivatedRouteSnapshot) => string;
  /**
   * Key under which a navigation's `info` carries a hint for this library:
   * `router.navigate(cmds, { info: { stacknav: 'pop' } })`. Default `stacknav`.
   */
  infoKey?: string;
  /** Defaults for every outlet's transition; an outlet's `transition` input overrides per key. */
  transition?: Partial<IOSTransitionOptions>;
  /** Defaults for every outlet's swipe-back gesture; `false` disables it. */
  gesture?: Partial<EdgePanGestureOptions> | false;
  /**
   * Detach change detection from pages hidden beneath the top and reattach
   * when they show again. Saves work on deep stacks. Off by default.
   */
  detachInactiveViews?: boolean;
  /** Insert the engine's stylesheet at runtime. Default true; turn off if you import `stacknav.css`. */
  injectStyles?: boolean;
  /** Animate at all. Default true. `prefers-reduced-motion` is honoured regardless. */
  animated?: boolean;
}

export interface ResolvedStackNavConfig {
  resolve: DirectionResolver;
  levelOf: (snapshot: ActivatedRouteSnapshot) => number | null | undefined;
  keyOf: (snapshot: ActivatedRouteSnapshot) => string;
  infoKey: string;
  transition: Partial<IOSTransitionOptions>;
  gesture: Partial<EdgePanGestureOptions> | false;
  detachInactiveViews: boolean;
  injectStyles: boolean;
  animated: boolean;
}

export const STACKNAV_CONFIG = new InjectionToken<ResolvedStackNavConfig>('STACKNAV_CONFIG', {
  providedIn: 'root',
  factory: () => resolveConfig({}),
});

export function defaultLevelOf(snapshot: ActivatedRouteSnapshot): number | null | undefined {
  const v = snapshot.data?.['stackLevel'];
  return typeof v === 'number' ? v : undefined;
}

/** The route's URL path from the root down to (and including) this route, e.g. `items/42;view=full`. */
export function defaultKeyOf(snapshot: ActivatedRouteSnapshot): string {
  return snapshot.pathFromRoot
    .flatMap((s) => s.url.map((u) => u.toString()))
    .join('/');
}

export function resolveConfig(c: StackNavConfig): ResolvedStackNavConfig {
  const resolve =
    typeof c.direction === 'function'
      ? c.direction
      : createDirectionResolver(c.direction ?? defaultStrategies(), c.fallbackDirection ?? 'push');
  return {
    resolve,
    levelOf: c.levelOf ?? defaultLevelOf,
    keyOf: c.keyOf ?? defaultKeyOf,
    infoKey: c.infoKey ?? 'stacknav',
    transition: c.transition ?? {},
    gesture: c.gesture ?? {},
    detachInactiveViews: c.detachInactiveViews ?? false,
    injectStyles: c.injectStyles ?? true,
    animated: c.animated ?? true,
  };
}

/**
 * Configures the outlets. Add it next to `provideRouter()`; it touches nothing
 * of the router's.
 *
 * ```ts
 * bootstrapApplication(App, { providers: [provideRouter(routes), provideStackNav()] });
 * ```
 */
export function provideStackNav(config: StackNavConfig = {}): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: STACKNAV_CONFIG, useValue: resolveConfig(config) }]);
}
