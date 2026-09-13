/**
 * The two things an app has to get right around the outlet that nothing else
 * reports: the outlet needs a height, and a guard that refuses a back
 * navigation needs the router's `computed` cancellation to leave history alone.
 * Both are silent when wrong -- a blank screen, a history entry rewritten one
 * navigation later -- so each is said once, in development only.
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

/** Called once per outlet, when it is created. Development only. */
export function checkSetup(host: HTMLElement, canceledNavigationResolution: string | undefined): void {
  if (canceledNavigationResolution === undefined) {
    say(
      'canceled-navigation',
      "the router's canceledNavigationResolution is unset, so a back navigation a guard refuses rewrites the history entry the browser already landed on. " +
        "Pass withRouterConfig({ canceledNavigationResolution: 'computed' }) to provideRouter(). Setting it explicitly, to either value, silences this.",
    );
  }
  // Layout has not happened yet when the outlet is created, and there is none
  // to wait for on a server.
  if (typeof requestAnimationFrame === 'undefined') return;
  requestAnimationFrame(() => {
    if (!host.isConnected || host.offsetHeight > 0 || host.offsetWidth === 0) return;
    say(
      'no-height',
      'the <sn-outlet> element is 0px tall, so its pages have nothing to fill and the screen looks empty. ' +
        'The outlet is the scroll container of its pages and needs a height of its own: ' +
        '<sn-outlet style="height: 100dvh" />, or a parent that gives it one.',
    );
  });
}
