import { segmentsOf, type Direction, type DirectionResolver, type DirectionStrategy, type EdgePanGestureOptions, type IOSTransitionOptions, type RouteRef } from '@stacknav/core';
import { forwardRef, useCallback, useMemo, useRef, type CSSProperties, type ForwardedRef, type ReactNode } from 'react';
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigate, useNavigationType, useParams, useRoutes, type Location, type RouteMatch, type RouteObject } from 'react-router';
import { createHistoryTracker } from './history-tracker.ts';
import { readHint } from './hint.ts';
import { StackNav, useStackNav as useStackNavHandle, type StackNavActivation, type StackNavHandle } from './stack-nav.tsx';
import type { StackPage } from './model.ts';

/** What the outlet knows about a page, passed to direction strategies. */
export interface StackRoutesRouteRef extends RouteRef {
  /** the location the page was last shown at */
  location: Location;
  /** the matched routes, deepest last, or null when nothing matched */
  matches: RouteMatch[] | null;
}

/** A page the outlet keeps alive. */
export type StackRoutesPage = StackPage<StackRoutesRouteRef>;
/** An activation, with the direction that was resolved for it. */
export type StackRoutesActivation = StackNavActivation<StackRoutesRouteRef>;
/** What `ref` and `useStackNav()` give access to. */
export type StackRoutesHandle = StackNavHandle<StackRoutesRouteRef>;

export interface StackRoutesProps {
  /** `<Route>` elements, as for `<Routes>`. */
  children?: ReactNode;
  /** Route objects, as for `useRoutes()`. Takes precedence over `children`. */
  routes?: RouteObject[];
  /**
   * What identifies a page, so that a later navigation to the same key pops
   * back to the kept page. Default: the pathname.
   */
  keyOf?: (location: Location) => string;
  /**
   * Where a route's number comes from, for the numbering strategy. Default:
   * `handle.stackLevel` of the deepest matched route.
   */
  levelOf?: (matches: RouteMatch[] | null, location: Location) => number | null | undefined;
  /**
   * The key under which `location.state` carries a hint for this library:
   * `navigate('/x', { state: { stacknav: 'pop' } })`. Default `stacknav`.
   */
  stateKey?: string;
  /**
   * Strategies that decide push / pop / replace, in priority order, or one
   * resolver function. Defaults to the core's `defaultStrategies()`.
   */
  direction?: readonly DirectionStrategy[] | DirectionResolver;
  /** Used when no strategy has an answer. Default `push`. */
  fallbackDirection?: Direction;
  /**
   * `createIOSTransition` options. The same options are CSS custom properties
   * (`--sn-duration`, `--sn-easing`, `--sn-parallax`, …) read off the outlet,
   * and a variable that is set wins over the option here.
   */
  transition?: Partial<IOSTransitionOptions>;
  /** `createEdgePanGesture` options. `false` disables swiping back. */
  gesture?: Partial<EdgePanGestureOptions> | false;
  /** Whether to animate at all. Default true. `prefers-reduced-motion` is honoured either way. */
  animated?: boolean;
  /** Inserts the core stylesheet at runtime. Default true. Turn it off if you import `@stacknav/core/stacknav.css`. */
  injectStyles?: boolean;
  /** Every activation, with the direction that was resolved for it. */
  onNavigate?: (activation: StackRoutesActivation) => void;
  className?: string;
  style?: CSSProperties;
}

export function defaultKeyOf(location: Location): string {
  return location.pathname;
}

export function defaultLevelOf(matches: RouteMatch[] | null): number | null | undefined {
  const handle = matches?.[matches.length - 1]?.route.handle as { stackLevel?: unknown } | undefined;
  const v = handle?.stackLevel;
  return typeof v === 'number' ? v : undefined;
}

const toPath = (l: Location) => ({ pathname: l.pathname, search: l.search, hash: l.hash });

/**
 * React Router's `<Routes>` with the iOS push/pop transition: an outlet, not a
 * router. Use it where you would use `<Routes>`; the router keeps doing
 * everything it does (`<Link>`, `useNavigate`, `useParams`, browser history),
 * and this only changes what happens when the location changes: the page that
 * was showing stays alive beneath the new one, the change is animated, and a
 * swipe from the leading edge pops, through `navigate(-1)`.
 *
 * ```tsx
 * <BrowserRouter>
 *   <StackRoutes style={{ height: '100dvh' }}>
 *     <Route path="/" element={<Home />} />
 *     <Route path="items/:id" element={<Item />} />
 *   </StackRoutes>
 * </BrowserRouter>
 * ```
 *
 * Pages beneath the top are rendered at the location they were reached at,
 * through `useRoutes(routes, location)`, so `useLocation()`, `useParams()` and
 * relative links inside them keep answering for that page.
 *
 * Declarative mode only: data routers render loader data per route id, which
 * cannot describe two pages of the same route kept alive at once.
 */
function StackRoutesImpl({ children, routes, keyOf = defaultKeyOf, levelOf = defaultLevelOf, stateKey = 'stacknav', ...rest }: StackRoutesProps, ref: ForwardedRef<StackRoutesHandle>) {
  const location = useLocation();
  const action = useNavigationType();
  const navigate = useNavigate();
  const params = useParams();
  const tracker = useRef(createHistoryTracker()).current;

  const routeObjects = useMemo(() => routes ?? createRoutesFromChildren(children), [routes, children]);
  const element = useRoutes(routeObjects, location);

  const key = keyOf(location);
  // Nested under a splat route (`/feed/*`), the routes here are matched against
  // what the splat caught, which is what the router exposes it as.
  const splat = params['*'];
  const remaining = splat != null ? '/' + splat : location.pathname;
  const route = useMemo<StackRoutesRouteRef>(() => {
    const matches = matchRoutes(routeObjects, { pathname: remaining });
    return { key, segments: segmentsOf(location.pathname), level: levelOf(matches, location), location, matches };
  }, [key, location, routeObjects, remaining, levelOf]);

  // Idempotent per location key, so safe during render.
  const record = tracker.record(location.key, action);
  const hint = action === 'POP' ? undefined : readHint(location.state, stateKey);
  const navigation = useMemo(() => ({ trigger: record.trigger, historyDelta: record.historyDelta, hint: hint?.direction, animated: hint?.animated }), [record, hint?.direction, hint?.animated]);

  // The swipe already revealed the page beneath. Bring the router in line with it.
  const onSwipeBack = useCallback(
    (revealed: StackRoutesPage) => {
      if (tracker.previousKey != null && tracker.previousKey === revealed.route.location.key) void navigate(-1);
      else void navigate(toPath(revealed.route.location), { replace: true, state: { [stateKey]: { direction: 'pop', animated: false } } });
    },
    [tracker, navigate, stateKey],
  );

  return (
    <StackNav<StackRoutesRouteRef> ref={ref} route={route} navigation={navigation} onSwipeBack={onSwipeBack} {...rest}>
      {element}
    </StackNav>
  );
}

export const StackRoutes = forwardRef(StackRoutesImpl);

/**
 * The state of the nearest `<StackRoutes>`: its kept pages, whether it can
 * pop, and the core stack. Re-renders when pages come and go.
 */
export function useStackNav(): StackRoutesHandle {
  return useStackNavHandle<StackRoutesRouteRef>();
}
export type { StackNavHint } from './hint.ts';
