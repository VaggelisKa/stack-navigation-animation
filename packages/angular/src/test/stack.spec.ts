import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component, Directive, viewChild, type OnDestroy, type Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideAnimations, provideNoopAnimations } from '@angular/platform-browser/animations';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
  RouterOutlet,
  provideRouter,
  withRouterConfig,
  type Routes,
} from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideStackNav, type StackNavAnimationContext, type StackNavConfig } from '../lib/config';
import { StackNavHistory } from '../lib/history';
import { StackNav, type StackNavActivation } from '../lib/stack';

/**
 * These tests drive the real router against the real core stack in jsdom.
 * jsdom has no `Element.getAnimations`, so the core's `animationsFinished()`
 * resolves at once and every transition finishes within a microtask: the tests
 * pin what the stack does, not how long it takes. Anything that depends on
 * layout -- travel distances, the settle duration, an actual swipe -- belongs
 * in the demo's e2e run, where there is a browser.
 */

// ------------------------------------------------------------------ pages
/** Every page created, and the name of every page destroyed, in order. */
const created: PageBase[] = [];
const destroyed: string[] = [];

@Directive()
abstract class PageBase implements OnDestroy {
  abstract readonly name: string;
  /** Proves a kept page came back as it was rather than being rebuilt. */
  state = 0;
  constructor() {
    created.push(this);
  }
  ngOnDestroy(): void {
    destroyed.push(this.name);
  }
}

const last = (name: string) => created.filter((p) => p.name === name).at(-1)!;
const countOf = (name: string) => created.filter((p) => p.name === name).length;

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
@Component({ selector: 'page-item', template: 'item' })
class ItemPage extends PageBase {
  override readonly name = 'item';
}
@Component({ selector: 'page-kept', template: 'kept' })
class ReusedPage extends PageBase {
  override readonly name = 'reused';
}
@Component({ selector: 'page-x', template: 'x' })
class PageX extends PageBase {
  override readonly name = 'x';
}
@Component({ selector: 'page-y', template: 'y' })
class PageY extends PageBase {
  override readonly name = 'y';
}

/** A page with a stack of its own inside it: the nested-outlet case. */
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

/** Flipped by a test to make `/b` refuse to be left. */
let blockLeavingB = false;

/**
 * `stackLevel` is what says push or pop here. Without it these routes are all
 * siblings -- the same depth in the route tree -- and a tie means `replace`,
 * which is the library's default and is pinned by its own test below.
 */
