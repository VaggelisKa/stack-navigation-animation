# @stacknav/angular

Native-style push and pop transitions on Angular's own `<router-outlet>`, built
on [`@stacknav/core`](../core).

Add the `stackNav` directive to an outlet. Angular Router continues to own
routes, URLs, guards, resolvers, lazy loading, inputs, nested outlets, and
browser history. stacknav keeps previous pages alive and animates the outlet's
existing component elements; it does not replace the router or add a navigation
API.

## Install

```sh
pnpm add @stacknav/angular
```

Angular 22 is required.

## Quick start

Register stacknav alongside the router:

```ts
import { provideStackNav } from '@stacknav/angular';

bootstrapApplication(App, {
  providers: [provideRouter(routes), provideStackNav()],
});
```

Add the directive to your outlet. The outlet's parent becomes the stack and
must have a height:

```html
<main style="height: 100dvh">
  <router-outlet stackNav />
</main>
```

That is the complete setup. Required styles are injected automatically, route
direction is inferred, and `StackNavRouteReuseStrategy` keeps inactive pages
alive. Continue to navigate with `routerLink`, `router.navigate()`, and
Angular's `Location` service.

The styles go into the shadow root the stack is in when it is in one, and carry
`CSP_NONCE` when you provide that token.

For input binding and reliable history restoration after a guard rejects Back,
these Router features are recommended:

```ts
provideRouter(
  routes,
  withComponentInputBinding(),
  withRouterConfig({ canceledNavigationResolution: 'computed' }),
);
```

## Direction

Each navigation resolves to `push`, `pop`, or `replace`. stacknav checks, in
order:

1. An explicit navigation hint.
2. Browser back or forward history.
3. Whether the target page is already kept in the stack.
4. Your optional `direction` rule.
5. Route numbers, then the route tree.

If nothing answers, `fallbackDirection` defaults to `push`. Routes at the same
number or tree depth default to `replace`; set `siblings: 'push'` to change
that.

### Route numbers

Use `data.stackLevel` when the route tree does not express the visual order:

```ts
export const routes: Routes = [
  { path: '', component: Home, data: { stackLevel: 1 } },
  { path: 'settings', component: Settings, data: { stackLevel: 2 } },
  { path: 'about', component: About, data: { stackLevel: 3 } },
];
```

Higher numbers push, lower numbers pop, and equal numbers follow `siblings`.
Routes without a number fall through to the route tree.

### Navigation hints

Pass a hint through Angular's `NavigationExtras.info`:

```ts
router.navigate(['/items', 2], { info: { stacknav: 'push' } });
router.navigate(['/login'], { info: { stacknav: 'replace' } });
router.navigate(['/items'], {
  info: { stacknav: { direction: 'pop', animated: false } },
});
```

### Application rule

Add one rule for application-specific route metadata. Return `undefined` to let
the default strategies continue:

```ts
provideStackNav({
  direction: ({ to }) => to.data?.['tab'] ? 'replace' : undefined,
});
```

For full control, provide `resolveDirection` using the strategy helpers from
`@stacknav/core`. It replaces the default resolver and ignores `direction` and
`siblings`.

## Configuration

`provideStackNav(config?)` configures every `stackNav` directive.

| Option              | Default           | Purpose                                                                           |
| ------------------- | ----------------- | --------------------------------------------------------------------------------- |
| `direction`         | none              | One application rule, evaluated before route guesses.                             |
| `siblings`          | `'replace'`       | Direction for equal route numbers or tree depth.                                  |
| `resolveDirection`  | core resolver     | Replaces direction resolution completely.                                         |
| `fallbackDirection` | `'push'`          | Used when no strategy answers.                                                    |
| `levelOf(snapshot)` | `data.stackLevel` | Reads a route's numeric level.                                                    |
| `keyOf(snapshot)`   | full route path   | Identifies pages kept in the stack.                                               |
| `infoKey`           | `'stacknav'`      | Key used for hints in `NavigationExtras.info`.                                    |
| `routeReuse`        | `true`            | Installs `StackNavRouteReuseStrategy`.                                            |
| `transition`        | `{}`              | Default `createNativeTransition` options.                                         |
| `swipeBack`         | `'browser'`       | Browser edge-gesture policy.                                                      |
| `injectStyles`      | `true`            | Injects the core stylesheet, tagged with `CSP_NONCE` when that token is provided. |
| `manageFocus`       | `false`           | Moves focus into the page arriving on top, and back on a pop.                     |
| `animated`          | `true`            | `false`, `'touch'`, or a predicate can disable animation.                         |

Set `animated: 'touch'` to animate only when the primary pointer is coarse, or
pass a function that is evaluated before each navigation. The function is given
that navigation's `{ trigger, from, to }`, so it can answer per navigation; a
function taking no arguments still works.

