/**
 * The things an app has to get right around the stack that nothing else
 * reports: the element around the outlet needs a height, the strategy has to
 * be installed, and a guard that refuses a back navigation needs the router's
 * `computed` cancellation to leave history alone. All are silent when wrong --
 * a blank screen, nothing animating out, a history entry rewritten one
 * navigation later -- so each is said once, in development only.
 *
 * Every call is inside `if (ngDevMode)`, which a production build folds away
 * along with this module.
 */
const said = new Set<string>();

/** Says `message` once per `code`. Development only. */
export function warn(code: string, message: string): void {
  if (said.has(code)) return;
  said.add(code);
  console.warn(`[stacknav] ${message}`);
}

/**
 * Called once per stack, when it is created, with the outlet element.
 * `documentScrolls` is asked when layout is in, since it reads an input that
 * is not set yet at construction. Development only.
 */
export function checkSetup(
  outlet: HTMLElement,
  canceledNavigationResolution: string | undefined,
  documentScrolls: () => boolean = () => false,
): void {
  if (canceledNavigationResolution === undefined) {
    warn(
      'canceled-navigation',
      "the router's canceledNavigationResolution is unset, so a back navigation a guard refuses rewrites the history entry the browser already landed on. " +
        "Pass withRouterConfig({ canceledNavigationResolution: 'computed' }) to provideRouter(). Setting it explicitly, to either value, silences this.",
    );
  }
  // Layout has not happened yet when the stack is created, and there is none
  // to wait for on a server.
  if (typeof requestAnimationFrame === 'undefined') return;
  requestAnimationFrame(() => {
    // A document-scrolling stack takes its height from the page in it.
    if (documentScrolls()) return;
    const host = outlet.parentElement;
    if (!host || !host.isConnected || host.offsetHeight > 0 || host.offsetWidth === 0) return;
    warn(
      'no-height',
      'the element around <router-outlet stackNav> is 0px tall, so its pages have nothing to fill and the screen looks empty. ' +
        "The router puts each page next to the outlet, so that element is the pages' scroll container and needs a height of its own, " +
        'e.g. style="height: 100dvh", or a parent that gives it one.',
    );
  });
}

/** Without the strategy the router destroys the page that is leaving before anything can animate it. */
export function checkStrategy(installed: boolean): void {
  if (installed) return;
  warn(
    'no-strategy',
    'StackNavRouteReuseStrategy is not the RouteReuseStrategy, so the router destroys each page as it leaves and stackNav has nothing to keep or animate out. ' +
      'provideStackNav() installs it; an app that provides its own strategy must extend it.',
  );
}
