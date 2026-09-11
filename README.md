# stacknav

iOS-style push/pop navigation for the web. A framework-agnostic core plus
per-framework ports that sit alongside the framework's router rather than
replacing it.

| Package | Description |
| --- | --- |
| [`@stacknav/core`](packages/core) | The engine: a stack of page elements, the iOS transition (slide, parallax, dim, shadow), an interactive edge-swipe pop, direction resolution, and a `history.state` adapter for apps without a router. No dependencies. |
| [`@stacknav/angular`](packages/angular) | `<sn-outlet />`, a router outlet for Angular Router that keeps pages alive beneath the top one, animates every navigation, and supports swipe-back. It adds no navigation API of its own: the router, `routerLink` and `Location` handle navigation. |
| `@stacknav/react` | Planned. |

Demos: [`apps/demo`](apps/demo) (vanilla, no router) and
[`apps/angular-demo`](apps/angular-demo) (Angular router).

## How it works

The transition is a function of one number, `p`: how much of the upper page is
visible. Push runs `p` from 0 to 1, pop from 1 to 0, and a swipe sets `p`
directly from the pointer position.

Pages below the top stay mounted and hidden, so scroll position, form state and
focus are preserved when you navigate back.

The frames, though, are the browser's. A push writes `p` twice, once at each
end, and hands CSS that phase's duration and curve; a drag writes it per pointer
move with the duration pinned at `0s`. Nothing runs per frame and nothing
measures layout, so the transition stays on the compositor even when the main
thread is busy.

### Direction resolution

The engine does not decide whether a navigation is a push or a pop. Apps differ:
some number their screens, some read the route tree, some rely on the browser's
back button, some state the direction per navigation. Direction is resolved by an
ordered list of strategies; the first one with an answer wins.

```ts
import { fromHint, fromHistory, fromStack, fromLevel, fromTree } from '@stacknav/core';

// the default order
[fromHint(), fromHistory(), fromStack(), fromLevel(), fromTree()]
```

| Strategy | Answers when |
| --- | --- |
| `fromHint()` | the navigation carried an explicit `push` / `pop` / `replace` |
| `fromHistory()` | the browser's back button (pop) or forward button (push) triggered it |
| `fromStack()` | the target page is still kept beneath the current one: pop back to it |
| `fromLevel()` | both routes carry a number (`level`): higher pushes, lower pops |
| `fromTree()` | the target is a descendant (push) or an ancestor (pop) of the current route; otherwise deeper pushes and shallower pops |

A custom strategy is a function `(ctx) => 'push' | 'pop' | 'replace' | undefined`
placed anywhere in the list.

### Styling

Duration, curve, parallax, dim and shadow are CSS custom properties on the
container, so an app can retune the transition from a stylesheet instead of
rebuilding the engine:

```css
:root { --sn-duration: 340ms; --sn-easing: cubic-bezier(0.4, 0, 0.2, 1); --sn-parallax: 20%; }
```

Every property is optional; unset means the iOS default. The
[core README](packages/core#tuning-from-css) lists them all. The same values are
available as JS options.

## The Angular demo

The home page demonstrates the router mechanics on small pages. Above them are
eight demo apps, each with its own design and layout, backed by a fake API that
responds after a delay and can be made to fail. This makes it possible to watch
the transition while content is loading, arriving mid-transition, or failing.

| Demo | Layout | What it covers |
| --- | --- | --- |
| Feed | cards, cover + tabs profile | skeletons, "load more", likes preserved on cards you pop back to, cross-links that always push (`[pushTo]`) |
| Shop | 2-column grid, full-bleed hero, sticky buy bar | a `resolve` that delays the push until the product loads, a cart, a checkout form whose success page replaces it (both page and history entry), pop to root |
| Messages | inbox, chat bubbles, composer pinned to the bottom | scroll-to-bottom on a page that is itself the scroll container, replies arriving after you popped away |
| Gallery | 3-column tiles, dark full-screen viewer, filmstrip | dim over a dark page, siblings replaced in place vs pushed, `@defer`, swiping between dark pages |
| Forms | iOS grouped settings, long form, wizard | inputs preserved while away, async save, steps ordered by `stackLevel`, a replaced final step, pop to root |
| Search | search field in the header | debounced requests cancelled in flight, the query in the URL, results that push pages of other demos |
| Dashboard | segmented tabs, stat tiles, bar chart, wide table | a nested `<router-outlet>` inside a kept page, tabs that replace their history entry |
| Lab | controls and stress pages | slow motion, swipe from anywhere, API latency and failures, a 600-row page, a stack five siblings deep, a 2 s resolver, horizontal scrollers under the edge swipe |

`pnpm e2e` builds the demo and drives it in Chromium: `e2e/run.mjs` covers the
mechanics, `e2e/demos.mjs` covers the demo apps.

## Develop

```sh
pnpm install
pnpm build          # packages/core, then packages/angular
pnpm test           # core unit tests (node:test, no browser), including tree-shaking checks
pnpm size           # what each package costs a consumer, minified + gzipped (after a build)
pnpm e2e            # builds the Angular demo and drives it in Chromium
pnpm dev:demo       # vanilla demo
pnpm dev:angular    # Angular demo on http://localhost:4200
```

Node 22.18+ runs the core; its tests use Node's built-in TypeScript stripping.
The Angular tooling requires Node 22.22.3+ or 24.

The demo runs without zone.js, so a click's view update lands on the next
animation frame. The e2e helpers wait for one frame before reading the DOM.

## Layout

```
packages/core/          @stacknav/core     TypeScript, built with tsc to dist/
packages/angular/       @stacknav/angular  built with ng-packagr to dist/
apps/demo/              vanilla demo (esbuild → dist/demo.html)
apps/angular-demo/      Angular CLI app + Playwright e2e (e2e/run.mjs)
```
