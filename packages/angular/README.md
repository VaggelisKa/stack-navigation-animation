# @stacknav/angular

`<sn-outlet />`: a router outlet with the iOS push/pop transition, built on
[`@stacknav/core`](../core).

It is an outlet, not a router. Angular Router keeps doing everything it does:
routes, guards, resolvers, `routerLink`, `router.navigate`, lazy loading,
component input binding and browser history. The outlet only changes what
happens when the router activates a route: the page that was showing stays alive
beneath the new one, the change is animated, and a swipe from the leading edge
pops.

- **Works alongside the router.** There is no navigation API of its own. You
  navigate with the router, go back with `Location`, and read params as you
  already do.
- **Pages stay alive.** The page you came from is kept beneath the top one,
  hidden. Its scroll position, form state, signals and subscriptions are intact
  when you pop back, with nothing to restore.
- **Swipe back.** Drag from the leading edge and the page follows the pointer;
  the router follows the gesture, through `history.back()` when that lands on the
  right page. A `canDeactivate` guard that rejects puts the page back.
- **Configurable direction.** Whether a navigation is a push, a pop or a replace
  comes from strategies you order: an explicit hint, the browser's back/forward,
  the kept stack, numbers on your routes, or the route tree.

## Use

```ts
// main.ts
bootstrapApplication(App, {
  providers: [
    provideRouter(routes, withComponentInputBinding(), withRouterConfig({ canceledNavigationResolution: 'computed' })),
    provideStackNav(),
  ],
});
```

```html
<!-- app.html: the outlet needs a height; it is the pages' scroll container -->
<sn-outlet style="height: 100dvh" />
```

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

`canceledNavigationResolution: 'computed'` is optional but recommended. With the
router's default, a back navigation refused by a guard rewrites the history entry
the browser landed on.

## Deciding the direction

### Implicit: number your routes

Put a number on each route and the outlet does the rest. Navigating to a higher
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

### The full order

The defaults are
`[fromHint(), fromHistory(), fromStack(), fromLevel(), fromTree()]`, which give:

| Navigation | Direction | Because |
| --- | --- | --- |
| `/items` → `/items/42` | push | descendant in the route tree |
| `/items/42` → `/items` | pop | ancestor |
| browser back / forward | pop / push | history |
| `routerLink` to a page still kept beneath | pop | the stack |
| `/settings` (`data.stackLevel: 2`) → `/about` (`stackLevel: 3`) | push | numbering |
| `/items/1` → `/items/2` via `routerLink` | replace | siblings, once `StackNavRouteReuseStrategy` is provided (see below) |
| `router.navigate(['/items', 2], { info: { stacknav: 'push' } })` | push | explicit hint |

Change the order, drop a strategy, or add your own:

```ts
provideStackNav({
  direction: [fromHint(), fromHistory(), myTabStrategy, fromTree({ sameDepth: 'push' })],
  levelOf: (snapshot) => snapshot.data['order'],   // where numbers live (default data.stackLevel)
  keyOf: (snapshot) => snapshot.data['pageId'] ?? defaultKeyOf(snapshot), // what identifies a page
});
```

A strategy receives `{ from, to, trigger, historyDelta, hint, stack }`, where
`from` and `to` carry `{ key, segments, level, data, snapshot }`.

### Back buttons

A back button is `Location.back()`. After a deep link there is nothing to go back
to, so an app typically falls back to a route as a pop. That is a few lines of
app code using `Router`, `Location` and the browser's `navigation.canGoBack`; see
[`apps/angular-demo/src/app/back.ts`](../../apps/angular-demo/src/app/back.ts).

### Siblings

The router's default `RouteReuseStrategy` reuses the component when only params
change (`/items/1` → `/items/2`), so the outlet is never activated and nothing
animates. To make those separate pages, provide the strategy this package
exports, like any other:

```ts
{ provide: RouteReuseStrategy, useClass: StackNavRouteReuseStrategy }
```

Routes opt out of it with `data: { reuseRoute: true }`.

## API

### `provideStackNav(config?)`

| Option | Default | Description |
| --- | --- | --- |
| `direction` | core defaults | strategies in order, or one resolver function |
| `fallbackDirection` | `'push'` | used when no strategy has an answer |
| `levelOf(snapshot)` | `data.stackLevel` | the route's number |
| `keyOf(snapshot)` | the route's URL path | identity of a page |
| `infoKey` | `'stacknav'` | key in `NavigationExtras.info` for hints |
| `transition` | `{}` | `createIOSTransition` options for every outlet. The same options are CSS variables (`--sn-duration`, `--sn-easing`, `--sn-parallax`, `--sn-dim-max`, `--sn-shadow`, …) read off the outlet, so a stylesheet can retune them. See the [core README](../core#tuning-from-css) |
| `gesture` | `{}` | `createEdgePanGesture` options; `false` disables swiping |
| `detachInactiveViews` | `false` | detach change detection from hidden pages |
| `injectStyles` | `true` | insert the core stylesheet at runtime |
| `animated` | `true` | animate at all |

### `<sn-outlet>` (`StackNavOutlet`)

Inputs: `name`, `transition`, `gesture`, `routerOutletData`.

Outputs: `activate`, `deactivate`, `attach`, `detach` (as on `router-outlet`) and
`navigated` with `{ view, direction, animated, reused }`.

Properties: `stack` (the core `NavigationStack`, for `progress` events), `pages`
(kept pages, bottom to top), `canPop`, `lastDirection`.

Chrome that only has to move with the pages does not need `progress` at all: the
outlet carries `--sn-t` and `--sn-e` while a phase is in flight, and the two
pages taking part carry `sn-page-upper` and `sn-page-lower`, so a header or a tab
bar can transition off them and stay on the compositor with them.

Component inputs are bound when the router is configured with
`withComponentInputBinding()`: query params, params and data, in that order of
precedence, with unmatched inputs set to `undefined`. The router only binds
inputs for its own outlet, so this outlet does it itself and cannot see the
options passed to `withComponentInputBinding()`. Those options, and route
`resources`, are not honoured.

### `StackNavRouteReuseStrategy`

Opt-in; see [Siblings](#siblings) above.

## How it works

The outlet implements `RouterOutletContract`. When the router activates a route,
the outlet creates the component (or finds the kept one for that key), resolves
the direction, and asks the core stack to push, pop onto, or replace. Deactivated
pages are not destroyed until the stack drops them.

Each page gets an `ActivatedRoute` proxy whose observables switch to the route
object the router hands over when the page is reached again. Its nested outlet
contexts are saved and restored, so a `<router-outlet>` inside a kept page keeps
working.
