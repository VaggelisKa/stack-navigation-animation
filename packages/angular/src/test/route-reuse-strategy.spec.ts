import { provideLocationMocks } from '@angular/common/testing';
import { Component, type OnDestroy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter, type Routes } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideStackNav } from '../lib/config';
import { StackNav } from '../lib/stack';

/**
 * `StackNavRouteReuseStrategy` is installed app-wide by `provideStackNav()` --
 * it is the router's one `RouteReuseStrategy`, not something scoped to a
 * `stackNav` outlet. Its `shouldReuseRoute` treats a param-only change
 * (`/items/1` -> `/items/2`) as a *different* page unless the route opts in
 * with `data: { reuseRoute: true }`, which is what lets `stackNav` build a
 * fresh page to animate. But that same rule fires for a plain
 * `<router-outlet>` that never asked for it, changing what the router's
 * default strategy would have done there (reuse the component, only push new
 * params through it).
 *
 * These tests don't assert this is right or wrong -- they pin the CURRENT
 * behaviour, for both a plain outlet and a `stackNav` one, so that a future
 * change to scope the strategy to `stackNav` outlets only has a test that
 * will visibly flip.
 */

const created: string[] = [];
const destroyed: string[] = [];

@Component({ selector: 'page-item', template: 'item' })
class ItemPage implements OnDestroy {
  constructor() {
    created.push('item');
  }
  ngOnDestroy(): void {
    destroyed.push('item');
  }
}

const routes: Routes = [{ path: 'items/:id', component: ItemPage }];

@Component({ selector: 'plain-host', imports: [RouterOutlet], template: '<router-outlet />' })
class PlainHost {}

@Component({
  selector: 'stacknav-host',
  imports: [RouterOutlet, StackNav],
  template: '<main style="height:100px"><router-outlet stackNav /></main>',
})
class StackNavHost {}

function setup(host: new (...args: never[]) => unknown) {
  TestBed.configureTestingModule({
    providers: [provideRouter(routes), provideLocationMocks(), provideStackNav()],
  });
  const router = TestBed.inject(Router);
  router.setUpLocationChangeListener();
  const fixture = TestBed.createComponent(host as never);
  fixture.detectChanges();
  return { fixture, router };
}

async function go(fixture: { detectChanges(): void }, router: Router, url: string): Promise<void> {
  await router.navigateByUrl(url);
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

beforeEach(() => {
  created.length = 0;
  destroyed.length = 0;
});

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('StackNavRouteReuseStrategy (current, unscoped behaviour)', () => {
  it('recreates the component on a param change behind a plain router-outlet', async () => {
    const { fixture, router } = setup(PlainHost);
    await go(fixture, router, '/items/1');
    await go(fixture, router, '/items/2');

    // The router's own default strategy would have reused the one instance
    // and pushed the new params through it. This strategy is app-wide, so
    // even an outlet with no `stackNav` directive on it gets a fresh
    // component instead.
    expect(created).toEqual(['item', 'item']);
    expect(destroyed).toEqual(['item']);
  });

  it('recreates the component on a param change behind a stackNav outlet', async () => {
    const { fixture, router } = setup(StackNavHost);
    await go(fixture, router, '/items/1');
    await go(fixture, router, '/items/2');

    // Same outcome under a `stackNav` outlet, which is the case the strategy
    // is meant for: a param change gets a page of its own so there is
    // something to animate.
    expect(created).toEqual(['item', 'item']);
    expect(destroyed).toEqual(['item']);
  });
});
