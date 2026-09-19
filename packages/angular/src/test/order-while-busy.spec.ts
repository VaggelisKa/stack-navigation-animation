import { provideLocationMocks } from '@angular/common/testing';
import { Component, Directive, ErrorHandler, viewChild, type OnDestroy } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  Router,
  RouterOutlet,
  provideRouter,
  withRouterConfig,
  type Routes,
} from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideStackNav, type StackNavConfig } from '../lib/config';
import { StackNav, type StackNavActivation } from '../lib/stack';

/**
 * `StackNav.pages` is the *projected* order: what the stack will look like
 * once every operation the directive has issued has run. The core's
 * `stack.entries` is what it has *started*. The two differ by exactly the
 * core's unstarted queue -- and in every other spec here that queue is empty,
 * because jsdom has no `Element.getAnimations` and each transition settles in
 * a microtask, so the core is never busy by the time an assertion runs.
 *
 * `beginInteractivePop()` is the one thing that holds `busy` across real time:
 * it is set for the whole gesture, so navigations made during a swipe queue
 * unstarted. That is the window these tests open. They pin what the directive
 * does in it: the projected order moves at once, direction is resolved against
 * that projected order (not against the core's older one), and the core
 * catches up, in order, when the gesture ends and the queue drains.
 *
 * Without these, a refactor that read the order straight off the core would
 * pass the rest of the suite while resolving the wrong direction mid-gesture.
 *
 * The gesture is always ended with `cancel()`: it is synchronous and takes the
 * pages nowhere, so what is asserted afterwards is the queue's doing and
 * nothing else. What a completed swipe does is pinned in `stack.spec.ts`.
 */

// ------------------------------------------------------------------ pages
const created: PageBase[] = [];
const destroyed: string[] = [];

@Directive()
abstract class PageBase implements OnDestroy {
  abstract readonly name: string;
  constructor() {
    created.push(this);
  }
  ngOnDestroy(): void {
    destroyed.push(this.name);
  }
}

@Component({ selector: 'page-a', template: 'a' })
class PageA extends PageBase {
  override readonly name = 'a';
}
@Component({ selector: 'page-b', template: 'b' })
class PageB extends PageBase {
  override readonly name = 'b';
}
@Component({ selector: 'page-c', template: 'c' })
class PageC extends PageBase {
  override readonly name = 'c';
}
@Component({ selector: 'page-d', template: 'd' })
class PageD extends PageBase {
  override readonly name = 'd';
}
@Component({ selector: 'page-x', template: 'x' })
class PageX extends PageBase {
  override readonly name = 'x';
}
@Component({ selector: 'page-y', template: 'y' })
class PageY extends PageBase {
  override readonly name = 'y';
}

/** A page with a stack of its own inside it: the outlet that gets emptied. */
@Component({
  selector: 'page-shell',
  imports: [RouterOutlet, StackNav],
  template: '<main style="height:100px"><router-outlet stackNav /></main>',
})
class Shell extends PageBase {
  override readonly name = 'shell';
  readonly stack = viewChild.required(StackNav);
}

@Component({
  selector: 'test-host',
  imports: [RouterOutlet, StackNav],
  template:
    '<main style="height:100px"><router-outlet stackNav (stackNavActivate)="activations.push($event)" /></main>',
})
class Host {
  readonly stack = viewChild.required(StackNav);
  readonly activations: StackNavActivation[] = [];
}

/** `stackLevel` is what makes these routes a ladder rather than siblings. */
const routes: Routes = [
  { path: 'a', component: PageA, data: { stackLevel: 0 } },
  { path: 'b', component: PageB, data: { stackLevel: 1 } },
  { path: 'c', component: PageC, data: { stackLevel: 2 } },
  { path: 'd', component: PageD, data: { stackLevel: 3 } },
  {
    path: 'shell',
    component: Shell,
    data: { stackLevel: 0 },
    children: [
      { path: 'x', component: PageX, data: { stackLevel: 0 } },
      { path: 'y', component: PageY, data: { stackLevel: 1 } },
    ],
  },
];

// ----------------------------------------------------------------- harness
/** Everything the directive reported to Angular's `ErrorHandler`. */
let errors: unknown[] = [];

