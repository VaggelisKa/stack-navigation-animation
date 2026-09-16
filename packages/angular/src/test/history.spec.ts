import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, Router, provideRouter, withRouterConfig, type Routes } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideStackNav, type StackNavConfig } from '../lib/config';
import { StackNavHistory, type NavigationInfo } from '../lib/history';

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
  { path: 'a', component: PageA, canActivate: [() => ((seen = inject(StackNavHistory).current), true)] },
  { path: 'b', component: PageB, canActivate: [() => ((seen = inject(StackNavHistory).current), !blockB)] },
  { path: 'c', component: PageA, canActivate: [() => ((seen = inject(StackNavHistory).current), true)] },
  { path: 'old', redirectTo: 'c' },
];

function setup(opts: { computed?: boolean; config?: StackNavConfig } = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withRouterConfig({ canceledNavigationResolution: opts.computed ? 'computed' : 'replace' })),
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
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError || e instanceof NavigationSkipped) {
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
    expect(seen).toMatchObject({ trigger: 'imperative', historyDelta: undefined, hint: undefined, animated: undefined, replaceUrl: false, skipLocationChange: false, restoredId: null });
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
    await router.navigateByUrl('/c', { info: { stacknav: { direction: 'replace', animated: false } } });
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
});
