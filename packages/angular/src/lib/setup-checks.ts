/**
 * The things an app has to get right around the stack that nothing else
 * reports: the element needs a height, the outlet has to be its direct child,
 * the strategy has to be installed, and a guard that refuses a back
 * navigation needs the router's `computed` cancellation to leave history
 * alone. All are silent when wrong -- a blank screen, pages landing outside
 * the stack, nothing animating out, a history entry rewritten one navigation
 * later -- so each is said once, in development only.
 *
 * Every call is inside `if (ngDevMode)`, which a production build folds away
 * along with this module.
 */
const said = new Set<string>();

function say(code: string, message: string): void {
  if (said.has(code)) return;
  said.add(code);
  console.warn(`[stacknav] ${message}`);
}

/** Called once per stack, when it is created. Development only. */
export function checkSetup(host: HTMLElement, canceledNavigationResolution: string | undefined): void {
  if (canceledNavigationResolution === undefined) {
    say(
      'canceled-navigation',
      "the router's canceledNavigationResolution is unset, so a back navigation a guard refuses rewrites the history entry the browser already landed on. " +
        "Pass withRouterConfig({ canceledNavigationResolution: 'computed' }) to provideRouter(). Setting it explicitly, to either value, silences this.",
    );
  }
  // Layout has not happened yet when the stack is created, and there is none
  // to wait for on a server.
  if (typeof requestAnimationFrame === 'undefined') return;
  requestAnimationFrame(() => {
    if (!host.isConnected || host.offsetHeight > 0 || host.offsetWidth === 0) return;
    say(
      'no-height',
      'the snStack element is 0px tall, so its pages have nothing to fill and the screen looks empty. ' +
        'It is the scroll container of its pages and needs a height of its own: ' +
        '<div snStack style="height: 100dvh">, or a parent that gives it one.',
    );
  });
}

/** The outlet inserts pages next to itself, so it has to sit directly in the stack element. */
export function checkOutletPlacement(host: HTMLElement, outlet: HTMLElement | undefined): void {
  if (!outlet || outlet.parentElement === host) return;
  say(
    'outlet-placement',
    'the <router-outlet> inside snStack is not its direct child. The router puts each page next to the outlet, ' +
      'so pages would land outside the stack and neither be kept nor animated. Put the outlet directly inside the snStack element.',
  );
}

/** Without the strategy the router destroys the page that is leaving before anything can animate it. */
export function checkStrategy(installed: boolean): void {
  if (installed) return;
  say(
    'no-strategy',
    'StackNavRouteReuseStrategy is not the RouteReuseStrategy, so the router destroys each page as it leaves and snStack has nothing to keep or animate out. ' +
      'provideStackNav() installs it; an app that provides its own strategy must extend it.',
  );
}
