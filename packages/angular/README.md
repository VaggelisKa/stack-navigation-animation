# @stacknav/angular

`<sn-outlet />`: an Angular router outlet with the iOS push/pop transition, built on [`@stacknav/core`](../core).

- **Drop-in.** Replace `<router-outlet>` with `<sn-outlet />`, add `provideStackNav()` next to `provideRouter()`. Routes, guards, resolvers, `routerLink`, lazy loading and component input binding work as before.
- **Pages stay alive.** The page you came from is kept beneath the top, hidden. Its scroll position, form state, signals and subscriptions are intact when you pop back. Nothing to restore.
- **Swipe back.** Drag from the leading edge and the page follows the finger; the router follows the gesture (through `history.back()` when that lands on the right page). A `canDeactivate` guard that says no puts the page back.
- **Nothing prescribed.** Whether a navigation is a push, a pop or a replace comes from strategies you order: an explicit hint, the browser's back/forward, the kept stack, numbers on your routes, or the route tree.

## Use

```ts
// main.ts
bootstrapApplication(App, {
  providers: [
    provideRouter(routes, withRouterConfig({ canceledNavigationResolution: 'computed' })),
    provideStackNav(),
  ],
});
```

```html
<!-- app.html: the outlet needs a height; it is the pages' scroll container -->
<sn-outlet style="height: 100dvh" />
```

```ts
// a page
@Component({
  imports: [StackNavBack],
  template: `
    <button snBack="/items">‹ Back</button>
    <h1>{{ id() }}</h1>`,
})
export class Item {
  readonly id = input.required<string>(); // with withComponentInputBinding() + provideStackNav({ bindToComponentInputs: true })
}
```

`canceledNavigationResolution: 'computed'` is optional but recommended: with the router's default, a back navigation refused by a guard rewrites the history entry the browser landed on.

## Deciding the direction

The defaults are `[fromHint(), fromHistory(), fromStack(), fromLevel(), fromTree()]`, so out of the box:

| Navigation | Direction | Because |
| --- | --- | --- |
| `/items` → `/items/42` | push | descendant in the route tree |
| `/items/42` → `/items` | pop | ancestor |
| browser back / forward | pop / push | history |
| `routerLink` to a page still kept beneath | pop | the stack |
| `/settings` (`data.stackLevel: 2`) → `/about` (`stackLevel: 3`) | push | numbering |
| `/items/1` → `/items/2` via `routerLink` | replace | siblings |
| `nav.push(['/items', 2])` | push | explicit hint |

Change the order, drop a strategy, or add your own:

```ts
provideStackNav({
  direction: [fromHint(), fromHistory(), myTabStrategy, fromTree({ sameDepth: 'push' })],
  levelOf: (snapshot) => snapshot.data['order'],   // where numbers live (default data.stackLevel)
  keyOf: (snapshot) => snapshot.data['pageId'] ?? defaultKeyOf(snapshot), // what identifies a page
});
```

A strategy sees `{ from, to, trigger, historyDelta, hint, stack }` where `from`/`to` carry `{ key, segments, level, data, snapshot }`.

Per navigation:

```ts
const nav = inject(StackNav);
nav.push(['/items', 2]);                        // force a push
nav.replace(['/login']);                        // swap the top page, no animation
nav.navigate(['/x'], { direction: 'pop', animated: false });
nav.pop('/');                                   // history back, or navigate to '/' as a pop after a deep link
router.navigate(['/x'], { state: { stacknav: 'pop' } }); // the same hint by hand
```

## API

### `provideStackNav(config?)`

| Option | Default | |
| --- | --- | --- |
| `direction` | core defaults | strategies in order, or one resolver function |
| `fallbackDirection` | `'push'` | when no strategy has an opinion |
| `levelOf(snapshot)` | `data.stackLevel` | the route's number |
| `keyOf(snapshot)` | the route's URL path | identity of a page |
| `stateKey` | `'stacknav'` | `history.state` key for hints |
| `transition` | `{}` | `createIOSTransition` options for every outlet |
| `gesture` | `{}` | `createEdgePanGesture` options; `false` disables swiping |
| `bindToComponentInputs` | `false` | set inputs from params, query params and data, like `withComponentInputBinding()` |
| `detachInactiveViews` | `false` | detach change detection from hidden pages |
| `injectStyles` | `true` | insert the core stylesheet at runtime |
| `reuseStrategy` | `true` | provide a `RouteReuseStrategy` under which `/items/1` → `/items/2` is a new page. Routes opt out with `data: { reuseRoute: true }` |
| `animated` | `true` | animate at all |

### `<sn-outlet>` (`StackNavOutlet`)

Inputs: `name`, `transition`, `gesture`, `routerOutletData`. Outputs: `activate`, `deactivate`, `attach`, `detach` (like `router-outlet`) and `navigated` with `{ view, direction, animated, reused }`. Properties: `stack` (the core `NavigationStack`, for `progress` events — though chrome that just needs to move with the pages can read `--sn-t` / `--sn-e` and the `sn-page-upper` / `sn-page-lower` classes in CSS instead), `pages` (kept pages, bottom to top), `canPop`, `lastDirection`.

### `StackNav`

`navigate`, `navigateByUrl`, `push`, `replace`, `pop(fallback?)`. Extras accept `direction` and `animated` on top of the router's.

### `[snBack]` (`StackNavBack`)

A click goes back through history, or to the given fallback as a pop when there is no history.

### `StackNavHistory`

The model of browser history the outlet uses: `previousUrl`, `currentUrl`, `canGoBack`, and `current` (the navigation in flight, with `trigger`, `historyDelta`, `hint`).

## How it works

The outlet implements `RouterOutletContract`. When the router activates a route it creates the component (or finds the kept one for that key), resolves the direction, and asks the core stack to push, pop onto, or replace. Deactivated pages are not destroyed until the stack drops them. Each page gets an `ActivatedRoute` proxy whose observables switch to the route object the router hands over when the page is reached again, and its nested outlet contexts are saved and restored, so a `<router-outlet>` inside a kept page keeps working.