function setup(config?: StackNavConfig) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withRouterConfig({ canceledNavigationResolution: 'computed' })),
      provideLocationMocks(),
      provideStackNav(config),
      {
        provide: ErrorHandler,
        useValue: { handleError: (e: unknown) => errors.push(e) } satisfies ErrorHandler,
      },
    ],
  });
  const router = TestBed.inject(Router);
  router.setUpLocationChangeListener();
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return {
    fixture,
    router,
    host: fixture.componentInstance,
    stack: fixture.componentInstance.stack(),
  };
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

async function go(fixture: ComponentFixture<unknown>, router: Router, url: string): Promise<void> {
  await router.navigateByUrl(url);
  await settle(fixture);
}

/** The projected order: what the directive says the stack is. */
const keys = (stack: StackNav) => stack.pages.map((p) => p.key);
/** The started order: what the core has actually mounted. */
const coreEls = (stack: StackNav) => stack.stack.entries.map((e) => e.el);
const pageEls = (stack: StackNav) => stack.pages.map((p) => p.el);
const visible = (stack: StackNav) =>
  stack.pages.map((p) => p.el.classList.contains('sn-page-visible'));
const last = (name: string) => created.filter((p) => p.name === name).at(-1)!;

beforeEach(() => {
  created.length = 0;
  destroyed.length = 0;
  errors = [];
});

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('page order while the stack is busy', () => {
  it('projects a navigation made during a gesture before the core has started it', async () => {
    const { fixture, router, host, stack } = setup();
    await go(fixture, router, '/a');
    await go(fixture, router, '/b');

    const handle = stack.stack.beginInteractivePop()!;
    handle.update(0.3);
    expect(stack.stack.busy).toBe(true);

    await go(fixture, router, '/c');
    // The directive has projected the push; the core has not started it.
    expect(keys(stack)).toEqual(['a', 'b', 'c']);
    expect(stack.stack.entries.length).toBe(2);
    expect(stack.stack.busy).toBe(true);
    expect(stack.lastDirection).toBe('push');
    expect(host.activations.at(-1)).toMatchObject({ direction: 'push', reused: false });

    handle.cancel();
    await settle(fixture);
    expect(keys(stack)).toEqual(['a', 'b', 'c']);
    expect(coreEls(stack)).toEqual(pageEls(stack));
    expect(destroyed).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('tells the direction strategies the projected stack, not the core one', async () => {
    const seen: Array<{ from: string | undefined; to: string; stack: string[] }> = [];
    const { fixture, router, stack } = setup({
      // Asked after the hint, the browser and the kept stack, and answering
      // nothing: it only records what the directive passes in.
      direction: (ctx) => {
        seen.push({ from: ctx.from?.key, to: ctx.to.key, stack: [...(ctx.stack ?? [])] });
        return undefined;
      },
    });
    await go(fixture, router, '/a');
    await go(fixture, router, '/b');

    const handle = stack.stack.beginInteractivePop()!;
    handle.update(0.3);
    await go(fixture, router, '/c');
    await go(fixture, router, '/d');

    // For `/d` the stack is the projected one, three pages deep, while the
    // core has mounted only two of them. (`from` is the page the outlet just
    // detached, so it is `/c` either way.)
    expect(seen.at(-1)).toEqual({ from: 'c', to: 'd', stack: ['a', 'b', 'c'] });
    expect(stack.stack.entries.length).toBe(2);

    handle.cancel();
    await settle(fixture);
    expect(errors).toEqual([]);
  });

  it('pops back to a page only the projected order still keeps', async () => {
    const { fixture, router, host, stack } = setup();
    await go(fixture, router, '/a');
    await go(fixture, router, '/b');

    const handle = stack.stack.beginInteractivePop()!;
    handle.update(0.3);
    // Two pushes the core never starts: it is still showing `/a` under `/b`.
    await go(fixture, router, '/c');
    await go(fixture, router, '/d');
    expect(keys(stack)).toEqual(['a', 'b', 'c', 'd']);
    expect(stack.stack.entries.length).toBe(2);

    // Back to `/c`, which the projected order keeps beneath `/d`: a pop back
    // to it, and the pages above it go. The core has never heard of `/c`; its
    // own entries are still `/a` and `/b`.
    await go(fixture, router, '/c');
    expect(stack.lastDirection).toBe('pop');
    expect(host.activations.at(-1)).toMatchObject({ direction: 'pop', reused: true });
    expect(host.activations.at(-1)!.page.key).toBe('c');
    expect(keys(stack)).toEqual(['a', 'b', 'c']);
    // Still nothing started: all three operations are queued behind the gesture.
    expect(stack.stack.entries.length).toBe(2);
    expect(destroyed).toEqual([]);

    handle.cancel();
    await settle(fixture);
    // The queue drained onto the order the directive projected, and `/d` --
    // popped past -- was the only page dropped.
    expect(keys(stack)).toEqual(['a', 'b', 'c']);
    expect(coreEls(stack)).toEqual(pageEls(stack));
    expect(destroyed).toEqual(['d']);
    expect(visible(stack)).toEqual([false, false, true]);
    expect(router.url).toBe('/c');
    expect(errors).toEqual([]);
  });

  it('drains every queued push in order when the gesture ends', async () => {
    const { fixture, router, stack } = setup();
    await go(fixture, router, '/a');
    await go(fixture, router, '/b');
    const b = last('b');

    const handle = stack.stack.beginInteractivePop()!;
    await go(fixture, router, '/c');
    await go(fixture, router, '/d');

    handle.cancel();
    await settle(fixture);
    expect(keys(stack)).toEqual(['a', 'b', 'c', 'd']);
    expect(coreEls(stack)).toEqual(pageEls(stack));
    expect(visible(stack)).toEqual([false, false, false, true]);
    // The page the cancelled gesture had half-way off screen is still kept, and
    // still the same component.
    expect(destroyed).toEqual([]);
    expect(stack.pages[1].instance).toBe(b);
    expect(errors).toEqual([]);
  });

  it('empties and restores a suspended outlet across a gesture', async () => {
    const { fixture, router, stack } = setup();
    await go(fixture, router, '/shell/x');
    const shell = last('shell') as Shell;
    await go(fixture, router, '/shell/y');
    const inner = shell.stack();
    const els = pageEls(inner);
    expect(keys(inner)).toEqual(['shell/x', 'shell/y']);

    const handle = inner.stack.beginInteractivePop()!;
    handle.update(0.3);

    // Pushing a page over the shell detaches it, which empties the inner
    // outlet: the directive projects the emptied stack at once, while the core
    // still holds both pages, its `reset([])` queued behind the gesture.
    await go(fixture, router, '/b');
    expect(keys(inner)).toEqual([]);
    expect(inner.stack.entries.length).toBe(2);
    expect(keys(stack)).toEqual(['shell', 'b']);
    expect(destroyed).toEqual([]);

    // And back, still mid-gesture: the projected order is the one the outlet
    // was suspended with.
    await go(fixture, router, '/shell/y');
    expect(keys(inner)).toEqual(['shell/x', 'shell/y']);
    expect(pageEls(inner)).toEqual(els);

    handle.cancel();
    await settle(fixture);
    expect(keys(inner)).toEqual(['shell/x', 'shell/y']);
    expect(coreEls(inner)).toEqual(els);
    expect(visible(inner)).toEqual([false, true]);
    // Only the page the outer stack popped went; nothing inside the shell was
    // rebuilt or destroyed.
    expect(destroyed).toEqual(['b']);
    expect(errors).toEqual([]);
  });

  it('holds a lower page until the queue drains, then removes it', async () => {
    const { fixture, router, stack } = setup();
    await go(fixture, router, '/a');
    await go(fixture, router, '/b');
    await go(fixture, router, '/c');
    expect(keys(stack)).toEqual(['a', 'b', 'c']);

    const handle = stack.stack.beginInteractivePop()!;
    handle.update(0.3);

    // A pop straight to the bottom takes out `/b` from under the top page.
    await go(fixture, router, '/a');
    expect(stack.lastDirection).toBe('pop');
    expect(keys(stack)).toEqual(['a']);
    // The core still has all three mounted, and neither page is destroyed yet:
    // the directive drops a page from the projected order when it issues the
    // operation, and destroys it only when the core reports the removal.
    expect(stack.stack.entries.length).toBe(3);
    expect(destroyed).toEqual([]);

    handle.cancel();
    await settle(fixture);
    expect(keys(stack)).toEqual(['a']);
    expect(coreEls(stack)).toEqual(pageEls(stack));
    expect(destroyed).toEqual(['b', 'c']);
    expect(visible(stack)).toEqual([true]);
    expect(router.url).toBe('/a');
    expect(errors).toEqual([]);
  });
});
