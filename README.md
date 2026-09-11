# stacknav

iOS-style push/pop navigation for the web: a framework-agnostic core, and ports that sit alongside a framework's router rather than replacing it.

| Package | What it is |
| --- | --- |
| [`@stacknav/core`](packages/core) | The engine. A stack of page elements, the UIKit transition (slide, parallax, dim, shadow), an interactive edge-swipe pop, direction resolution, and a `history.state` adapter for router-less apps. No dependencies. |
| [`@stacknav/angular`](packages/angular) | `<sn-outlet />`, a router outlet for Angular Router that keeps pages alive beneath the top, animates every navigation, and swipes back. No navigation API of its own: the router, `routerLink` and `Location` do that. |
| `@stacknav/react` | Planned. |

Demos: [`apps/demo`](apps/demo) (vanilla, no router) and [`apps/angular-demo`](apps/angular-demo) (Angular router).

## The Angular demo

The home page shows the router mechanics on small pages. Above them sit eight demo apps, each with its own design and layout, all backed by a fake API that answers after a delay (and can be told to fail), so the transition can be watched around content that is loading, arriving mid-flight, or failing:

| Demo | Layout | What it exercises |
| --- | --- | --- |
| Feed | cards, cover + tabs profile | skeletons, "load more", likes kept on popped-back-to cards, cross-links that always push (`[pushTo]`) |
| Shop | 2-column grid, full-bleed hero, sticky buy bar | a `resolve` that holds the push until the product is loaded, a cart, a checkout form whose success page *replaces* it (page and history entry), pop to root |
| Messages | inbox, chat bubbles, composer stuck to the bottom | scroll-to-bottom on a page that is the scroll container, replies that arrive after you popped away |
| Gallery | 3-column tiles, dark full-screen viewer, filmstrip | dim over a dark page, siblings replaced in place vs pushed, `@defer`, swipe between dark pages |
| Forms | iOS grouped settings, long form, wizard | inputs kept while away, async save, steps ordered by `stackLevel`, a replaced ending, pop to root |
| Search | search field in the header | debounced requests cancelled in flight, the query in the URL, results that push pages of other demos |
| Dashboard | segmented tabs, stat tiles, bar chart, wide table | a nested `<router-outlet>` inside a kept page, tabs that replace their history entry |
| Lab | knobs and stress pages | slow motion, swipe from anywhere, API latency and failures, a 600-row page, a stack five siblings deep, a 2 s resolver, horizontal scrollers under the edge swipe |

`pnpm e2e` builds the demo and drives all of it in Chromium: `e2e/run.mjs` for the mechanics, `e2e/demos.mjs` for the demo apps.

## The idea

Everything is a function of one number, `p`: how much of the upper page is showing. Push runs `p` from 0 to 1, pop from 1 to 0, and a swipe sets `p` straight from the finger. Pages beneath the top stay mounted and hidden, so scroll position, form state and focus are untouched when you come back.

**The engine never decides what is a push and what is a pop.** Apps differ: some number their screens, some read the route tree, some trust the browser's back button, some say it outright per navigation. So direction is resolved by a list of small strategies, in the order you trust them, and the first opinion wins:

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
| `fromTree()` | the target is a descendant (push) or an ancestor (pop) of the current route, else deeper pushes and shallower pops |

Write your own as a plain function `(ctx) => 'push' | 'pop' | 'replace' | undefined` and put it anywhere in the list.

**The look has good defaults and no lock-in.** Duration, curve, parallax, dim and shadow are CSS custom properties on the container, so an app that wants a snappier or flatter transition sets a variable rather than rebuilding the engine:

```css
:root { --sn-duration: 340ms; --sn-easing: cubic-bezier(0.4, 0, 0.2, 1); --sn-parallax: 20%; }
```

Every one is optional, and unset means the iOS default. The [core README](packages/core#tuning-from-css) has the full list, and they are also plain JS options if you prefer.

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

Node 22.18+ runs the core (its tests use Node's built-in TypeScript stripping). The Angular tooling wants Node 22.22.3+ or 24.

The demo runs without zone.js, so a click's view update lands on the next animation frame; the e2e helpers wait for one before reading the DOM.

## Layout

```
packages/core/          @stacknav/core   TypeScript, built with tsc to dist/
packages/angular/       @stacknav/angular  built with ng-packagr to dist/
apps/demo/              vanilla demo (esbuild → dist/demo.html)
apps/angular-demo/      Angular CLI app + Playwright e2e (e2e/run.mjs)
```