const routes: Routes = [
  { path: 'a', component: PageA, data: { stackLevel: 0 } },
  { path: 'b', component: PageB, data: { stackLevel: 1 }, canDeactivate: [() => !blockLeavingB] },
  { path: 'c', component: PageC, data: { stackLevel: 2 } },
  { path: 'items/:id', component: ItemPage },
  // The one route that opts out of a page per sibling.
  { path: 'reused/:id', component: ReusedPage, data: { reuseRoute: true } },
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
function setup(config?: StackNavConfig, providers: Provider[] = []) {
  TestBed.configureTestingModule({
    providers: [
      // `computed` is what the library asks apps for, and it keeps the setup
      // check quiet.
      provideRouter(routes, withRouterConfig({ canceledNavigationResolution: 'computed' })),
      provideLocationMocks(),
      provideStackNav(config),
      ...providers,
    ],
  });
  const router = TestBed.inject(Router);
  // No app was bootstrapped, so nothing has told the router to listen for the
  // popstate an interactive pop produces.
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

/** Navigates and lets every queued stack task run to the end. */
async function go(
  fixture: ComponentFixture<unknown>,
  router: Router,
  url: string,
  extras?: Parameters<Router['navigateByUrl']>[1],
): Promise<void> {
  await router.navigateByUrl(url, extras);
  await settle(fixture);
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

/** Resolves when the navigation the stack asked for on its own reaches any end. */
function navigationSettled(router: Router): Promise<void> {
  return new Promise((resolve) => {
    const sub = router.events.subscribe((e) => {
      if (
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError ||
        e instanceof NavigationSkipped
      ) {
        sub.unsubscribe();
        setTimeout(resolve, 0);
      }
    });
  });
}

const visible = (el: HTMLElement) => el.classList.contains('sn-page-visible');
const keys = (stack: StackNav) => stack.pages.map((p) => p.key);

beforeEach(() => {
  created.length = 0;
  destroyed.length = 0;
  blockLeavingB = false;
});

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('StackNav', () => {
  it('mounts the first page without animating it', async () => {
    const { fixture, router, host, stack } = setup();
    await go(fixture, router, '/a');
    expect(stack.pages.length).toBe(1);
    expect(visible(stack.pages[0].el)).toBe(true);
    // Nothing to animate from: the first page of a stack just appears, however
    // the direction came out.
    expect(host.activations.length).toBe(1);
    expect(host.activations[0]).toMatchObject({ animated: false, reused: false });
    expect(host.activations[0].page.key).toBe('a');
  });

  it('keeps the page beneath alive and hidden on a push', async () => {
    const { fixture, router, host, stack } = setup();
    await go(fixture, router, '/a');
    await go(fixture, router, '/b');
    expect(keys(stack)).toEqual(['a', 'b']);
    // The page beneath is still mounted, still alive, and no longer visible.
    expect(destroyed).toEqual([]);
    expect(visible(stack.pages[0].el)).toBe(false);
    expect(visible(stack.pages[1].el)).toBe(true);
    expect(stack.pages[0].el.isConnected).toBe(true);
    expect(host.activations[1]).toMatchObject({ direction: 'push', animated: true, reused: false });
    expect(stack.lastDirection).toBe('push');
    expect(stack.canPop).toBe(true);
  });

  it('pops back to a kept page, destroying the page above it', async () => {
    const { fixture, router, host, stack } = setup();
    await go(fixture, router, '/a');
    const a = last('a');
    a.state = 42;
    await go(fixture, router, '/b');
    await go(fixture, router, '/a');

    expect(keys(stack)).toEqual(['a']);
    // The page came back as the router left it -- same component instance,
    // same state -- rather than being built again.
    expect(countOf('a')).toBe(1);
    expect(last('a')).toBe(a);
    expect(a.state).toBe(42);
    expect(destroyed).toEqual(['b']);
    expect(host.activations[2]).toMatchObject({ direction: 'pop', reused: true });
    expect(visible(stack.pages[0].el)).toBe(true);
  });

  it('swaps the top page for a replace hint', async () => {
    const { fixture, router, stack } = setup();
    await go(fixture, router, '/a');
    await go(fixture, router, '/b');
    await go(fixture, router, '/c', { info: { stacknav: 'replace' } });
    // `/b` is gone for good; `/a` is still the page beneath.
    expect(keys(stack)).toEqual(['a', 'c']);
    expect(destroyed).toEqual(['b']);
  });

  it('makes sibling params a page of their own, replacing the one before by default', async () => {
    const { fixture, router, host, stack } = setup();
    await go(fixture, router, '/items/1');
    await go(fixture, router, '/items/2');
    // The router's own strategy would have reused the component and never
    // activated the outlet, so nothing could animate. This one builds a second
    // page -- and, two routes of the same depth being a tie, replaces with it.
    expect(countOf('item')).toBe(2);
    expect(host.activations[1]).toMatchObject({ direction: 'replace', reused: false });
    expect(keys(stack)).toEqual(['items/2']);
    expect(destroyed).toEqual(['item']);
  });

  it('pushes between siblings when the app says a tie means push', async () => {
    const { fixture, router, stack } = setup({ siblings: 'push' });
    await go(fixture, router, '/items/1');
    await go(fixture, router, '/items/2');
    expect(keys(stack)).toEqual(['items/1', 'items/2']);
    expect(destroyed).toEqual([]);
  });

  it('reuses the component on a param change for a route that asks to', async () => {
    const { fixture, router, host, stack } = setup();
    await go(fixture, router, '/reused/1');
    const page = last('reused');
    page.state = 7;
    await go(fixture, router, '/reused/2');
    // `data: { reuseRoute: true }`: one component, one page, no activation.
    expect(countOf('reused')).toBe(1);
    expect(last('reused')).toBe(page);
    expect(page.state).toBe(7);
    expect(stack.pages.length).toBe(1);
    expect(host.activations.length).toBe(1);
  });

  it('reports every activation through stackNavActivate', async () => {
    const { fixture, router, host } = setup();
    await go(fixture, router, '/a');
    await go(fixture, router, '/b');
    await go(fixture, router, '/a');
    expect(host.activations.map((a) => [a.page.key, a.direction, a.animated, a.reused])).toEqual([
      ['a', 'push', false, false],
      ['b', 'push', true, false],
      ['a', 'pop', true, true],
    ]);
  });

  it('never animates when the app turned animation off', async () => {
    const { fixture, router, host } = setup({ animated: false });
    await go(fixture, router, '/a');
    await go(fixture, router, '/b');
    expect(host.activations.every((a) => !a.animated)).toBe(true);
  });

  it('asks the app about each navigation, telling it which pages it is between', async () => {
    const seen: StackNavAnimationContext[] = [];
    const { fixture, router } = setup({
      animated: (c) => {
        seen.push(c);
        return true;
      },
    });
    await go(fixture, router, '/a');
    // The first page of a stack never animates, and the question is never put:
    // the predicate is asked last, only once animating is still possible.
    expect(seen).toEqual([]);

    await go(fixture, router, '/b');
    expect(seen.length).toBe(1);
    expect(seen[0].trigger).toBe('imperative');
    expect(seen[0].from?.key).toBe('a');
    expect(seen[0].to.key).toBe('b');
    // The route refs are the ones the direction strategies were given, numbers
    // and route data included.
    expect(seen[0].to.level).toBe(1);

    const navigated = navigationSettled(router);
    TestBed.inject(Location).back();
    await navigated;
    await settle(fixture);
    // A browser back is a different question, and says so.
    expect(seen.length).toBe(2);
    expect(seen[1]).toMatchObject({ trigger: 'history' });
    expect(seen[1].from?.key).toBe('b');
    expect(seen[1].to.key).toBe('a');
  });

  it('honours the per-navigation `animated: false` hint', async () => {
    const { fixture, router, host } = setup();
    await go(fixture, router, '/a');
    await go(fixture, router, '/b', { info: { stacknav: { animated: false } } });
    expect(host.activations[1].animated).toBe(false);
  });

  describe('interactive pop', () => {
    it('brings the router back to the page the gesture revealed', async () => {
      const { fixture, router, stack } = setup();
      await go(fixture, router, '/a');
      await go(fixture, router, '/b');

      expect(stack.canPop).toBe(true);
      const handle = stack.stack.beginInteractivePop()!;
      handle.update(0.4);
      const navigated = navigationSettled(router);
      await handle.finish({ complete: true });
      await navigated;
      await settle(fixture);

      // The gesture is what moved the pages; the router only catches up.
      expect(router.url).toBe('/a');
      expect(keys(stack)).toEqual(['a']);
      expect(destroyed).toEqual(['b']);
      // And it caught up by going back, not by navigating forward to the same
      // URL: a forward navigation would have left an entry behind us.
      expect(TestBed.inject(StackNavHistory).canGoBack).toBe(false);
    });

    it('puts the page back when a guard refuses the navigation it asked for', async () => {
      const { fixture, router, stack } = setup();
      await go(fixture, router, '/a');
      await go(fixture, router, '/b');
      blockLeavingB = true;

      const handle = stack.stack.beginInteractivePop()!;
      const navigated = navigationSettled(router);
      await handle.finish({ complete: true });
      await navigated;
      await settle(fixture);

      // The page the gesture took off screen is still the router's, so it is
      // pushed back rather than destroyed.
      expect(router.url).toBe('/b');
      expect(keys(stack)).toEqual(['a', 'b']);
      expect(destroyed).toEqual([]);
      expect(visible(stack.pages[1].el)).toBe(true);
    });
  });

  describe('an outlet the router leaves', () => {
    it('drops the pages when the outlet is emptied and its own page stays', async () => {
      const { fixture, router, stack } = setup();
      await go(fixture, router, '/shell/x');
      const inner = last('shell') as Shell;
      await go(fixture, router, '/shell/y');
      expect(keys(inner.stack())).toEqual(['shell/x', 'shell/y']);
      // The stack's own outlet is still on screen, so an empty outlet means
      // the router left it for good.
      await go(fixture, router, '/shell');
      expect(inner.stack().pages).toEqual([]);
      expect(destroyed.sort()).toEqual(['x', 'y']);
      // The outer stack never noticed: the shell page is still its only page.
      expect(keys(stack)).toEqual(['shell']);
    });

    it('suspends and resumes a nested stack whose own page is kept', async () => {
      const { fixture, router, stack } = setup();
      await go(fixture, router, '/shell/x');
      const shell = last('shell') as Shell;
      const x = last('x');
      await go(fixture, router, '/shell/y');
      const y = last('y');

      // Pushing a page over the shell detaches the shell, and the router
      // detaches the page inside it first: the inner stack empties, but the
      // pages are the router's and stay alive.
      await go(fixture, router, '/b');
      expect(keys(stack)).toEqual(['shell', 'b']);
      expect(shell.stack().pages).toEqual([]);
      expect(destroyed).toEqual([]);

      // Coming back re-attaches the shell and the page it was showing, and the
      // inner stack comes back as it was, pages beneath included.
      await go(fixture, router, '/shell/y');
      expect(keys(stack)).toEqual(['shell']);
      expect(last('shell')).toBe(shell);
      expect(last('y')).toBe(y);
      expect(last('x')).toBe(x);
      expect(keys(shell.stack())).toEqual(['shell/x', 'shell/y']);
      // Only the page the outer stack popped was destroyed; nothing inside the
      // shell was ever rebuilt.
      expect(destroyed).toEqual(['b']);
    });
  });

  it('destroys the pages it is still holding when the stack itself goes', async () => {
    const { fixture, router, stack } = setup();
    await go(fixture, router, '/a');
    await go(fixture, router, '/b');
    expect(stack.pages.length).toBe(2);

    fixture.destroy();
    // `/a` is detached, so it belongs to nobody but the stack: it has to be
    // destroyed here or its injector and subscriptions leak.
    expect(destroyed.sort()).toEqual(['a', 'b']);
  });

  describe('document scrolling', () => {
    // jsdom has no scrolling: every offset reads as zero. All that can be
    // pinned here is that the mode reaches the core and that it is the
    // document the stack scrolls; where to is the core test and the e2e run.
    let scrolls: Array<{ top: number; behavior?: string }>;
    beforeEach(() => {
      scrolls = [];
      window.scrollTo = ((options: ScrollToOptions) => {
        scrolls.push({ top: options.top!, behavior: options.behavior });
      }) as typeof window.scrollTo;
    });

    it('is off by default: the document is never scrolled', async () => {
      const { fixture, router, stack } = setup();
      await go(fixture, router, '/a');
      await go(fixture, router, '/b');
      expect(stack.stack.scroll).toBe('page');
      expect(stack.stack.container.classList.contains('sn-scroll-document')).toBe(false);
      expect(scrolls).toEqual([]);
    });

    it('scrolls the document to each page as it arrives, and leaves restoration alone', async () => {
      const { fixture, router, stack } = setup({ scroll: 'document' });
      expect(stack.stack.scroll).toBe('document');
      expect(stack.stack.container.classList.contains('sn-scroll-document')).toBe(true);
      // `withInMemoryScrolling()`, or the browser, keeps whatever the app gave it.
      if ('scrollRestoration' in history) expect(history.scrollRestoration).toBe('auto');

      await go(fixture, router, '/a');
      await go(fixture, router, '/b');
      // The push switched the document to the new page's offset, instantly.
      expect(scrolls.length).toBeGreaterThan(0);
      expect(scrolls.every((s) => s.behavior === 'instant')).toBe(true);
      expect(scrolls.at(-1)).toEqual({ top: 0, behavior: 'instant' });
      // Nothing was left behind on the pages or the container once at rest.
      expect(stack.stack.container.style.height).toBe('');
      expect(stack.pages.every((p) => p.el.style.top === '')).toBe(true);
    });

    it("scrollRestoration: 'manual' asks for it explicitly", () => {
      if (!('scrollRestoration' in history)) return;
      const previous = history.scrollRestoration;
      try {
        setup({ scroll: 'document', scrollRestoration: 'manual' });
        expect(history.scrollRestoration).toBe('manual');
      } finally {
        // One switch for the whole document, and the specs share a document.
        history.scrollRestoration = previous;
      }
    });

    it('takes the mode from the outlet input over the configuration', () => {
      @Component({
        selector: 'document-host',
        imports: [RouterOutlet, StackNav],
        template: '<main><router-outlet stackNav stackNavScroll="document" /></main>',
      })
      class DocumentHost {
        readonly stack = viewChild.required(StackNav);
      }
      TestBed.configureTestingModule({
        providers: [
          provideRouter(routes, withRouterConfig({ canceledNavigationResolution: 'computed' })),
          provideLocationMocks(),
          provideStackNav(),
        ],
      });
      const fixture = TestBed.createComponent(DocumentHost);
      fixture.detectChanges();
      expect(fixture.componentInstance.stack().stack.scroll).toBe('document');
    });
  });

  describe("under Angular's animation renderer", () => {
    // `provideAnimations()` (and its noop twin) wrap the DOM renderer in one
    // that removes nothing at once: a `removeChild` is only noted, and the
    // animation engine carries it out when change detection ends, from
    // wherever the element is by then. The outlet detaches the page that is
    // leaving through that renderer, so putting the element back in the
    // container by hand is undone at the end of the very same tick, and the
    // new page would animate over nothing. Issue #55.
    const renderers = [
      ['provideAnimations', provideAnimations],
      ['provideNoopAnimations', provideNoopAnimations],
    ] as const;

    for (const [name, provide] of renderers) {
      describe(name, () => {
        it('keeps the page beneath in the DOM across a push', async () => {
          const { fixture, router, host, stack } = setup(undefined, [provide()]);
          await go(fixture, router, '/a');
          const a = stack.pages[0].el;
          await go(fixture, router, '/b');

          expect(keys(stack)).toEqual(['a', 'b']);
          expect(host.activations[1]).toMatchObject({ direction: 'push', animated: true });
          expect(a.isConnected).toBe(true);
          expect(a.parentElement).toBe(stack.stack.container);
          expect(visible(a)).toBe(false);
          expect(visible(stack.pages[1].el)).toBe(true);
        });

        it('shows the kept page again on a pop', async () => {
          const { fixture, router, stack } = setup(undefined, [provide()]);
          await go(fixture, router, '/a');
          const a = last('a');
          const el = stack.pages[0].el;
          await go(fixture, router, '/b');
          await go(fixture, router, '/a');

          expect(keys(stack)).toEqual(['a']);
          expect(last('a')).toBe(a);
          expect(destroyed).toEqual(['b']);
          expect(el.isConnected).toBe(true);
          expect(visible(el)).toBe(true);
        });

        it('keeps every page of a nested stack it suspends and resumes', async () => {
          const { fixture, router, stack } = setup(undefined, [provide()]);
          await go(fixture, router, '/shell/x');
          const shell = last('shell') as Shell;
          await go(fixture, router, '/shell/y');
          const [x, y] = shell.stack().pages.map((p) => p.el);
          await go(fixture, router, '/b');
          expect(keys(stack)).toEqual(['shell', 'b']);
          expect(destroyed).toEqual([]);

          await go(fixture, router, '/shell/y');
          expect(keys(stack)).toEqual(['shell']);
          expect(keys(shell.stack())).toEqual(['shell/x', 'shell/y']);
          expect(shell.stack().pages.map((p) => p.el)).toEqual([x, y]);
          expect(x.isConnected).toBe(true);
          expect(y.isConnected).toBe(true);
          expect(visible(y)).toBe(true);
          expect(destroyed).toEqual(['b']);
        });
      });
    }
  });
});
