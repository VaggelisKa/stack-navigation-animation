import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
  provideRouter,
  withRouterConfig,
  type Routes,
} from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideStackNav, type StackNavConfig } from '../lib/config';
import { StackNavHistory, MAX_ENTRIES, type NavigationInfo } from '../lib/history';
import { resetWarnings } from '../lib/setup-checks';

@Component({ selector: 'page-a', template: 'a' })
class PageA {}
@Component({ selector: 'page-b', template: 'b' })
class PageB {}

/**
 * Whatever `StackNavHistory` saw while the navigation that reached this route
 * was in flight. `current` is only valid during activation, so a guard is the
 * one place a test can read it.
 */
let seen: NavigationInfo | null = null;
/** Flipped by a test to make the guard on `/b` refuse the navigation. */
let blockB = false;

const routes: Routes = [
  {
    path: 'a',
    component: PageA,
    canActivate: [() => ((seen = inject(StackNavHistory).current), true)],
  },
  {
    path: 'b',
    component: PageB,
    canActivate: [() => ((seen = inject(StackNavHistory).current), !blockB)],
  },
  {
    path: 'c',
    component: PageA,
    canActivate: [() => ((seen = inject(StackNavHistory).current), true)],
  },
  { path: 'old', redirectTo: 'c' },
];

function setup(opts: { computed?: boolean; unset?: boolean; config?: StackNavConfig } = {}): {
  router: Router;
  history: StackNavHistory;
  location: Location;
} {
  // `unset` leaves the router on its default, which is what an app that never
  // passed withRouterConfig() has.
  const features = opts.unset
    ? []
    : [
        withRouterConfig({
          canceledNavigationResolution: opts.computed ? 'computed' : 'replace',
        }),
      ];
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, ...features),
      provideLocationMocks(),
      provideStackNav(opts.config),
    ],
  });
  const router = TestBed.inject(Router);
  // Injected before the first navigation: it only knows what it hears on the
  // router's event stream, so it has to be listening from the start.
  const history = TestBed.inject(StackNavHistory);
  // Bootstrapping an app does this; a TestBed has not bootstrapped one, and
  // without it the router never hears the popstate a back button produces.
  router.setUpLocationChangeListener();
  return { router, history, location: TestBed.inject(Location) };
}

/** Resolves when the navigation in flight reaches any of its four ends. */
function settled(router: Router): Promise<void> {
  return new Promise((resolve) => {
    const sub = router.events.subscribe((e) => {
      if (
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError ||
        e instanceof NavigationSkipped
      ) {
        sub.unsubscribe();
        // Let the router finish restoring history before the test looks.
        setTimeout(resolve, 0);
      }
    });
  });
}

beforeEach(() => {
  seen = null;
  blockB = false;
});