```ts
provideStackNav({ animated: ({ trigger }) => trigger === 'imperative' });
```

Every navigation animates by default, including one the browser's Back button
triggered. If you want to skip the transitions the browser already draws for
itself, the trigger is there to ask about. iOS Safari animates a snapshot of
the previous page during its edge swipe, so a pop on top of that plays twice:

```ts
import { isIOSBrowser } from '@stacknav/core';

provideStackNav({
  animated: ({ trigger }) => !(trigger === 'history' && isIOSBrowser()),
});
```

stacknav does not do this for you, because `popstate` does not say what moved
history. The edge swipe, the browser's own Back button and an app calling
`location.back()` from a back button of its own all arrive as the same event,
and only the first has anything animating beneath it. Which trade your app
wants is yours to pick.

Transition settings can also be CSS custom properties. CSS wins over the
matching JavaScript option:

```css
:root {
  --sn-duration: 340ms;
  --sn-parallax: 20%;
}
```

See the [core transition options](../core#native-transition) for the complete
list. Reduced-motion preferences are always honored.

## Directive API

`StackNav` is exported to templates as `stackNav`.

```html
<router-outlet
  stackNav
  [stackNavTransition]="transition"
  [stackNavSwipeBack]="swipeBack"
  (stackNavActivate)="onActivate($event)"
/>
```

| API                  | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| `stackNavTransition` | Per-stack transition options, read when the stack is created. |
| `stackNavSwipeBack`  | Live override of the configured swipe policy.                 |
| `stackNavActivate`   | Emits `{ page, direction, animated, reused }`.                |
| `stack`              | The underlying core `NavigationStack`.                        |
| `pages`              | Kept pages from bottom to top.                                |
| `canPop`             | Whether the stack contains a previous page.                   |
| `lastDirection`      | Direction of the latest activation.                           |

The outlet's own `activate`, `deactivate`, `attach`, and `detach` outputs remain
unchanged. Component inputs, named outlets, `ROUTER_OUTLET_DATA`, and route
resources also continue to work normally.

## Page retention

`provideStackNav()` installs `StackNavRouteReuseStrategy`. It uses Angular
Router's detach and attach mechanism to keep inactive pages alive, preserving
component state and scroll positions. It also treats parameter-only navigation,
such as `/items/1` to `/items/2`, as separate pages. Opt a route back into
Angular's default parameter reuse with `data: { reuseRoute: true }`.

If your app needs a custom `RouteReuseStrategy`, extend
`StackNavRouteReuseStrategy` and provide the subclass after
`provideStackNav()`. Without a compatible strategy, the directive cannot keep
the page that is animating out.

With `manageFocus: true`, one detail follows from the same mechanism. Angular
takes the outgoing page out of the DOM before the stack is told about the new
one, and the browser drops focus to the body at that moment, so there is no
focused control left for the stack to record. Coming back to a page therefore
focuses the page element rather than the control the user had left, which still
starts a screen reader at the top of the page that returned. The reattached
element is back in the document before focus moves, so that much is reliable.

Browser-owned state may reset when Angular detaches and reattaches an element:
iframes can reload, videos can pause, and CSS keyframe animations can restart.
A nested `<router-outlet stackNav>` keeps its own stack when its parent page is
temporarily detached.

## Container sizing

The outlet's parent is the page container and scroll viewport. Give it a fixed,
flex, or grid-derived height.

For a microfrontend below a shell header whose content slot has no height, use
`StackNavFillViewport` on a local wrapper:

```ts
@Component({
  imports: [RouterOutlet, StackNav, StackNavFillViewport],
  template: `
    <div stackNavFillViewport>
      <router-outlet stackNav />
    </div>
  `,
})
export class App {}
```

The helper fills from the wrapper's top edge to the visible viewport bottom and
tracks viewport and shell layout changes. Prefer normal CSS sizing when the
shell already provides a bounded content area.

## Swipe back

`swipeBack: 'browser'` leaves native browser gestures alone and is the default.
`'disabled'` requests document-wide suppression with
`overscroll-behavior-x`. Suppression is best effort: Safari and operating-system
gestures may ignore it, while Back buttons, keyboard navigation, and Router
history continue to work.

The package does not install a gesture recognizer. An installed PWA or native
webview that owns the edge can drive `stack.beginInteractivePop()` through the
directive's `stack` property; stacknav then synchronizes the result with Angular
Router.

## Custom chrome

During a transition, the stack element exposes `--sn-t` and `--sn-e`, and the
moving pages receive `sn-page-upper` and `sn-page-lower`. Use them to animate a
header or tab bar in CSS. Subscribe to `stack` progress events only when you
need the numeric transition progress.

## Development warnings

Development builds warn once when the stack container has no height, the active
route reuse strategy is incompatible, or Router uses the default
`canceledNavigationResolution`. These checks are removed from production
builds.
