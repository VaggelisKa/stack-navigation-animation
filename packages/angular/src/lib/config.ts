import { InjectionToken, type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import type { ActivatedRouteSnapshot } from '@angular/router';
import {
  createDirectionResolver,
  defaultStrategies,
  isTouchPrimary,
  type Direction,
  type DirectionResolver,
  type DirectionStrategy,
  type EdgePanGestureOptions,
  type IOSTransitionOptions,
} from '@stacknav/core';

/** Everything `provideStackNav()` accepts. All optional. */
export interface StackNavConfig {
  /**
   * Strategies that decide push / pop / replace for a navigation, in priority
   * order. Defaults to the core's `defaultStrategies()`: an explicit hint, then
   * browser history, then the kept stack, then route numbering
   * (`data.stackLevel`), then the route tree. Pass a resolver function to
   * replace the whole mechanism.
   */
  direction?: readonly DirectionStrategy[] | DirectionResolver;
  /** The direction to use when no strategy has an answer. Default `push`. */
  fallbackDirection?: Direction;
  /**
   * Where a route's number comes from, for the numbering strategy.
   * Default: `snapshot.data['stackLevel']`.
   */
  levelOf?: (snapshot: ActivatedRouteSnapshot) => number | null | undefined;
  /**
   * What identifies a page, so that a later navigation to the same key pops
   * back to the kept page. Default: the route's full URL path, including matrix
   * params.
   */
  keyOf?: (snapshot: ActivatedRouteSnapshot) => string;
  /**
   * The key under which a navigation's `info` carries a hint for this library:
   * `router.navigate(cmds, { info: { stacknav: 'pop' } })`. Default `stacknav`.
   */
  infoKey?: string;
  /** Defaults for every outlet's transition. An outlet's `transition` input overrides these per key. */
  transition?: Partial<IOSTransitionOptions>;
  /** Defaults for every outlet's swipe-back gesture. `false` disables it. */
  gesture?: Partial<EdgePanGestureOptions> | false;
  /**
   * Detaches change detection from pages hidden beneath the top and reattaches
   * it when they are shown again. Saves work on deep stacks. Off by default.
   */
  detachInactiveViews?: boolean;
  /** Inserts the engine's stylesheet at runtime. Default true. Turn it off if you import `stacknav.css`. */
  injectStyles?: boolean;
  /**
   * Whether to animate at all. Default true. `prefers-reduced-motion` is
   * honoured either way.
   *
   * `'touch'` animates only where the primary pointer is coarse — a phone or a
   * tablet — and navigates instantly on a desktop, which is the usual reason to
   * ask. A function is asked again before every navigation, so it can decide on
   * whatever the app knows: a user setting, the window's width, a route.
   *
   * ```ts
   * provideStackNav({ animated: 'touch' });
   * provideStackNav({ animated: () => settings.pageTransitions() });
   * ```
   */
  animated?: boolean | 'touch' | (() => boolean);
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
  /** Asked before every navigation. */
  animated: () => boolean;
}

export const STACKNAV_CONFIG = /*#__PURE__*/ new InjectionToken<ResolvedStackNavConfig>('STACKNAV_CONFIG', {
  providedIn: 'root',
  factory: () => resolveConfig({}),
});

export function defaultLevelOf(snapshot: ActivatedRouteSnapshot): number | null | undefined {
  const v = snapshot.data?.['stackLevel'];
  return typeof v === 'number' ? v : undefined;
}

/** The route's URL path from the root down to and including this route, e.g. `items/42;view=full`. */
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
    animated: resolveAnimated(c.animated),
  };
}

function resolveAnimated(animated: StackNavConfig['animated']): () => boolean {
  if (typeof animated === 'function') return animated;
  if (animated === 'touch') return isTouchPrimary;
  const on = animated ?? true;
  return () => on;
}

/**
 * Configures the outlets. Add it next to `provideRouter()`. It changes no
 * router configuration.
 *
 * ```ts
 * bootstrapApplication(App, { providers: [provideRouter(routes), provideStackNav()] });
 * ```
 */
export function provideStackNav(config: StackNavConfig = {}): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: STACKNAV_CONFIG, useValue: resolveConfig(config) }]);
}