describe('StackNavHistory', () => {
  it('builds the entry list and moves the cursor as the app navigates', async () => {
    const { router, history } = setup();
    expect(history.currentUrl).toBeNull();
    expect(history.canGoBack).toBe(false);

    await router.navigateByUrl('/a');
    expect(history.currentUrl).toBe('/a');
    expect(history.previousUrl).toBeNull();
    expect(history.canGoBack).toBe(false);

    await router.navigateByUrl('/b');
    expect(history.currentUrl).toBe('/b');
    expect(history.previousUrl).toBe('/a');
    expect(history.canGoBack).toBe(true);

    await router.navigateByUrl('/c');
    expect(history.currentUrl).toBe('/c');
    expect(history.previousUrl).toBe('/b');
  });

  it('describes the navigation in flight while the router activates routes', async () => {
    const { router, history } = setup();
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    // `current` belongs to the navigation, and is cleared the moment it ends.
    expect(history.current).toBeNull();
    expect(seen).toMatchObject({
      trigger: 'imperative',
      historyDelta: undefined,
      hint: undefined,
      animated: undefined,
      replaceUrl: false,
      skipLocationChange: false,
      restoredId: null,
    });
  });

  it('overwrites the current entry for a replaceUrl navigation', async () => {
    const { router, history } = setup();
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    await router.navigateByUrl('/c', { replaceUrl: true });
    // `/b` is gone: the browser has one entry fewer, and so do we.
    expect(history.currentUrl).toBe('/c');
    expect(history.previousUrl).toBe('/a');
    expect(seen!.replaceUrl).toBe(true);
  });

  it('leaves history untouched for a skipLocationChange navigation', async () => {
    const { router, history } = setup();
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    await router.navigateByUrl('/c', { skipLocationChange: true });
    // The URL bar never moved, so neither did the model: `/b` is still where
    // the browser's back button would land.
    expect(history.currentUrl).toBe('/b');
    expect(history.previousUrl).toBe('/a');
    expect(seen!.skipLocationChange).toBe(true);
  });

  it('records where a redirect landed, not where it was aimed', async () => {
    const { router, history } = setup();
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/old');
    expect(history.currentUrl).toBe('/c');
    expect(history.previousUrl).toBe('/a');
  });

  it('reads the hint off the navigation info, as a string or an object', async () => {
    const { router } = setup();
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b', { info: { stacknav: 'pop' } });
    expect(seen).toMatchObject({ hint: 'pop', animated: undefined });
    await router.navigateByUrl('/c', {
      info: { stacknav: { direction: 'replace', animated: false } },
    });
    expect(seen).toMatchObject({ hint: 'replace', animated: false });
    // Anything that is not the configured key, or not an object at all, is
    // somebody else's info and says nothing to us.
    await router.navigateByUrl('/a', { info: { other: 'pop' } });
    expect(seen).toMatchObject({ hint: undefined, animated: undefined });
    await router.navigateByUrl('/b', { info: 'pop' });
    expect(seen).toMatchObject({ hint: undefined });
  });

  it('reads the hint under a configured infoKey instead', async () => {
    const { router } = setup({ config: { infoKey: 'sn' } });
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b', { info: { sn: 'pop', stacknav: 'push' } });
    expect(seen!.hint).toBe('pop');
  });

  it('counts the steps a browser back and forward took', async () => {
    const { router, history, location } = setup();
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    await router.navigateByUrl('/c');

    let done = settled(router);
    location.back();
    await done;
    // One entry back, and the model follows the cursor rather than rebuilding.
    expect(seen).toMatchObject({ trigger: 'history', historyDelta: -1 });
    expect(history.currentUrl).toBe('/b');
    expect(history.previousUrl).toBe('/a');

    done = settled(router);
    location.forward();
    await done;
    expect(seen).toMatchObject({ trigger: 'history', historyDelta: 1 });
    expect(history.currentUrl).toBe('/c');
    expect(history.previousUrl).toBe('/b');

    // Two at once is still one navigation, and still counted.
    done = settled(router);
    location.historyGo(-2);
    await done;
    expect(seen!.historyDelta).toBe(-2);
    expect(history.currentUrl).toBe('/a');
    expect(history.canGoBack).toBe(false);
  });

  it('leaves the model alone when a guard refuses a back navigation under `computed`', async () => {
    const { router, history, location } = setup({ computed: true });
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    await router.navigateByUrl('/c');
    blockB = true;

    const done = settled(router);
    location.back();
    await done;
    // The router walks the browser back to where it was, so the entry list and
    // the cursor are still describing `/c`.
    expect(history.currentUrl).toBe('/c');
    expect(history.previousUrl).toBe('/b');
    expect(history.canGoBack).toBe(true);
  });

  it('overwrites the entry the browser landed on when a guard refuses under `replace`', async () => {
    const { router, history, location } = setup();
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    await router.navigateByUrl('/c');
    blockB = true;

    const done = settled(router);
    location.back();
    await done;
    // The browser stayed on the entry it popped to and the router replaced its
    // URL with the one still showing, so that entry now *is* `/c`, and the
    // entry before it is `/a`.
    expect(history.currentUrl).toBe('/c');
    expect(history.previousUrl).toBe('/a');
  });

  it('caps the entry list at MAX_ENTRIES, matching browser behaviour', async () => {
    const { router, history, location } = setup();
    // Alternate between two routes so every navigation actually moves the
    // cursor forward (navigating to the same URL twice in a row is a no-op).
    for (let i = 0; i < MAX_ENTRIES + 50; i++) {
      await router.navigateByUrl(i % 2 === 0 ? '/a' : '/b');
    }
    // Private, but this is the only way to see the array length from a test.
    expect((history as unknown as { entries: unknown[] }).entries.length).toBe(MAX_ENTRIES);
    expect(history.currentUrl).toBe('/b');
    expect(history.previousUrl).toBe('/a');

    const done = settled(router);
    location.back();
    await done;
    expect(history.currentUrl).toBe('/a');
    expect(history.previousUrl).toBe('/b');
  });
});

describe('the canceledNavigationResolution warning', () => {
  let warned: string[];

  beforeEach(() => {
    warned = [];
    // Said once per code, for the life of the module, so each test starts
    // from a clean slate.
    resetWarnings();
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warned.push(String(args[0]));
    });
  });

  afterEach(() => vi.restoreAllMocks());

  /** The warnings about the unset option, by the words only it uses. */
  function canceledNavigationWarnings(): string[] {
    return warned.filter((m) => m.includes('canceledNavigationResolution'));
  }

  it('is said when a guard refuses a back navigation and the option is unset', async () => {
    const { router, location } = setup({ unset: true });
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    await router.navigateByUrl('/c');
    expect(canceledNavigationWarnings()).toEqual([]);
    blockB = true;

    const done = settled(router);
    location.back();
    await done;
    expect(canceledNavigationWarnings()).toHaveLength(1);
    expect(canceledNavigationWarnings()[0]).toContain('[stacknav]');
  });

  it('is silent when the option is set to `computed`', async () => {
    const { router, location } = setup({ computed: true });
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    await router.navigateByUrl('/c');
    blockB = true;

    const done = settled(router);
    location.back();
    await done;
    expect(canceledNavigationWarnings()).toEqual([]);
  });

  it('is silent when the navigation a guard refuses is imperative', async () => {
    const { router } = setup({ unset: true });
    await router.navigateByUrl('/a');
    blockB = true;
    // Nothing the browser did: history is where it was, so nothing is rewritten.
    await router.navigateByUrl('/b');
    expect(canceledNavigationWarnings()).toEqual([]);
  });

  it('is silent while nothing is cancelled, including at creation', async () => {
    const { router, location } = setup({ unset: true });
    expect(canceledNavigationWarnings()).toEqual([]);
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    expect(canceledNavigationWarnings()).toEqual([]);

    const done = settled(router);
    location.back();
    await done;
    expect(canceledNavigationWarnings()).toEqual([]);
  });
});
