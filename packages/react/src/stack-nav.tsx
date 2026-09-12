import {
  createDirectionResolver,
  createIOSStack,
  defaultStrategies,
  injectStyles as injectCoreStyles,
  type Direction,
  type DirectionResolver,
  type DirectionStrategy,
  type EdgePanGestureOptions,
  type IOSStack,
  type IOSTransitionOptions,
  type RouteRef,
} from '@stacknav/core';
import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ForwardedRef, type ReactElement, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { activate, createModel, dropPending, removed, restore, top, type Activation, type PageModel, type StackNavigation, type StackPage } from './model.ts';

export interface StackNavActivation<TRoute extends RouteRef = RouteRef> {
  page: StackPage<TRoute>;
  direction: Direction;
  animated: boolean;
  /** the page was kept and has been shown again */
  reused: boolean;
}

export interface StackNavProps<TRoute extends RouteRef = RouteRef> {
  /**
   * The page the app wants on screen. `key` identifies it: a later navigation
   * to the same key pops back to the kept page. `segments`, `level` and `data`
   * feed the direction strategies.
   */
  route: TRoute;
  /** How the app got here, for the direction strategies. A router adapter fills this in. */
  navigation?: StackNavigation;
  /**
   * What renders the page for `route`. It must not depend on live router
   * context: once the page is beneath the top, this node is what keeps
   * rendering it. With React Router that is `useRoutes(routes, location)`.
   */
  children?: ReactNode;
  /**
   * Strategies that decide push / pop / replace, in priority order, or one
   * resolver function. Defaults to the core's `defaultStrategies()`.
   */
  direction?: readonly DirectionStrategy[] | DirectionResolver;
  /** Used when no strategy has an answer. Default `push`. */
  fallbackDirection?: Direction;
  /**
   * `createIOSTransition` options. The same options are CSS custom properties
   * (`--sn-duration`, `--sn-easing`, `--sn-parallax`, …) read off the container,
   * and a variable that is set wins over the option here.
   */
  transition?: Partial<IOSTransitionOptions>;
  /** `createEdgePanGesture` options. `false` disables swiping back. */
  gesture?: Partial<EdgePanGestureOptions> | false;
  /** Whether to animate at all. Default true. `prefers-reduced-motion` is honoured either way. */
  animated?: boolean;
  /** Inserts the core stylesheet at runtime. Default true. Turn it off if you import `@stacknav/core/stacknav.css`. */
  injectStyles?: boolean;
  /**
   * A swipe popped `popped` and revealed `revealed`. Bring the router in line:
   * usually `history.back()`, which is the default. Return `false` (or a
   * promise of it) if the router refused, and the page is put back.
   */
  onSwipeBack?: (revealed: StackPage<TRoute>, popped: StackPage<TRoute>) => boolean | void | Promise<boolean | void>;
  /** Every activation, with the direction that was resolved for it. */
  onNavigate?: (activation: StackNavActivation<TRoute>) => void;
  className?: string;
  style?: CSSProperties;
}

/** What `ref` and `useStackNav()` give access to. */
export interface StackNavHandle<TRoute extends RouteRef = RouteRef> {
  /**
   * The underlying core stack, once mounted. Chrome that just has to move with
   * the pages is usually best driven from CSS, off `--sn-t` / `--sn-e` and the
   * `sn-page-upper` / `sn-page-lower` classes; subscribe to `progress` when you
   * need the number itself.
   */
  readonly stack: IOSStack | null;
  readonly container: HTMLDivElement | null;
  /** The kept pages, bottom to top. The last one is on screen. */
  readonly pages: readonly StackPage<TRoute>[];
  /** Whether a swipe has a kept page to reveal. */
  readonly canPop: boolean;
  readonly lastDirection: Direction | null;
}

const StackNavContext = createContext<StackNavHandle | null>(null);

/**
 * The stack state of the nearest `<StackNav>`: its kept pages, whether it can
 * pop, and the core stack. Re-renders when pages come and go.
 */
export function useStackNav<TRoute extends RouteRef = RouteRef>(): StackNavHandle<TRoute> {
  const ctx = useContext(StackNavContext);
  if (!ctx) throw new Error('useStackNav() must be called beneath a <StackNav>');
  return ctx as StackNavHandle<TRoute>;
}

const defaultSwipeBack = (): void => {
  if (typeof history !== 'undefined') history.back();
};

const noStyle: CSSProperties = {};

