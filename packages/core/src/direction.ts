/**
 * Direction resolution: given where the app is and where it is going, decide
 * whether the new page should *push* over the current one, *pop* back to it,
 * or *replace* it. The engine never decides this on its own; a host wires a
 * list of strategies in the order it trusts them, and the first opinion wins.
 *
 * Strategies are plain functions, so a host can add its own (a numbering
 * scheme, a route-tree walk, a per-navigation hint) without touching the rest.
 */

export type Direction = 'push' | 'pop' | 'replace';

/** What a strategy may answer: a direction, or no opinion (`'auto'`, `undefined`, `null`). */
export type DirectionOpinion = Direction | 'auto' | undefined | null | void;

/** The little a strategy needs to know about a page. Hosts may attach more. */
export interface RouteRef {
  /** stable identity of the page: its URL, a route id, anything unique */
  key: string;
  /** the page's position in the route tree, e.g. URL segments (`['items', '42']`) */
  segments?: readonly string[];
  /** an explicit number when the app numbers its screens: bigger is deeper */
  level?: number | null;
  /** anything the host wants strategies to see (route data, params) */
  data?: Record<string, unknown>;
}

export type NavigationTrigger = 'imperative' | 'history';

export interface NavigationContext {
  /** the page on screen, or null when the stack is empty */
  from: RouteRef | null;
  to: RouteRef;
  /** `imperative`: the app asked. `history`: the browser's back/forward. */
  trigger?: NavigationTrigger;
  /** for history triggers, when known: negative = back, positive = forward */
  historyDelta?: number;
  /** what the caller asked for explicitly, if anything */
  hint?: DirectionOpinion;
  /** keys of the pages currently kept alive, bottom to top */
  stack?: readonly string[];
}

export type DirectionStrategy = (ctx: NavigationContext) => DirectionOpinion;

export interface DirectionResolver {
  (ctx: NavigationContext): Direction;
  readonly strategies: readonly DirectionStrategy[];
  readonly fallback: Direction;
}

const isDirection = (v: DirectionOpinion): v is Direction => v === 'push' || v === 'pop' || v === 'replace';

/** Ask each strategy in turn; the first real answer wins, else `fallback`. */
export function resolveDirection(strategies: readonly DirectionStrategy[], ctx: NavigationContext, fallback: Direction = 'push'): Direction {
  for (const s of strategies) {
    const d = s(ctx);
    if (isDirection(d)) return d;
  }
  return fallback;
}

/** Bundle strategies and a fallback into one function. */
export function createDirectionResolver(strategies: readonly DirectionStrategy[] = defaultStrategies(), fallback: Direction = 'push'): DirectionResolver {
  const resolver = ((ctx: NavigationContext) => resolveDirection(strategies, ctx, fallback)) as DirectionResolver;
  Object.defineProperty(resolver, 'strategies', { value: strategies.slice(), enumerable: true });
  Object.defineProperty(resolver, 'fallback', { value: fallback, enumerable: true });
  return resolver;
}

// ------------------------------------------------------------------ strategies

/** Honors an explicit per-navigation hint (`{ state: { stacknav: 'pop' } }` in a router, say). */
export const fromHint = (): DirectionStrategy => (ctx) => ctx.hint;

/** Browser back is a pop, browser forward is a push. No opinion on imperative navigations. */
export const fromHistory = (): DirectionStrategy => (ctx) => {
  if (ctx.trigger !== 'history' || !ctx.historyDelta) return undefined;
  return ctx.historyDelta < 0 ? 'pop' : 'push';
};

/** Going to a page that is still kept beneath the current one is a pop back to it. */
export const fromStack = (): DirectionStrategy => (ctx) => {
  const stack = ctx.stack;
  if (!stack || stack.length < 2) return undefined;
  const i = stack.lastIndexOf(ctx.to.key);
  if (i < 0 || i === stack.length - 1) return undefined;
  return 'pop';
};

export interface LevelOptions {
  /** what to answer when both pages carry the same number (default `replace`) */
  sameLevel?: DirectionOpinion;
}

/**
 * For apps that number their screens (`level: 1`, `level: 2`, …): a higher
 * number pushes, a lower one pops. No opinion unless both pages carry a number.
 */
export const fromLevel = ({ sameLevel = 'replace' }: LevelOptions = {}): DirectionStrategy => (ctx) => {
  const a = ctx.from?.level;
  const b = ctx.to.level;
  if (typeof a !== 'number' || typeof b !== 'number') return undefined;
  if (b > a) return 'push';
  if (b < a) return 'pop';
  return sameLevel;
};

export interface TreeOptions {
  /** two unrelated pages at the same depth (siblings, say) (default `replace`) */
  sameDepth?: DirectionOpinion;
}

/**
 * Reads the route tree: a descendant of the current page pushes, an ancestor
 * pops; otherwise a deeper page pushes and a shallower one pops. Needs
 * `segments` on both pages.
 */
export const fromTree = ({ sameDepth = 'replace' }: TreeOptions = {}): DirectionStrategy => (ctx) => {
  const a = ctx.from?.segments;
  const b = ctx.to.segments;
  if (!a || !b) return undefined;
  if (isPrefix(a, b)) return b.length > a.length ? 'push' : sameDepth;
  if (isPrefix(b, a)) return 'pop';
  if (b.length > a.length) return 'push';
  if (b.length < a.length) return 'pop';
  return sameDepth;
};

/** Always the same answer; useful as a final fallback in a list. */
export const always = (direction: Direction): DirectionStrategy => () => direction;

/** The default order: an explicit hint, then browser history, then the kept stack, then numbering, then the tree. */
export const defaultStrategies = (): DirectionStrategy[] => [fromHint(), fromHistory(), fromStack(), fromLevel(), fromTree()];

function isPrefix(prefix: readonly string[], of: readonly string[]): boolean {
  if (prefix.length > of.length) return false;
  for (let i = 0; i < prefix.length; i++) if (prefix[i] !== of[i]) return false;
  return true;
}

/** Split a URL path into segments, ignoring the query, fragment and empty parts. */
export function segmentsOf(url: string): string[] {
  const path = url.split(/[?#]/, 1)[0];
  return path.split('/').filter(Boolean);
}
