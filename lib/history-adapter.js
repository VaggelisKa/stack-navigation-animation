/**
 * Mirrors the stack depth into `history.state` so the browser (or hardware)
 * back button pops the stack, and stack pops walk history back. Returns a
 * function that detaches everything.
 *
 * On iOS browsers a history pop is not animated: Safari has already animated
 * its own snapshot of the page, so animating again would double the motion.
 */
export function attachBrowserHistory(stack, { key = 'snDepth', animateHistoryPop = !isIOSBrowser(), onForward = null } = {}) {
  const depthOf = (state) => (state && Number.isInteger(state[key]) ? state[key] : 0);
  const write = (kind) => history[kind]({ ...(history.state || {}), [key]: stack.depth - 1 }, '');

  write('replaceState');

  const offPush = stack.on('push', ({ source }) => {
    if (source !== 'history') write('pushState');
  });
  const offPop = stack.on('pop', ({ source, removed }) => {
    if (source !== 'history') history.go(-removed.length);
  });

  const onPopState = (ev) => {
    const target = depthOf(ev.state) + 1;
    if (target === stack.depth) return;
    if (target < stack.depth) stack.popTo(target, { animated: animateHistoryPop, source: 'history' });
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

export function isIOSBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