function StackNavImpl<TRoute extends RouteRef>(
  {
    route,
    navigation,
    children,
    direction,
    fallbackDirection = 'push',
    transition,
    gesture = {},
    animated = true,
    injectStyles = true,
    onSwipeBack = defaultSwipeBack,
    onNavigate,
    className,
    style = noStyle,
  }: StackNavProps<TRoute>,
  ref: ForwardedRef<StackNavHandle<TRoute>>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<IOSStack | null>(null);
  const [model] = useState(() => createModel<TRoute>());
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const opsRef = useRef<Activation<TRoute>[]>([]);
  const childrenRef = useRef<ReactNode>(null);
  const callbacks = useRef({ onSwipeBack, onNavigate });
  callbacks.current = { onSwipeBack, onNavigate };

  const resolve = useMemo(
    () => (typeof direction === 'function' ? direction : createDirectionResolver(direction ?? defaultStrategies(), fallbackDirection)),
    [direction, fallbackDirection],
  );

  // ------------------------------------------------------------- activation
  // Decided during render, so that the very first commit of a new page puts
  // its content in its own element rather than the element of the page it is
  // replacing. `activate` is idempotent per key, which is what a doubled
  // render needs; the side effects wait in `opsRef` for the commit.
  const activation = activate(model, route, navigation, {
    resolve,
    animated,
    node: children,
    previousNode: childrenRef.current,
    createElement: () => document.createElement('div'),
    isOnScreen: (el) => {
      const s = stackRef.current;
      return !!s && !s.busy && s.top?.el === el;
    },
  });
  if (activation) opsRef.current.push(activation);
  childrenRef.current = children;
  const current = top(model);
  if (current && current.key === route.key) {
    current.route = route;
    current.node = children;
  }

  // ------------------------------------------------------------- the stack
  useLayoutEffect(() => {
    const container = containerRef.current!;
    const stack = createIOSStack({ container, transition, gesture: gesture || {} });
    if (gesture === false) stack.gesture.detach();
    if (injectStyles) injectCoreStyles(container.ownerDocument);
    stackRef.current = stack;

    const onRemoved = (els: HTMLElement[], source: string) => {
      const byGesture = source === 'gesture';
      removed(model, els, byGesture);
      bump();
      if (!byGesture) return;
      const popped = model.mounted.find((p) => p.pendingRemoval);
      const revealed = top(model);
      if (!popped || !revealed) return;
      let outcome: boolean | void | Promise<boolean | void>;
      try {
        outcome = callbacks.current.onSwipeBack(revealed, popped);
      } catch {
        outcome = false;
      }
      Promise.resolve(outcome)
        .catch(() => false)
        .then((ok) => {
          if (ok !== false || !restore(model, popped)) return;
          void stack.push(popped.el, { animated: false, key: popped.key, source: 'restore' });
          bump();
        });
    };
    const offs = [
      stack.on('pop', (e) => onRemoved(e.removed.map((r) => r.el), e.source)),
      stack.on('replace', (e) => onRemoved(e.removed.map((r) => r.el), e.source)),
      stack.on('reset', (e) => onRemoved(e.removed.map((r) => r.el), e.source)),
    ];
    // Pages activated before the stack existed (the first render, or a remount
    // under StrictMode) are shown as they are, without animating.
    if (model.views.length) {
      opsRef.current = [];
      void stack.reset(model.views.map((v) => v.el));
    }
    bump();
    return () => {
      offs.forEach((off) => off());
      stack.destroy();
      stackRef.current = null;
    };
    // The stack is built once; option changes are applied by the effects below.
  }, []);

  // Runs what render decided, now that the new page's content is in its element.
  useLayoutEffect(() => {
    const stack = stackRef.current;
    const ops = opsRef.current;
    if (!stack || !ops.length) return;
    opsRef.current = [];
    for (const op of ops) {
      if (op.present) {
        const source = navigation?.trigger === 'history' ? 'history' : 'api';
        void stack.present(op.page.el, op.direction, { key: op.page.key, animated: op.animated, source });
      }
      // The swipe's page is only gone once the router has moved on to something else.
      if (dropPending(model).length) bump();
      callbacks.current.onNavigate?.({ page: op.page, direction: op.direction, animated: op.animated, reused: op.reused });
    }
    bump();
  });

  // ------------------------------------------------------------- options
  const transitionJson = JSON.stringify(transition ?? {}, (_, v: unknown) => (typeof v === 'function' ? String(v) : v));
  useEffect(() => {
    const stack = stackRef.current;
    if (!stack || !transition) return;
    Object.assign(stack.transition.options, transition);
    stack.transition.refresh();
  }, [transitionJson]);

  const gestureJson = JSON.stringify(gesture);
  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;
    if (gesture === false) {
      stack.gesture.detach();
      return;
    }
    Object.assign(stack.gesture.options, gesture);
    if (!stack.container.querySelector(':scope > .sn-edge')) stack.gesture.attach(stack);
    stack.gesture.refresh();
  }, [gestureJson]);

  // ------------------------------------------------------------- handle
  const handle = useMemo<StackNavHandle<TRoute>>(
    () => ({
      stack: stackRef.current,
      container: containerRef.current,
      pages: model.views.slice(),
      canPop: model.views.length > 1,
      lastDirection: model.lastDirection,
    }),
    // `version` is what changes; the model is mutable and stable.
    [version, model],
  );
  useImperativeHandle(ref, () => handle, [handle]);

  const renderPage = useCallback((page: PageModel<TRoute>) => createPortal(page === current ? children : page.node, page.el, String(page.id)), [current, children]);

  return (
    <StackNavContext.Provider value={handle as StackNavHandle}>
      <div ref={containerRef} className={className} style={style}>
        {model.mounted.map(renderPage)}
      </div>
    </StackNavContext.Provider>
  );
}

/**
 * A stack of pages with the iOS push/pop transition. Give it the page the app
 * wants on screen (`route`) and what renders it (`children`); the pages it
 * came from stay mounted beneath, keeping their scroll position and state, a
 * swipe from the leading edge pops, and the direction of every change comes
 * from the strategies in `direction`.
 *
 * It is router-agnostic. `@stacknav/react/react-router` wires it to React
 * Router; for anything else, feed it a key, a node that renders the page
 * without live router context, and, in `onSwipeBack`, how to go back.
 *
 * The element needs a height; it is the pages' scroll container.
 */
export const StackNav = forwardRef(StackNavImpl) as <TRoute extends RouteRef = RouteRef>(
  props: StackNavProps<TRoute> & { ref?: Ref<StackNavHandle<TRoute>> },
) => ReactElement;
