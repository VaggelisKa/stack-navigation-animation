import type { NavigationSource, NavigationStack } from './navigation-stack.ts';
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
 *
 * Every change to the stack is answered with the entries it is worth, however
 * it was made: the adapter remembers the depth it last mirrored and, on each
 * event, pushes one entry per level gained or goes back over the levels lost.
 * `reset`, `replace` and `remove` are kept in step that way as much as `push`
 * and `pop` are, so history is never a different length from the stack and no
 * back press is spent catching it up.
 */
export function attachBrowserHistory(
  stack: NavigationStack,
  { key = 'snDepth', animateHistoryPop, onForward = null }: BrowserHistoryOptions = {},
): () => void {
  const depthOf = (state: unknown): number => {
    const s = state as Record<string, unknown> | null;
    return s && Number.isInteger(s[key]) ? (s[key] as number) : 0;
  };
  const write = (kind: 'pushState' | 'replaceState', depth = stack.depth) =>
    history[kind]({ ...((history.state as object) || {}), [key]: depth - 1 }, '');

  write('replaceState');

  // The depth history already stands at. A back press pops the stack, so the
  // two have to stay the same length: whatever moved the stack -- `push` and
  // `pop`, but `reset`, `replace` and `remove` just as much -- history follows
  // by the levels gained or lost.
  let mirrored = stack.depth;
  const mirror = (source: NavigationSource): void => {
    // Mirror handlers cannot fire once the stack is destroyed -- its events
    // are cleared along with it -- but the check is cheap enough to keep as a
    // guard rather than rely on that.
    if (stack.destroyed) return;
    // A navigation the back button asked for: history is already there.
    if (source !== 'history') {
      const delta = stack.depth - mirrored;
      // An entry per level gained, each carrying the depth it stands at, so a
      // back press onto any of them names the page to return to. A level lost
      // is walked back over; the popstate that answers lands on an entry whose
      // depth the stack already has, and does nothing.
      if (delta > 0) for (let d = mirrored + 1; d <= stack.depth; d++) write('pushState', d);
      else if (delta < 0) history.go(delta);
    }
    mirrored = stack.depth;
  };

  const offPush = stack.on('push', ({ source }) => mirror(source));
  const offPop = stack.on('pop', ({ source }) => mirror(source));
  const offReplace = stack.on('replace', ({ source }) => mirror(source));
  const offReset = stack.on('reset', ({ source }) => mirror(source));

  // `hasUAVisualTransition` is Baseline 2026; `undefined` is an engine old
  // enough that only the platform can be asked.
  const uaAnimated = (ev: PopStateEvent) =>
    typeof ev.hasUAVisualTransition === 'boolean' ? ev.hasUAVisualTransition : isIOSBrowser();

  const detach = () => {
    offPush();
    offPop();
    offReplace();
    offReset();
    window.removeEventListener('popstate', onPopState);
  };

  const onPopState = (ev: PopStateEvent) => {
    // The stack outlived its own detach: nothing below is safe to run -- the
    // stack refuses navigation and has nothing to reveal -- so this is where
    // an app that forgot to detach gets cleaned up instead.
    if (stack.destroyed) {
      detach();
      return;
    }
    const target = depthOf(ev.state) + 1;
    if (target === stack.depth) return;
    if (target < stack.depth)
      stack
        .popTo(target, {
          animated: animateHistoryPop ?? !uaAnimated(ev),
          source: 'history',
        })
        // A destroyed stack refuses every navigation it still owes, and an app
        // that dropped the stack without detaching from here would turn each
        // back press into an unhandled rejection. That refusal is the back
        // press going nowhere; anything else is a real failure, and rethrowing
        // leaves it to reject as it did before.
        .catch((err: unknown) => {
          if ((err as { name?: string } | null)?.name !== 'AbortError') throw err;
        });
    else if (onForward) onForward(target);
    else history.back();
  };
  window.addEventListener('popstate', onPopState);

  return detach;
}
