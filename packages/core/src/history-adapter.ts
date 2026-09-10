import type { NavigationStack } from './navigation-stack.ts';

export interface BrowserHistoryOptions {
  /** the `history.state` property that carries the depth */
  key?: string;
  /** animate pops that come from the back button; off on iOS browsers, which animate their own snapshot */
  animateHistoryPop?: boolean;
  /** forward navigation has no page to show; re-push something here instead of bouncing back */
  onForward?: ((targetDepth: number) => void) | null;
}

/**
 * Mirrors the stack depth into `history.state` so the browser (or hardware)
 * back button pops the stack, and stack pops walk history back. Returns a
 * function that detaches everything. For apps without a router.
 */
export function attachBrowserHistory(stack: NavigationStack, { key = 'snDepth', animateHistoryPop = !isIOSBrowser(), onForward = null }: BrowserHistoryOptions = {}): () => void {
  const depthOf = (state: unknown): number => {
    const s = state as Record<string, unknown> | null;
    return s && Number.isInteger(s[key]) ? (s[key] as number) : 0;
  };
  const write = (kind: 'pushState' | 'replaceState') => history[kind]({ ...((history.state as object) || {}), [key]: stack.depth - 1 }, '');

  write('replaceState');

  const offPush = stack.on('push', ({ source }) => {
    if (source !== 'history') write('pushState');
  });
  const offPop = stack.on('pop', ({ source, removed }) => {
    if (source !== 'history') history.go(-removed.length);
  });

  const onPopState = (ev: PopStateEvent) => {
    const target = depthOf(ev.state) + 1;
    if (target === stack.depth) return;
    if (target < stack.depth) void stack.popTo(target, { animated: animateHistoryPop, source: 'history' });
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

export function isIOSBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
