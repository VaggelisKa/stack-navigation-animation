import type { NavigationStack } from './navigation-stack.ts';
import { isIOSBrowser } from './platform.ts';

export interface BrowserHistoryOptions {
  /** the `history.state` property that carries the depth */
  key?: string;
  /**
   * Animate pops triggered by the back button. Unset by default, which asks
   * the event: a browser that animated the navigation itself -- the edge swipe
   * slides a snapshot of the previous page, and the pop on top of it would
   * play the same move twice -- says so with `hasUAVisualTransition`, and that
   * pop is not animated. Where the property is missing the old guess stands
   * in: iOS browsers animate their own, others do not. Set it to decide for
   * every pop instead.
   */
  animateHistoryPop?: boolean;
  /** forward navigation has no page to show. Re-push something here instead of bouncing back */
  onForward?: ((targetDepth: number) => void) | null;
}

/**
 * For apps without a router. Mirrors the stack depth into `history.state`, so
 * the browser or hardware back button pops the stack and stack pops walk
 * history back. Returns a function that detaches everything.
 */
export function attachBrowserHistory(
  stack: NavigationStack,
  { key = 'snDepth', animateHistoryPop, onForward = null }: BrowserHistoryOptions = {},
): () => void {
  const depthOf = (state: unknown): number => {
    const s = state as Record<string, unknown> | null;
    return s && Number.isInteger(s[key]) ? (s[key] as number) : 0;
  };
  const write = (kind: 'pushState' | 'replaceState') =>
    history[kind]({ ...((history.state as object) || {}), [key]: stack.depth - 1 }, '');

  write('replaceState');

  const offPush = stack.on('push', ({ source }) => {
    if (source !== 'history') write('pushState');
  });
  const offPop = stack.on('pop', ({ source, removed }) => {
    if (source !== 'history') history.go(-removed.length);
  });

  // `hasUAVisualTransition` is Baseline 2026; `undefined` is an engine old
  // enough that only the platform can be asked.
  const uaAnimated = (ev: PopStateEvent) =>
    typeof ev.hasUAVisualTransition === 'boolean' ? ev.hasUAVisualTransition : isIOSBrowser();

  const onPopState = (ev: PopStateEvent) => {
    const target = depthOf(ev.state) + 1;
    if (target === stack.depth) return;
    if (target < stack.depth)
      void stack.popTo(target, {
        animated: animateHistoryPop ?? !uaAnimated(ev),
        source: 'history',
      });
    else if (onForward) onForward(target);
    else history.back();
  };
  window.addEventListener('popstate', onPopState);

  return () => {
    offPush();
    offPop();
    window.removeEventListener('popstate', onPopState);
  };
}
