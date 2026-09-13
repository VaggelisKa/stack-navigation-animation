# @stacknav/angular

`stackNav`: the native push/pop transition (iOS, or Android's own on Android)
on Angular's own `<router-outlet>`, built on [`@stacknav/core`](../core).

It is a directive, not an outlet. You keep the `<router-outlet>` you have, and
Angular Router keeps doing everything it does: routes, guards, resolvers,
`routerLink`, `router.navigate`, lazy loading, component input binding, nested
outlets and browser history. The directive sits on the outlet and only changes
what happens when the router activates a route: the page that was showing stays
alive beneath the new one and the change is animated. Interactive edge swiping
is opt-in.

- **Nothing to swap.** The pages are the outlet's own components, in the
  outlet's own elements. The directive never wraps or replaces them; it listens
  to the outlet and moves what is already there.
- **Works alongside the router.** There is no navigation API of its own. You
  navigate with the router, go back with `Location`, and read params as you
  already do.
- **Pages stay alive.** The page you came from is kept beneath the top one,
  hidden, through the router's own detach/attach mechanism. Its scroll
  position, form state, signals and subscriptions are intact when you pop back,
  with nothing to restore.
- **Interactive pop, if you drive it.** The directive ships no gesture: in a
  browser tab the browser owns the edge. An app that owns it can drive
  `stack.beginInteractivePop()`, and the router follows, through
  `history.back()` when that lands on the right page. A `canDeactivate` guard
  that rejects puts the page back.
- **Direction it works out itself.** Whether a navigation is a push, a pop or a
  replace comes from an explicit hint, the browser's back/forward, the kept
  stack, numbers on your routes, or the route tree -- in that order, with
  nothing to configure. Add one rule of your own when they get it wrong.

## Use

Two lines, and no options for the usual app:

```ts
// main.ts
bootstrapApplication(App, {
  providers: [provideRouter(routes), provideStackNav()],
});
```

```html
<!-- app.html: the element around the outlet is the stack; it needs a height -->
<div style="height: 100dvh">
  <router-outlet stackNav />
</div>
```

That is the whole setup. No stylesheet to import, no routes to annotate, no
directive to add to a page: `provideStackNav()` injects the engine's CSS, decides
the direction of every navigation on its own, and installs
[`StackNavRouteReuseStrategy`](#the-strategy), which is how the router keeps a
page alive when it leaves it and why `/items/1` → `/items/2` is a page of its
own rather than a reused component. Everything below is optional.

The router inserts each page next to its outlet, so the outlet's parent element
is the stack: it clips and scrolls the pages, and needs a height of its own.
Anything else in there -- a progress bar, a tab bar -- is chrome that sits over
the pages.

Two router options are worth adding all the same:

```ts
provideRouter(routes, withComponentInputBinding(), withRouterConfig({ canceledNavigationResolution: 'computed' }));
```

`withComponentInputBinding()` lets pages read their params as `input()`s, and
`'computed'` keeps a back navigation that a guard refuses from rewriting the
history entry the browser landed on -- a development build says so once if the
router was left on its default.

```css
/* styles.css: the transition's options are custom properties, all optional */
:root { --sn-duration: 340ms; --sn-parallax: 20%; }
```

A variable that is set wins over the matching `provideStackNav({ transition })`
option, so the stylesheet has the final say on how the animation feels.

```ts
// a page, using nothing from this library
@Component({
  imports: [RouterLink],
  template: `
    <button (click)="location.back()">‹ Back</button>
    <h1>{{ id() }}</h1>
    <a routerLink="reviews">Reviews</a>`,
})
export class Item {
  readonly id = input.required<string>(); // bound by withComponentInputBinding()
  readonly location = inject(Location);
}
```


## Swipe-back modes

```ts
provideStackNav({ swipeBack: 'browser' });  // default: leave browser gestures alone
provideStackNav({ swipeBack: 'disabled' }); // request browser swipe suppression
```

Change a single stack live with `<router-outlet stackNav [stackNavSwipeBack]="mode()" />`.
Changing modes preserves the pages, URL and history.

**There is no gesture of our own to choose.** Suppression cannot stop Safari's
edge swipe, so a recognizer next to it reads as two backs at once. An app that
owns the edge -- an installed PWA, a native webview -- can drive the stack's
`beginInteractivePop()` from its own pointer handling; the directive treats the
resulting pop exactly as it treated the old gesture's, syncing the router and
restoring the page if a guard refuses.

```ts
readonly nav = viewChild.required(StackNav);
// on your own pointerdown/pointermove/pointerup
const pop = this.nav().stack.beginInteractivePop();
pop?.update(1 - dx / width);
void pop?.finish({ complete: dx > width / 2, velocity });
```

The demos let you try both modes in **Lab → Swipe back** (Angular) or
**Options → Swipe back** (vanilla).

Browser suppression uses `overscroll-behavior-x: contain` on the document root.
It is **document-wide and best effort**, not a guarantee against Safari edge
navigation or OS gestures. A `browser` stack cannot undo another stack's
suppression request; the original inline declaration is restored after the last
request ends or its stack is destroyed. Avoid enabling suppression in a stack
when the rest of the document should retain native swipe navigation.
See the [CSS specification](https://drafts.csswg.org/css-overscroll/) and
[WebKit's history navigation limitation](https://bugs.webkit.org/show_bug.cgi?id=240183).
Browser Back/Forward buttons, keyboard navigation, router guards, page retention
and push/pop animation are independent of this policy.

## Deciding the direction

### Implicit: number your routes

Put a number on each route and the stack does the rest. Navigating to a higher
number pushes, a lower one pops, and the same number replaces. This needs no
hints and no extra calls: use `routerLink` and `router.navigate` as usual.

```ts
export const routes: Routes = [
  { path: '',         component: Home,     data: { stackLevel: 1 } },
  { path: 'settings', component: Settings, data: { stackLevel: 2 } },
  { path: 'about',    component: About,    data: { stackLevel: 3 } },
];
```

The property name is configurable:
`provideStackNav({ levelOf: (snapshot) => snapshot.data['depth'] })`. Routes
without a number fall through to the route tree, where a descendant pushes and an
ancestor pops, so you only need to number the screens the tree gets wrong.

### Explicit: a hint on the navigation

For a navigation that should go against the numbers, pass a hint through the
router's own `NavigationExtras.info`, under the `stacknav` key:

```ts
router.navigate(['/items', 2], { info: { stacknav: 'push' } });                           // force a push
router.navigate(['/login'], { info: { stacknav: 'replace' } });                            // swap the top page
router.navigate(['/x'], { info: { stacknav: { direction: 'pop', animated: false } } });   // no animation
```

### The order

You do not order anything. Five questions are asked, and the first with an
answer wins:

| # | Question | Answer |
| --- | --- | --- |
| 1 | Did the navigation say so? | the hint, e.g. `{ info: { stacknav: 'pop' } }` |
| 2 | Was it the browser's back or forward button? | pop / push |
| 3 | Is the target still alive beneath this page? | pop back to it |
| 4 | Does your own rule have an opinion? | whatever it returns |
| 5 | Do the routes carry numbers, or say so by their URLs? | higher / deeper pushes, lower / shallower pops |

Nothing left at all: `push`, or `fallbackDirection`. So, out of the box:

| Navigation | Direction | Because |
| --- | --- | --- |
| `/items` → `/items/42` | push | descendant in the route tree |
| `/items/42` → `/items` | pop | ancestor |
| browser back / forward | pop / push | history |
| `routerLink` to a page still kept beneath | pop | the stack |
| `/settings` (`data.stackLevel: 2`) → `/about` (`stackLevel: 3`) | push | numbering |
| `/items/1` → `/items/2` via `routerLink` | replace | siblings |
| `router.navigate(['/items', 2], { info: { stacknav: 'push' } })` | push | explicit hint |

### Two knobs

If siblings should push rather than swap in place -- a wizard's steps, a feed
that keeps opening posts -- say so once:

```ts
provideStackNav({ siblings: 'push' });
```

That covers both ties: two routes at the same depth, and two carrying the same
`stackLevel`.

For anything the five questions cannot know, add one rule of your own. It is
asked at step 4, so it overrides the guesses without ever fighting an explicit
hint or the browser's back button:

```ts
provideStackNav({
  direction: ({ from, to }) => (to.data?.['tab'] ? 'replace' : undefined),  // undefined: let the library decide
});
```

A rule receives `{ from, to, trigger, historyDelta, hint, stack }`, where `from`
and `to` carry `{ key, segments, level, data, snapshot }`. Because `data` is the
route's own data, a rule can work off metadata your routes already carry. An app
that names its routes the way Angular's route-transition recipe does
(`data: { animation: 'Thread' }`) keeps those names and looks the from/to pair up
in a `transition('Inbox => Thread')`-style table; see the Mail demo's
[`animation.ts`](../../apps/angular-demo/src/app/demos/mail/animation.ts).

Where the numbers and the identity of a page come from is configurable too:

```ts
provideStackNav({
  levelOf: (snapshot) => snapshot.data['order'],                          // default data.stackLevel
  keyOf: (snapshot) => snapshot.data['pageId'] ?? defaultKeyOf(snapshot), // default the URL path
});
```

### Replacing the whole thing

The five questions are themselves ordinary functions, exported by
`@stacknav/core`. An app that needs an order of its own -- to outrank even a
hint, or to drop a question entirely -- composes them and hands over a resolver,
which ignores `direction` and `siblings`:

```ts
import { createDirectionResolver, byHint, byRouteTree } from '@stacknav/core';

provideStackNav({
  resolveDirection: createDirectionResolver([myRule, byHint(), byRouteTree({ siblings: 'push' })], 'push'),
});
```

### Back buttons

A back button is `Location.back()`. After a deep link there is nothing to go back
to, so an app typically falls back to a route as a pop. That is a few lines of
app code using `Router`, `Location` and the browser's `navigation.canGoBack`; see
[`apps/angular-demo/src/app/back.ts`](../../apps/angular-demo/src/app/back.ts).

### The strategy

`provideStackNav()` installs `StackNavRouteReuseStrategy` as the router's
`RouteReuseStrategy`. It is the one piece of router configuration the directive
depends on, and it does two things.

When the router leaves a route a stack is showing, the strategy asks the router
to *detach* the page rather than destroy it, and to *attach* the same page when
the route is reached again. That is the router's own mechanism for keeping a
route alive, so the page's `ActivatedRoute` observables keep emitting, a nested
`<router-outlet>` inside it comes back with its children, and bound inputs are
rebound -- none of it reimplemented here. The stack decides when a kept page is
dropped for good (after a pop, or a replace) and destroys it then.

The router's default strategy also reuses the component when only params change
(`/items/1` → `/items/2`), so the outlet is never activated and nothing
animates. The strategy makes those separate pages. Routes opt out one at a time
with `data: { reuseRoute: true }`.

An app that must provide a `RouteReuseStrategy` of its own extends this one and
provides it after `provideStackNav()`, which wins either way; a development build
says so once if the strategy in force is not a `StackNavRouteReuseStrategy`.

One thing to know about the router's mechanism: detaching takes the page's
element out of the DOM, and attaching puts it back. The directive keeps the
element mounted, hidden, in between, and restores every scroll offset inside the
page around both moves, so scroll position survives as before. What a removal
and reinsertion does reset is browser-side state that lives on the node: an
`<iframe>` inside a kept page reloads, a playing `<video>` pauses, and a CSS
animation restarts from its first keyframe.

### Mobile only

The transition is an iOS idiom, and plenty of apps want it on handhelds and a
plain instant change on a desktop. `animated: 'touch'` is that: it animates where
the primary pointer is coarse, and not where it is a mouse. It is asked before
every navigation, so a tablet that gets docked to a trackpad is handled too.

```ts
provideStackNav({ animated: 'touch' });
```

`isTouchPrimary()` is exported from `@stacknav/core` for the same decision made
once rather than per navigation — pointer handling of your own, for instance,
if you only want it where the pointer is coarse.

Pass a function instead of `'touch'` to decide it yourself, e.g. from a user
setting or the window's width:

```ts
provideStackNav({ animated: () => window.innerWidth < 768 });
```

Turning animation off does not change any of the rest: pages beneath the top are
still kept alive with their scroll position and state, and the direction is still
resolved, so `pop` still restores the page you came from rather than rebuilding
it.

## API

### `provideStackNav(config?)`

| Option | Default | Description |
| --- | --- | --- |
| `direction` | none | one rule of your own, asked before the library guesses |
| `siblings` | `'replace'` | what a tie means: same depth, or same `stackLevel` |
| `resolveDirection` | core defaults | replaces direction resolution entirely |
| `fallbackDirection` | `'push'` | used when no strategy has an answer |
| `levelOf(snapshot)` | `data.stackLevel` | the route's number |
| `keyOf(snapshot)` | the route's URL path | identity of a page |
| `infoKey` | `'stacknav'` | key in `NavigationExtras.info` for hints |
| `routeReuse` | `true` | install `StackNavRouteReuseStrategy`; see [The strategy](#the-strategy) |
| `transition` | `{}` | `createNativeTransition` options for every stack: `platform` (`'auto'`, `'ios'`, `'android'`), duration, curve and the rest. The same options are CSS variables (`--sn-duration`, `--sn-easing`, `--sn-parallax`, `--sn-dim-max`, `--sn-shadow`, …) read off the stack element, so a stylesheet can retune them. See the [core README](../core#tuning-from-css) |
| `swipeBack` | `browser` | `browser` or `disabled`; see the browser suppression limitations above |
| `injectStyles` | `true` | insert the core stylesheet at runtime |
| `animated` | `true` | animate at all. `'touch'` only on a coarse pointer, or a predicate asked before every navigation; see [Mobile only](#mobile-only) |

### `stackNav` (`StackNav`)

Goes on a `<router-outlet>`; its parent element is the stack. Exported as
`stackNav` for template references (`#nav="stackNav"`).

Inputs: `stackNavTransition`, `stackNavSwipeBack`.

Outputs: `stackNavActivate` with `{ page, direction, animated, reused }`. The
outlet's own `activate`, `deactivate`, `attach` and `detach` outputs keep
working next to it.

Properties: `stack` (the core `NavigationStack`, for `progress` events and
`beginInteractivePop()`), `pages` (kept pages, bottom to top, each with its
component `instance`, element `el`, `key` and last `url`), `canPop`,
`lastDirection`.

Chrome that only has to move with the pages does not need `progress` at all: the
stack element carries `--sn-t` and `--sn-e` while a phase is in flight, and the
two pages taking part carry `sn-page-upper` and `sn-page-lower`, so a header or
a tab bar can transition off them and stay on the compositor with them. The two
properties stop at each page component's children, so that a phase starting
never re-resolves the style of a kept page's content; a page that wants them
inside lifts that barrier with `.sn-page > * { --sn-t: inherit; --sn-e: inherit }`
(see the [core README](../core#your-own-chrome)).

Component inputs, `ROUTER_OUTLET_DATA`, named outlets and route `resources` are
all the outlet's own business and work exactly as they do without the directive.

### `StackNavRouteReuseStrategy`

Installed by `provideStackNav()`; see [The strategy](#the-strategy). Exported so
an app can extend it, and provide the subclass after `provideStackNav()`.

### Development-only warnings

A development build checks the things around the stack that fail silently and
says each once, in the console: an element around the outlet that is 0px tall,
a `RouteReuseStrategy` that is not the library's, and a router left on its
default `canceledNavigationResolution`. All checks, and their messages, are
folded out of a production build.

## How it works

The directive injects the `RouterOutlet` it sits on and subscribes to its
`activate`, `attach`, `detach` and `deactivate` outputs. When the router
leaves a route, `StackNavRouteReuseStrategy` has it detach the page; the
directive puts the element back into the outlet's parent, hidden, and resolves
the direction of the navigation once the outlet activates the next page. It then
asks the core stack to push the new page over the kept one, pop onto it, or
replace it. A page the router has detached is only destroyed once the stack
drops it. Which page paints on top is decided by `z-index`, so the directive
never has to reorder the elements the outlet placed.
